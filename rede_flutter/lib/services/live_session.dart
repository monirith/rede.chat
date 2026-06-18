// Live voice session — mirrors web's gemini-live.ts.
//
// Browser ↔ Worker WebSocket (same as web client):
//   - First text msg: {"type":"start","dialect":"...","scenario":"..."}
//   - Subsequent binary frames: raw PCM16 LE @ 16kHz (user audio)
//   - Worker sends back binary frames: raw PCM16 LE @ 24kHz (Gemini audio)
//   - Worker text frames: {type:"ready"|"transcript"|"feedback"|"error"|...}

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:record/record.dart';
import 'auth.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'config.dart';
import 'device.dart';
import 'pcm_player.dart';

enum LiveState { idle, connecting, connected, ending, error }

class TranscriptTurn {
  final String role; // "user" or "model"
  String text;
  TranscriptTurn(this.role, this.text);
}

class LiveSession {
  final void Function(LiveState) onStateChange;
  final void Function(TranscriptTurn) onTranscript;
  final void Function(List<dynamic> feedback) onFeedback;
  final void Function(String) onError;

  WebSocketChannel? _ws;
  final _recorder = AudioRecorder();
  StreamSubscription<Uint8List>? _micSub;
  LiveState _state = LiveState.idle;
  bool _playbackReady = false;

  // Playback speed (pitch-preserved). The actual time-stretch runs in
  // native code (AVAudioUnitTimePitch on iOS, AudioTrack.PlaybackParams
  // on Android). 1.0 = native tempo.
  double _speed = 1.0;

  LiveSession({
    required this.onStateChange,
    required this.onTranscript,
    required this.onFeedback,
    required this.onError,
  });

  void setLiveSpeed(double speed) {
    _speed = speed.clamp(0.25, 4.0);
    // Native player handles the actual time-stretch; fire-and-forget.
    // ignore: discarded_futures
    PcmPlayer.setSpeed(_speed);
  }

  // Push a non-turn context message — used to switch CEFR level mid-session
  // without making the AI take a turn. Same wire format as the web client.
  void sendContext(String text) {
    if (_ws == null) return;
    _ws!.sink.add(jsonEncode({"type": "context", "text": text}));
  }

  Future<void> start({
    required String dialect,
    required String scenario,
    String? sessionId,
    Map<String, String>? newsContext,
    String? level,
  }) async {
    _setState(LiveState.connecting);
    try {
      await _startPlayback();
      await _openSocket(dialect, scenario, sessionId, newsContext, level);
      await _startCapture();
      _setState(LiveState.connected);
    } catch (e) {
      _setState(LiveState.error);
      onError(e.toString());
      await _cleanup();
    }
  }

  Future<void> stop() async {
    if (_ws != null) {
      _setState(LiveState.ending);
      _ws!.sink.add('{"type":"stop"}');
    } else {
      await _cleanup();
      _setState(LiveState.idle);
    }
  }

  Future<void> forceClose() async {
    await _cleanup();
    _setState(LiveState.idle);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  Future<void> _startPlayback() async {
    await PcmPlayer.setup(Config.outputSampleRate);
    await PcmPlayer.start();
    // Apply any speed selected before the session started.
    await PcmPlayer.setSpeed(_speed);
    _playbackReady = true;
  }

  Future<void> _openSocket(String dialect, String scenario, String? sessionId, Map<String, String>? newsContext, String? level) async {
    final deviceId = await DeviceService.id();
    final token = AuthService.instance.token;
    final query = <String>[
      "device=$deviceId",
      if (token != null) "token=$token",
    ].join("&");
    final uri = Uri.parse("${Config.workerWsUrl}/ws/live?$query");

    _ws = WebSocketChannel.connect(uri);

    final readyCompleter = Completer<void>();

    _ws!.stream.listen(
      (msg) => _onMessage(msg, readyCompleter),
      onError: (e) {
        if (!readyCompleter.isCompleted) readyCompleter.completeError(e);
        onError(e.toString());
      },
      onDone: () async {
        if (_state != LiveState.idle) {
          await _cleanup();
          _setState(LiveState.idle);
        }
      },
    );

    // Wait for socket open, then send start
    await _ws!.ready;
    _ws!.sink.add(jsonEncode({
      "type": "start",
      "dialect": dialect,
      "scenario": scenario,
      if (sessionId != null) "sessionId": sessionId,
      if (newsContext != null) "newsContext": newsContext,
      if (level != null) "level": level,
    }));

    // Wait for `ready` from the worker
    await readyCompleter.future.timeout(const Duration(seconds: 15));
  }

  Future<void> _startCapture() async {
    final stream = await _recorder.startStream(
      const RecordConfig(
        encoder: AudioEncoder.pcm16bits,
        sampleRate: Config.inputSampleRate,
        numChannels: 1,
        echoCancel: true,
        noiseSuppress: true,
      ),
    );

    _micSub = stream.listen((bytes) {
      // Forward raw PCM16 bytes as binary WebSocket frames
      if (_ws != null && bytes.isNotEmpty) {
        _ws!.sink.add(bytes);
      }
    });
  }

  void _onMessage(dynamic data, Completer<void> readyCompleter) {
    if (data is List<int>) {
      // Binary frame = Gemini audio (PCM16 LE @ 24kHz). Native player
      // handles the pitch-preserved tempo internally.
      if (_playbackReady) {
        // ignore: discarded_futures
        PcmPlayer.feed(Uint8List.fromList(data));
      }
      return;
    }
    if (data is String) {
      // Cheap manual parse — could use jsonDecode but this is hot path
      try {
        final json = _decode(data);
        final type = json["type"];
        switch (type) {
          case "ready":
            if (!readyCompleter.isCompleted) readyCompleter.complete();
            break;
          case "transcript":
            onTranscript(TranscriptTurn(json["role"], json["text"]));
            break;
          case "feedback":
            onFeedback(json["feedback"] is List ? json["feedback"] : []);
            break;
          case "error":
            onError(json["message"]?.toString() ?? "unknown error");
            break;
          case "interrupted":
            // Drain playback queue on interrupt. Cheapest way: just stop and
            // restart on the next chunk. flutter_pcm_sound doesn't expose a
            // direct "flush" — skipping for now, queue drains naturally.
            break;
        }
      } catch (_) {}
    }
  }

  Map<String, dynamic> _decode(String s) => jsonDecode(s) as Map<String, dynamic>;

  Future<void> _cleanup() async {
    await _micSub?.cancel();
    _micSub = null;
    try { await _recorder.stop(); } catch (_) {}
    try { await _ws?.sink.close(); } catch (_) {}
    _ws = null;
    if (_playbackReady) {
      try { await PcmPlayer.release(); } catch (_) {}
      _playbackReady = false;
    }
  }

  void _setState(LiveState s) {
    _state = s;
    onStateChange(s);
  }
}

