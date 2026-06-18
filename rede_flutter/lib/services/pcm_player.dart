// Dart wrapper around the native PCM player with pitch-preserved speed.
// iOS uses AVAudioEngine + AVAudioUnitTimePitch; Android uses AudioTrack
// with PlaybackParams. Both expose the same method channel API here.

import 'dart:typed_data';
import 'package:flutter/services.dart';

class PcmPlayer {
  static const _channel = MethodChannel("chat.rede.app/pcm_player");

  static Future<void> setup(int sampleRate) async {
    await _channel.invokeMethod("setup", {"sampleRate": sampleRate.toDouble()});
  }

  static Future<void> start() => _channel.invokeMethod("start");

  // Feed mono PCM16 LE at the configured sample rate. Native side handles
  // queueing, format conversion (iOS to float32), and playback.
  static Future<void> feed(Uint8List bytes) =>
      _channel.invokeMethod("feed", bytes);

  // Pitch-preserved playback rate. 1.0 = native, 0.7 = ~70% speed with
  // pitch unchanged.
  static Future<void> setSpeed(double speed) =>
      _channel.invokeMethod("setSpeed", {"speed": speed});

  static Future<void> stop() => _channel.invokeMethod("stop");
  static Future<void> release() => _channel.invokeMethod("release");
}
