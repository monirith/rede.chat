import 'package:flutter/material.dart';
import '../services/catalog.dart';
import '../services/i18n.dart';
import '../widgets/dialect_card.dart';

class DialectPickerPage extends StatelessWidget {
  final String current;
  const DialectPickerPage({super.key, required this.current});

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
          title: Text(i18n.t("home.dialect")),
        ),
        body: ListView.separated(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          itemCount: DIALECTS.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final d = DIALECTS[i];
            return SizedBox(
              height: 112,
              child: DialectCard(
                dialect: d,
                onTap: () => Navigator.of(context).pop(d.key),
              ),
            );
          },
        ),
      ),
    );
  }
}
