// Mirrors app/src/pages/Home.svelte.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/auth.dart';
import '../services/api.dart';
import '../services/catalog.dart';
import '../services/i18n.dart';
import '../services/news_service.dart';
import '../widgets/dialect_card.dart';
import '../widgets/wordmark.dart';
import 'dialect_picker.dart';
import 'scenario_picker.dart';
import 'sign_in.dart';

const _dialectKey = "rede:dialect";
const _scenarioKey = "rede:scenario";

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  UserInfo? user;
  bool loading = true;
  String selectedDialect = "zuri";
  String selectedScenario = "free_talk";
  NewsArticle? selectedArticle;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    selectedDialect = prefs.getString(_dialectKey) ?? "zuri";
    // Validate stored scenario against catalog, falling back to free_talk
    final stored = prefs.getString(_scenarioKey);
    final validKeys = SCENARIOS.map((s) => s.key).toSet();
    selectedScenario = (stored != null && validKeys.contains(stored)) ? stored : "free_talk";
    try {
      user = await Api.me();
    } catch (_) {}
    if (mounted) setState(() => loading = false);
  }

  Future<void> _pickDialect() async {
    final selected = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => DialectPickerPage(current: selectedDialect)),
    );
    if (selected != null) {
      setState(() => selectedDialect = selected);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_dialectKey, selected);
    }
  }

  Future<void> _pickScenario() async {
    final result = await Navigator.of(context).push<ScenarioPickerResult>(
      MaterialPageRoute(builder: (_) => ScenarioPickerPage(current: selectedScenario, dialect: selectedDialect)),
    );
    if (result == null) return;
    setState(() {
      selectedScenario = result.scenarioKey;
      selectedArticle = result.article;
    });
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_scenarioKey, result.scenarioKey);
  }

  void _startSession() {
    // For the "news" pseudo-scenario, the Gemini call still uses free_talk
    // as the actual scenario; the article context is passed separately.
    final actualScenario = selectedScenario == "news" ? "free_talk" : selectedScenario;
    context.push(
      "/session?dialect=$selectedDialect&scenario=$actualScenario",
      extra: selectedScenario == "news" ? selectedArticle : null,
    );
  }

  String _formatBalance(int seconds, String mins, String secs) {
    if (seconds <= 0) return "0 $mins";
    final m = seconds ~/ 60;
    final s = seconds % 60;
    if (s == 0) return "$m $mins";
    return "$m $mins $s $secs";
  }

  void _openSignIn() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFFfaf7f2),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const SignInSheet(),
    ).then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n.instance;
    final signedIn = AuthService.instance.isSignedIn;
    final seconds = user?.seconds ?? 0;
    // News scenario requires a picked article; otherwise any positive balance.
    final canStart = seconds > 0 && (selectedScenario != "news" || selectedArticle != null);
    final dialect = DIALECTS.firstWhere((d) => d.key == selectedDialect, orElse: () => DIALECTS.first);
    final scenario = SCENARIOS.firstWhere((s) => s.key == selectedScenario, orElse: () => SCENARIOS.first);

    return AnimatedBuilder(
      animation: i18n,
      builder: (context, _) => Scaffold(
        backgroundColor: const Color(0xFFfaf7f2),
        appBar: AppBar(
          backgroundColor: const Color(0xFFfaf7f2),
          elevation: 0,
          scrolledUnderElevation: 0,
          title: const Wordmark(),
          centerTitle: false,
          actions: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: _SquareMenuButton(
                onSelected: (route) {
                  if (route == "signin") {
                    _openSignIn();
                    return;
                  }
                  // Skip if already on this route (treat "/" and "/app" as same).
                  final current = GoRouterState.of(context).matchedLocation;
                  final normalized = current == "/" ? "/app" : current;
                  if (normalized == route) return;
                  // Push so the back button can naturally reverse-animate.
                  context.push(route);
                },
                signedIn: signedIn,
              ),
            ),
          ],
        ),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Hero / Greeting
                      if (signedIn && user?.email != null)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Flexible(
                              child: GestureDetector(
                                onTap: () => context.push("/profile"),
                                child: Text(
                                  "${i18n.t("home.hello")}${user?.name != null ? ', ${user!.name}' : ''}",
                                  style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800, height: 1.1),
                                ),
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text("${user!.currentStreak > 1 ? '🔥 ' : ''}${user!.currentStreak}",
                                  style: const TextStyle(fontSize: 22)),
                                Text(i18n.t("home.dayStreak"), style: TextStyle(fontSize: 11, color: Colors.black.withValues(alpha: 0.5))),
                                const SizedBox(height: 6),
                                GestureDetector(
                                  onTap: () => context.push("/credits"),
                                  child: Text(
                                    "${_formatBalance(seconds, i18n.t("unit.minutes"), i18n.t("unit.seconds"))} ${i18n.t("home.creditsLeft")}",
                                    style: TextStyle(fontSize: 12, color: Colors.black.withValues(alpha: 0.65)),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        )
                      else
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(i18n.t("landing.hero"),
                              style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800, height: 1.1)),
                            const SizedBox(height: 12),
                            Text(i18n.t("landing.subhero"),
                              style: TextStyle(fontSize: 15, color: Colors.black.withValues(alpha: 0.65), height: 1.4)),
                          ],
                        ),
                      const SizedBox(height: 24),

                      // Pickers — dialect on row 1, situation on row 2, both full width
                      _PickerColumn(
                        label: i18n.t("home.dialect"),
                        card: DialectCard(dialect: dialect, selected: true, onTap: _pickDialect),
                      ),
                      const SizedBox(height: 12),
                      _PickerColumn(
                        label: i18n.t("home.situation"),
                        card: selectedScenario == "news" && selectedArticle != null
                          ? _NewsPreviewCard(article: selectedArticle!, dialect: selectedDialect, onTap: _pickScenario)
                          : _ScenarioPreviewCard(
                              scenario: scenario,
                              dialect: selectedDialect,
                              onTap: _pickScenario,
                            ),
                      ),

                      const Spacer(),

                      // Anonymous credit hint
                      if (!signedIn) ...[
                        if (seconds > 0)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: RichText(
                              textAlign: TextAlign.center,
                              text: TextSpan(
                                style: TextStyle(fontSize: 14, color: Colors.black.withValues(alpha: 0.6)),
                                children: _interpolate(
                                  i18n.t("home.freeLeft"),
                                  _formatBalance(seconds, i18n.t("unit.minutes"), i18n.t("unit.seconds")),
                                ),
                              ),
                            ),
                          ),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Center(
                            child: TextButton(
                              onPressed: _openSignIn,
                              style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 0)),
                              child: Text(i18n.t("home.createAccount"),
                                style: const TextStyle(decoration: TextDecoration.underline)),
                            ),
                          ),
                        ),
                      ],

                      // Start button
                      FilledButton.icon(
                        onPressed: canStart ? _startSession : null,
                        icon: const Icon(Icons.mic),
                        label: Text(i18n.t("home.start")),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF0a0a0a),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }

  List<InlineSpan> _interpolate(String template, String balance) {
    final parts = template.split("{balance}");
    return [
      if (parts.isNotEmpty) TextSpan(text: parts[0]),
      TextSpan(text: balance, style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.black)),
      if (parts.length > 1) TextSpan(text: parts[1]),
    ];
  }
}

// Square hamburger menu (mirrors the web mobile menu). Opens a dropdown of
// nav items. Lists Profile only when signed in, Sign In only when not.
class _SquareMenuButton extends StatelessWidget {
  final bool signedIn;
  final void Function(String route) onSelected;
  const _SquareMenuButton({required this.signedIn, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    final i18n = I18n.instance;
    return PopupMenuButton<String>(
      tooltip: "",
      position: PopupMenuPosition.under,
      offset: const Offset(0, 10),
      constraints: const BoxConstraints(minWidth: 220),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Colors.black.withValues(alpha: 0.08)),
      ),
      color: Colors.white,
      child: Container(
        width: 40, height: 40,
        decoration: BoxDecoration(
          color: Colors.transparent,
          border: Border.all(color: Colors.black.withValues(alpha: 0.2)),
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Icon(Icons.menu, size: 20),
      ),
      itemBuilder: (_) => [
        _item("/app", i18n.t("nav.practice")),
        _item("/history", i18n.t("nav.history")),
        _item("/phrasebook", i18n.t("nav.phrasebook")),
        _item("/credits", i18n.t("nav.credits")),
        if (signedIn) _item("/profile", i18n.t("nav.profile")),
        if (!signedIn) _item("signin", i18n.t("nav.signIn")),
      ],
      onSelected: onSelected,
    );
  }

  PopupMenuItem<String> _item(String value, String label) => PopupMenuItem<String>(
    value: value,
    height: 52,
    padding: const EdgeInsets.symmetric(horizontal: 18),
    child: Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
  );
}

class _PickerColumn extends StatelessWidget {
  final String label;
  final Widget card;
  const _PickerColumn({required this.label, required this.card});
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5, color: Colors.black.withValues(alpha: 0.4))),
        const SizedBox(height: 8),
        SizedBox(height: 112, child: card),
      ],
    );
  }
}

class _ScenarioPreviewCard extends StatelessWidget {
  final Scenario scenario;
  final String dialect;
  final VoidCallback onTap;
  const _ScenarioPreviewCard({required this.scenario, required this.dialect, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final i18n = I18n.instance;
    // Title = target language (the dialect to learn).
    // Subtitle = user UI language. Don't swap.
    final name = scenarioNameFor(dialect, scenario.key, i18n.t("scenario.${scenario.key}.name"));
    final desc = i18n.t("scenario.${scenario.key}.desc");
    return Material(
      color: Colors.white,
      elevation: 0,
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.black12),
          ),
          child: Stack(
            children: [
              if (scenario.image.isNotEmpty)
                Positioned.fill(
                  child: Row(children: [
                    const Spacer(),
                    Expanded(child: Image.asset(
                      "assets${scenario.image}",
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                    )),
                  ]),
                ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                      stops: [0.5, 0.6],
                      colors: [Colors.white, Color(0x00FFFFFF)],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(desc, style: TextStyle(fontSize: 12, color: Colors.black.withValues(alpha: 0.5))),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NewsPreviewCard extends StatelessWidget {
  final NewsArticle article;
  final String dialect;
  final VoidCallback onTap;
  const _NewsPreviewCard({required this.article, required this.dialect, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 0,
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.black12, width: 1),
          ),
          child: Stack(
            children: [
              Positioned.fill(
                child: Row(children: [
                  const Spacer(),
                  Expanded(child: article.image != null
                    ? Image.network(article.image!, fit: BoxFit.cover, errorBuilder: (_, _, _) => Image.asset("assets/situations/news.jpg", fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink()))
                    : Image.asset("assets/situations/news.jpg", fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink())),
                ]),
              ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.centerLeft, end: Alignment.centerRight,
                      stops: [0.5, 0.6],
                      colors: [Colors.white, Color(0x00FFFFFF)],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Section label = target language (the dialect to learn).
                    // Below it the article title comes from SRF (always
                    // German). Below that the article subtitle is also SRF
                    // (German). Only this label rotates with the dialect.
                    Text(scenarioNameFor(dialect, "news", "Aktuelli Nüüs"),
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.black.withValues(alpha: 0.4))),
                    const SizedBox(height: 4),
                    Text(article.title1, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14), maxLines: 2, overflow: TextOverflow.ellipsis),
                    if (article.title2.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(article.title2, style: TextStyle(fontSize: 12, color: Colors.black.withValues(alpha: 0.5)), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
