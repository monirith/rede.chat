import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'pages/credits.dart';
import 'pages/history.dart';
import 'pages/home.dart';
import 'pages/phrasebook.dart';
import 'pages/profile.dart';
import 'pages/session.dart';
import 'services/auth.dart';
import 'services/iap_service.dart';
import 'services/news_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AuthService.instance.init();
  // Pre-warm IAP so the Credits page opens with products already loaded and
  // any pending transactions get drained.
  // ignore: discarded_futures
  IapService.init();
  runApp(const RedeApp());
}

final _router = GoRouter(
  initialLocation: "/",
  routes: [
    GoRoute(path: "/", builder: (_, __) => const HomePage()),
    GoRoute(path: "/app", builder: (_, __) => const HomePage()),
    GoRoute(
      path: "/session",
      builder: (context, state) {
        final dialect = state.uri.queryParameters["dialect"] ?? "zuri";
        final scenario = state.uri.queryParameters["scenario"] ?? "free_talk";
        final article = state.extra is NewsArticle ? state.extra as NewsArticle : null;
        return SessionPage(dialect: dialect, scenario: scenario, newsArticle: article);
      },
    ),
    GoRoute(path: "/credits", builder: (_, __) => const CreditsPage()),
    GoRoute(path: "/profile", builder: (_, __) => const ProfilePage()),
    GoRoute(path: "/history", builder: (_, __) => const HistoryPage()),
    GoRoute(path: "/phrasebook", builder: (_, __) => const PhrasebookPage()),
  ],
);

class RedeApp extends StatelessWidget {
  const RedeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: "rede.chat",
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFda291c),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFfaf7f2),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFfaf7f2),
          elevation: 0,
        ),
      ),
      routerConfig: _router,
    );
  }
}
