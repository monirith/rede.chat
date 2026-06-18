import 'package:flutter/material.dart';
import '../services/catalog.dart';
import '../services/i18n.dart';
import '../services/news_service.dart';
import 'news_picker.dart';

// Result type for the Scenario picker. Either a plain scenario key, or a
// news article when the user drills into News.
class ScenarioPickerResult {
  final String scenarioKey;
  final NewsArticle? article;
  const ScenarioPickerResult({required this.scenarioKey, this.article});
}

class ScenarioPickerPage extends StatelessWidget {
  final String dialect;
  final String current;
  const ScenarioPickerPage({super.key, required this.dialect, required this.current});

  Future<void> _openNews(BuildContext context) async {
    final article = await Navigator.of(context).push<NewsArticle>(
      MaterialPageRoute(builder: (_) => const NewsPickerPage()),
    );
    if (article != null && context.mounted) {
      Navigator.of(context).pop(ScenarioPickerResult(scenarioKey: "news", article: article));
    }
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n.instance;
    return AnimatedBuilder(
      animation: i18n,
      builder: (context, _) => Scaffold(
        backgroundColor: const Color(0xFFfaf7f2),
        appBar: AppBar(
          backgroundColor: const Color(0xFFfaf7f2),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: Text(i18n.t("home.situation")),
        ),
        body: ListView.separated(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          itemCount: SCENARIOS.length + 1,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            if (i == 0) {
              return _NewsTile(dialect: dialect, onTap: () => _openNews(context));
            }
            final s = SCENARIOS[i - 1];
            // Title = target language (the dialect to learn).
            // Subtitle = user UI language. Don't swap.
            final name = scenarioNameFor(dialect, s.key, i18n.t("scenario.${s.key}.name"));
            final desc = i18n.t("scenario.${s.key}.desc");
            return _ScenarioTile(
              name: name,
              desc: desc,
              image: s.image,
              onTap: () => Navigator.of(context).pop(ScenarioPickerResult(scenarioKey: s.key)),
            );
          },
        ),
      ),
    );
  }
}

class _ScenarioTile extends StatelessWidget {
  final String name;
  final String desc;
  final String image;
  final VoidCallback onTap;
  const _ScenarioTile({required this.name, required this.desc, required this.image, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 88,
      child: Material(
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
                if (image.isNotEmpty)
                  Positioned.fill(
                    child: Row(children: [
                      const Spacer(),
                      Expanded(child: Image.asset("assets$image", fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink())),
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
      ),
    );
  }
}

class _NewsTile extends StatelessWidget {
  final String dialect;
  final VoidCallback onTap;
  const _NewsTile({required this.dialect, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final i18n = I18n.instance;
    return SizedBox(
      height: 88,
      child: Material(
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
                    Expanded(child: Image.asset("assets/situations/news.jpg", fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink())),
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
                    children: [
                      // Title = target language (the dialect to learn).
                      // Subtitle = user UI language. Don't swap.
                      Text(scenarioNameFor(dialect, "news", "Aktuelli Nüüs"), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      const SizedBox(height: 2),
                      Text(i18n.t("home.newsSubtitle"), style: TextStyle(fontSize: 12, color: Colors.black.withValues(alpha: 0.5))),
                    ],
                  ),
                ),
                const Positioned(
                  right: 12,
                  top: 0, bottom: 0,
                  child: Center(child: Icon(Icons.chevron_right, color: Colors.black45)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
