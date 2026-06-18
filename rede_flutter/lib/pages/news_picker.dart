import 'package:flutter/material.dart';
import '../services/i18n.dart';
import '../services/news_service.dart';

// Single news view — shows the full SRF feed, 1 item per line. Picking an
// item fetches its article body and pops back with a NewsArticle.
class NewsPickerPage extends StatefulWidget {
  const NewsPickerPage({super.key});
  @override
  State<NewsPickerPage> createState() => _NewsPickerPageState();
}

class _NewsPickerPageState extends State<NewsPickerPage> {
  List<NewsItem>? _items;
  bool _loading = true;
  bool _error = false;
  String? _fetching;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await NewsService.fetchFeed();
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = true;
        _loading = false;
      });
    }
  }

  Future<void> _pick(NewsItem item) async {
    if (_fetching != null) return;
    setState(() => _fetching = item.link);
    try {
      final article = await NewsService.fetchArticle(item);
      if (!mounted) return;
      Navigator.of(context).pop(article);
    } catch (_) {
      if (!mounted) return;
      setState(() => _fetching = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(I18n.instance.t("home.newsError"))),
      );
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
          title: Text(i18n.t("home.newsTitle")),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error
                ? Center(child: Text(i18n.t("home.newsError"),
                    style: const TextStyle(color: Color(0xFFc8102e))))
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    itemCount: _items!.length,
                    separatorBuilder: (_, _) => const Divider(height: 1, color: Colors.black12),
                    itemBuilder: (_, i) {
                      final item = _items![i];
                      return _NewsRow(
                        item: item,
                        loading: _fetching == item.link,
                        onTap: () => _pick(item),
                      );
                    },
                  ),
      ),
    );
  }
}

class _NewsRow extends StatelessWidget {
  final NewsItem item;
  final bool loading;
  final VoidCallback onTap;
  const _NewsRow({required this.item, required this.loading, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: loading ? null : onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (item.image.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.network(
                  item.image,
                  width: 56, height: 56, fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => Container(width: 56, height: 56, color: Colors.black12),
                ),
              )
            else
              Container(width: 56, height: 56, decoration: BoxDecoration(color: Colors.black12, borderRadius: BorderRadius.circular(6))),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.title1, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  if (item.title2.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(item.title2, style: TextStyle(fontSize: 12, color: Colors.black.withValues(alpha: 0.55))),
                  ],
                ],
              ),
            ),
            if (loading) ...[
              const SizedBox(width: 8),
              const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
            ],
          ],
        ),
      ),
    );
  }
}

