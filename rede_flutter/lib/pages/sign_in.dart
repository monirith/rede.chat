import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/auth.dart';
import '../services/i18n.dart';

// Email-OTP sign-in sheet. The two social providers (Google, Apple) are
// available on the web client and not wired here yet — that needs native
// deep-link / Sign-in-with-Apple SDK plumbing per platform.
class SignInSheet extends StatefulWidget {
  const SignInSheet({super.key});
  @override
  State<SignInSheet> createState() => _SignInSheetState();
}

class _SignInSheetState extends State<SignInSheet> {
  final _emailCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  bool _sending = false;
  bool _verifying = false;
  bool _sent = false;
  String? _error;

  Future<void> _send() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) return;
    setState(() { _sending = true; _error = null; });
    final err = await AuthService.instance.sendOtp(email);
    if (!mounted) return;
    setState(() {
      _sending = false;
      _error = err;
      if (err == null) _sent = true;
    });
  }

  Future<void> _verify() async {
    final code = _codeCtrl.text.trim();
    if (code.isEmpty) return;
    setState(() { _verifying = true; _error = null; });
    final err = await AuthService.instance.verifyOtp(_emailCtrl.text.trim(), code);
    if (!mounted) return;
    setState(() { _verifying = false; _error = err; });
    if (err == null) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n.instance;
    const ink = Color(0xFF0a0a0a);
    final inkSubtle = Colors.black.withValues(alpha: 0.6);
    final inkBorder = Colors.black.withValues(alpha: 0.15);
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 24, right: 24, top: 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(i18n.t("signin.title"), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: ink)),
          const SizedBox(height: 16),
          if (_sent) ...[
            Text(i18n.t("signin.sentTitle"), style: const TextStyle(fontWeight: FontWeight.w600, color: ink)),
            const SizedBox(height: 4),
            Text(i18n.t("signin.sentBody"), style: TextStyle(color: inkSubtle)),
            const SizedBox(height: 16),
            TextField(
              controller: _codeCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              maxLength: 6,
              cursorColor: ink,
              textAlign: TextAlign.center,
              style: const TextStyle(color: ink, fontSize: 22, letterSpacing: 8),
              decoration: InputDecoration(
                counterText: '',
                hintText: '••••••',
                hintStyle: TextStyle(color: Colors.black.withValues(alpha: 0.25), letterSpacing: 8),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: inkBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: ink),
                ),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _verifying ? null : _verify,
              style: FilledButton.styleFrom(
                backgroundColor: ink,
                foregroundColor: const Color(0xFFfaf7f2),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: Text(_verifying ? '…' : i18n.t('nav.continue')),
            ),
          ] else ...[
            Text(i18n.t("signin.subtitle"), style: TextStyle(color: inkSubtle)),
            const SizedBox(height: 8),
            TextField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              cursorColor: ink,
              style: const TextStyle(color: ink),
              decoration: InputDecoration(
                hintText: "you@example.com",
                hintStyle: TextStyle(color: Colors.black.withValues(alpha: 0.35)),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: inkBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: ink),
                ),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _sending ? null : _send,
              style: FilledButton.styleFrom(
                backgroundColor: ink,
                foregroundColor: const Color(0xFFfaf7f2),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: Text(_sending ? "…" : i18n.t("signin.send")),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Color(0xFFc8102e))),
          ],
          SizedBox(height: 24 + MediaQuery.of(context).padding.bottom),
        ],
      ),
    );
  }
}
