// Mirrors app/src/components/NewsPanel.svelte — fetches SRF's RSS feed and
// scrapes article bodies. Pure regex parsing (no xml/html packages) keeps
// dependencies lean; the feed is well-formed enough.

import 'package:http/http.dart' as http;

class NewsItem {
  final String title1;
  final String title2;
  final String image;
  final String link;
  const NewsItem({
    required this.title1,
    required this.title2,
    required this.image,
    required this.link,
  });

  String get fullTitle => title2.isEmpty ? title1 : "$title1 – $title2";
}

class NewsArticle {
  final String title;
  final String title1;
  final String title2;
  final String body;
  final String? image;
  const NewsArticle({
    required this.title,
    required this.title1,
    required this.title2,
    required this.body,
    this.image,
  });
}

class NewsService {
  static const _rssUrl = "https://www.srf.ch/news/bnf/rss/1646";

  static Future<List<NewsItem>> fetchFeed() async {
    final res = await http.get(Uri.parse(_rssUrl));
    if (res.statusCode != 200) throw Exception("rss ${res.statusCode}");
    return _parseRss(res.body);
  }

  static Future<NewsArticle> fetchArticle(NewsItem item) async {
    final res = await http.get(Uri.parse(item.link));
    if (res.statusCode != 200) throw Exception("article ${res.statusCode}");
    final body = _extractArticleBody(res.body);
    return NewsArticle(
      title: item.fullTitle,
      title1: item.title1,
      title2: item.title2,
      body: body,
      image: item.image.isEmpty ? null : item.image,
    );
  }

  // ── Parsing helpers ─────────────────────────────────────────────────────

  static List<NewsItem> _parseRss(String xml) {
    final items = <NewsItem>[];
    final itemRe = RegExp(r"<item\b[^>]*>([\s\S]*?)</item>", caseSensitive: false);
    for (final match in itemRe.allMatches(xml)) {
      final inner = match.group(1) ?? "";
      final rawTitle = _tagContent(inner, "title");
      final (title1, title2) = _splitTitle(rawTitle);
      final desc = _tagContent(inner, "description");
      final image = _extractImageSrc(desc);
      final link = _tagContent(inner, "link").trim();
      if (link.isEmpty) continue;
      items.add(NewsItem(title1: title1, title2: title2, image: image, link: link));
    }
    return items;
  }

  static String _tagContent(String src, String tag) {
    final re = RegExp("<$tag\\b[^>]*>([\\s\\S]*?)</$tag>", caseSensitive: false);
    final m = re.firstMatch(src);
    if (m == null) return "";
    return _decodeEntities(_stripCData(m.group(1)?.trim() ?? ""));
  }

  static String _stripCData(String s) {
    final m = RegExp(r"^<!\[CDATA\[([\s\S]*?)\]\]>$").firstMatch(s);
    return m?.group(1) ?? s;
  }

  static (String, String) _splitTitle(String raw) {
    for (final sep in const [" – ", " - "]) {
      final i = raw.indexOf(sep);
      if (i != -1) return (raw.substring(0, i), raw.substring(i + sep.length));
    }
    return (raw, "");
  }

  static String _extractImageSrc(String description) {
    final m = RegExp(r'src="([^"]+)"').firstMatch(description);
    return m?.group(1) ?? "";
  }

  // Pull text from <p>...</p> inside the SRF article body container. If
  // the container can't be found, fall back to all <p> on the page.
  static String _extractArticleBody(String html) {
    final containerRe = RegExp(
      r'''(?:data-news-landmark="article-content"|itemprop="articleBody")[\s\S]*?>([\s\S]*?)(?:</article>|</main>|</div>\s*</div>\s*</div>)''',
      caseSensitive: false,
    );
    final containerMatch = containerRe.firstMatch(html);
    final scope = containerMatch?.group(1) ?? html;
    final pRe = RegExp(r"<p\b[^>]*>([\s\S]*?)</p>", caseSensitive: false);
    final parts = pRe.allMatches(scope).map((m) => _stripTags(m.group(1) ?? ""));
    final joined = parts.where((p) => p.trim().isNotEmpty).join(" ").trim();
    return _decodeEntities(joined);
  }

  static String _stripTags(String s) => s.replaceAll(RegExp(r"<[^>]+>"), "");

  static String _decodeEntities(String s) {
    return s
        .replaceAll("&amp;", "&")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&#39;", "'")
        .replaceAll("&nbsp;", " ")
        .replaceAll("&apos;", "'");
  }
}
