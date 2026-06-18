import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/i18n.dart';
import '../services/live_session.dart';
import '../services/news_service.dart';

class SessionPage extends StatefulWidget {
  final String dialect;
  final String scenario;
  final NewsArticle? newsArticle;
  const SessionPage({super.key, required this.dialect, required this.scenario, this.newsArticle});

  @override
  State<SessionPage> createState() => _SessionPageState();
}

class _SessionPageState extends State<SessionPage> {
  LiveSession? _live;
  LiveState _state = LiveState.idle;
  final List<TranscriptTurn> _turns = [];
  String? _error;
  DateTime? _startedAt;
  Duration _elapsed = Duration.zero;
  late final Stream<int> _ticker;

  // Playback speed presets (1/2/3 = slowest/slow/normal). Same mapping
  // as the web app.
  static const List<(double, String)> _speedPresets = [
    (0.7,  "1"),
    (0.85, "2"),
    (1.0,  "3"),
  ];
  double _speed = 1.0;

  // CEFR level. Default A like web — baked into system prompt at session
  // start, plus a best-effort mid-session context message when changed.
  String _level = "A";
  static const Map<String, String> _levelPrompts = {
    "A": "Switch to A1 beginner level for the rest of this conversation. Use very simple sentences (one clause), basic everyday vocabulary, mostly present tense. Speak slowly and clearly. Avoid idioms, slang, and complex grammar. If the user struggles, simplify further.",
    "B": "Switch to B1 intermediate level for the rest of this conversation. Use everyday vocabulary, varied tenses (past, present, future), and natural sentence structure. Avoid rare or technical words. Speak at a natural pace.",
    "C": "Switch back to your unrestricted native register. Speak as you would with a native speaker — full vocabulary, idioms, complex grammar all fair game. Natural pace.",
  };

  @override
  void initState() {
    super.initState();
    _ticker = Stream.periodic(const Duration(milliseconds: 250), (i) => i);
  }

  @override
  void dispose() {
    _live?.forceClose();
    super.dispose();
  }

  bool _micPermanentlyDenied = false;

  Future<void> _begin() async {
    final mic = await Permission.microphone.request();
    if (!mic.isGranted) {
      setState(() {
        _error = mic.isPermanentlyDenied
          ? "Microphone access is off. Tap below to open Settings and enable it."
          : "Microphone permission denied";
        _micPermanentlyDenied = mic.isPermanentlyDenied;
      });
      return;
    }
    _micPermanentlyDenied = false;
    setState(() {
      _error = null;
      _turns.clear();
    });
    _live = LiveSession(
      onStateChange: (s) {
        setState(() => _state = s);
        if (s == LiveState.connected) _startedAt = DateTime.now();
      },
      onTranscript: (turn) {
        setState(() {
          if (_turns.isNotEmpty && _turns.last.role == turn.role) {
            _turns.last.text += turn.text;
          } else {
            _turns.add(turn);
          }
        });
      },
      onFeedback: (feedback) {
        if (mounted) context.pop();
      },
      onError: (msg) => setState(() => _error = msg),
    );
    final article = widget.newsArticle;
    await _live!.start(
      dialect: widget.dialect,
      scenario: widget.scenario,
      newsContext: article == null ? null : {"title": article.title, "body": article.body},
      level: _level,
    );
    // Apply the speed in case the user picked one before starting.
    _live!.setLiveSpeed(_speed);
  }

  void _setSpeed(double s) {
    setState(() => _speed = s);
    _live?.setLiveSpeed(s);
  }

  void _setLevel(String l) {
    setState(() => _level = l);
    // Mid-session: best-effort context message. The level baked into the
    // system prompt at start is the load-bearing constraint; this just lets
    // the AI pivot immediately for the rest of the conversation.
    if (_state == LiveState.connected) {
      _live?.sendContext(_levelPrompts[l] ?? "");
    }
  }

  Future<void> _end() async {
    await _live?.stop();
  }

  String _formatTime(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return "$m:${s.toString().padLeft(2, "0")}";
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n.instance;

    return Scaffold(
      backgroundColor: Colors.black,
      body: AnimatedBuilder(
        animation: i18n,
        builder: (context, _) => SafeArea(
          child: Column(
            children: [
              // Header
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.1)))),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => context.pop(),
                      icon: const Icon(Icons.arrow_back, color: Colors.white70),
                    ),
                    const Spacer(),
                    Column(
                      children: [
                        Text(
                          "${widget.dialect} · ${widget.scenario.replaceAll("_", " ")}",
                          style: const TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                        StreamBuilder<int>(
                          stream: _ticker,
                          builder: (_, __) {
                            if (_startedAt != null && _state == LiveState.connected) {
                              _elapsed = DateTime.now().difference(_startedAt!);
                            }
                            return Text(
                              _formatTime(_elapsed),
                              style: const TextStyle(color: Colors.white, fontFamily: "monospace", fontSize: 18),
                            );
                          },
                        ),
                      ],
                    ),
                    const Spacer(),
                    const SizedBox(width: 48),
                  ],
                ),
              ),

              if (_error != null)
                Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.2),
                    border: Border.all(color: Colors.red.withOpacity(0.4)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.white)),
                      if (_micPermanentlyDenied) ...[
                        const SizedBox(height: 8),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: OutlinedButton(
                            onPressed: () async {
                              await openAppSettings();
                            },
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: Colors.white70),
                              foregroundColor: Colors.white,
                            ),
                            child: const Text("Open Settings"),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

              // Transcript — sticks to bottom (WhatsApp style)
              Expanded(
                child: _turns.isEmpty && _state != LiveState.connected
                    ? Center(
                        child: Text(
                          i18n.t("session.ready"),
                          style: TextStyle(color: Colors.white.withOpacity(0.4)),
                        ),
                      )
                    : ListView.builder(
                        reverse: true,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        itemCount: _turns.length,
                        itemBuilder: (_, i) {
                          final turn = _turns[_turns.length - 1 - i];
                          final isUser = turn.role == "user";
                          return Align(
                            alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                            child: Container(
                              margin: const EdgeInsets.symmetric(vertical: 4),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                              decoration: BoxDecoration(
                                color: isUser ? Colors.white.withOpacity(0.15) : Colors.white.withOpacity(0.06),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    isUser ? "You" : "AI",
                                    style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 10, letterSpacing: 1.2),
                                  ),
                                  Text(turn.text, style: const TextStyle(color: Colors.white)),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),

              // Footer: speed (left) · mic (center) · level (right)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 20),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.white.withOpacity(0.1)))),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    _BadgeColumn(
                      label: "speed",
                      children: [
                        for (final (value, label) in _speedPresets)
                          _RoundChip(
                            label: label,
                            selected: _speed == value,
                            onTap: () => _setSpeed(value),
                          ),
                      ],
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _MicButton(state: _state, onStart: _begin, onStop: _end),
                        const SizedBox(height: 6),
                        Text(
                          _stateLabel(_state, i18n),
                          style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11),
                        ),
                      ],
                    ),
                    _BadgeColumn(
                      label: "level",
                      children: [
                        for (final l in const ["A", "B", "C"])
                          _RoundChip(
                            label: l,
                            selected: _level == l,
                            onTap: () => _setLevel(l),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _stateLabel(LiveState s, I18n i18n) {
    switch (s) {
      case LiveState.idle:
      case LiveState.error:
        return i18n.t("session.ready");
      case LiveState.connecting:
        return i18n.t("session.connecting");
      case LiveState.connected:
        return i18n.t("session.live");
      case LiveState.ending:
        return i18n.t("session.preparing");
    }
  }
}

class _MicButton extends StatelessWidget {
  final LiveState state;
  final VoidCallback onStart;
  final VoidCallback onStop;
  const _MicButton({required this.state, required this.onStart, required this.onStop});

  @override
  Widget build(BuildContext context) {
    if (state == LiveState.idle || state == LiveState.error) {
      return _circle(color: const Color(0xFFda291c), onTap: onStart, child: const Icon(Icons.mic, size: 36, color: Colors.white));
    } else if (state == LiveState.connecting) {
      return _circle(color: Colors.white24, child: const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white)));
    } else if (state == LiveState.connected) {
      return _circle(color: Colors.white, onTap: onStop, child: const Icon(Icons.stop, size: 36, color: Colors.black));
    } else {
      return _circle(color: Colors.white24, child: const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white)));
    }
  }

  Widget _circle({required Color color, required Widget child, VoidCallback? onTap}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(48),
        child: Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          child: Center(child: child),
        ),
      ),
    );
  }
}

class _BadgeColumn extends StatelessWidget {
  final String label;
  final List<Widget> children;
  const _BadgeColumn({required this.label, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(mainAxisSize: MainAxisSize.min, children: [
          for (int i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            children[i],
          ],
        ]),
        const SizedBox(height: 6),
        Text(label.toUpperCase(),
          style: TextStyle(fontSize: 9, letterSpacing: 1.5, color: Colors.white.withValues(alpha: 0.3))),
      ],
    );
  }
}

class _RoundChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _RoundChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          width: 36, height: 36,
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            shape: BoxShape.circle,
            border: Border.all(
              color: selected ? Colors.white : Colors.white.withValues(alpha: 0.25),
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: selected ? Colors.black : Colors.white.withValues(alpha: 0.7),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
