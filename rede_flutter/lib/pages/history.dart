// Stub — to be fully ported from app/src/pages/History.svelte.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/i18n.dart';

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key});
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
            onPressed: () { if (Navigator.canPop(context)) { Navigator.pop(context); } else { context.go("/app"); } },
          ),
          title: Text(i18n.t("history.title")),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(i18n.t("history.empty"), style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Text(i18n.t("history.emptyBody"),
                  style: TextStyle(color: Colors.black.withValues(alpha: 0.6))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
