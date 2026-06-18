// Stub — to be fully ported from app/src/pages/Profile.svelte.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/auth.dart';
import '../services/api.dart';
import '../services/i18n.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  UserInfo? user;
  bool loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try { user = await Api.me(); } catch (_) {}
    if (mounted) setState(() => loading = false);
  }

  Future<void> _signOut() async {
    await AuthService.instance.signOut();
    if (mounted) context.go("/");
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n.instance;
    final signedIn = AuthService.instance.isSignedIn;
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
          title: Text(i18n.t("profile.title")),
        ),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : Padding(
                padding: const EdgeInsets.all(20),
                child: !signedIn
                    ? Center(child: Text(i18n.t("profile.empty")))
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (user?.email != null) _row(i18n.t("profile.email"), user!.email!),
                          if (user?.name != null) _row(i18n.t("profile.name"), user!.name!),
                          _row(i18n.t("profile.streak"), "${user?.currentStreak ?? 0}"),
                          _row(i18n.t("profile.longest"), "${user?.longestStreak ?? 0}"),
                          const SizedBox(height: 24),
                          OutlinedButton(
                            onPressed: _signOut,
                            child: Text(i18n.t("nav.signOut")),
                          ),
                        ],
                      ),
              ),
      ),
    );
  }

  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(
      children: [
        Expanded(child: Text(label, style: TextStyle(color: Colors.black.withValues(alpha: 0.6)))),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
      ],
    ),
  );
}
