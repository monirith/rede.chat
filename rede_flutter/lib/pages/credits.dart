import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../services/auth.dart';
import '../services/api.dart';
import '../services/i18n.dart';
import '../services/iap_service.dart';

class CreditsPage extends StatefulWidget {
  const CreditsPage({super.key});
  @override
  State<CreditsPage> createState() => _CreditsPageState();
}

class _CreditsPageState extends State<CreditsPage> {
  UserInfo? user;
  bool loading = true;
  String? buyingProductId;
  StreamSubscription<PurchaseEvent>? _sub;

  @override
  void initState() {
    super.initState();
    _load();
    _sub = IapService.events.listen(_onPurchaseEvent);
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    // Always retry the product query — store catalog can be empty at app
    // launch (e.g. sandbox account not yet signed in) and recover later.
    await IapService.init();
    try {
      user = await Api.me();
    } catch (_) {}
    if (mounted) setState(() => loading = false);
  }

  Future<void> _retryLoadProducts() async {
    setState(() => loading = true);
    await IapService.loadProducts();
    if (mounted) setState(() => loading = false);
  }

  void _onPurchaseEvent(PurchaseEvent e) {
    if (!mounted) return;
    switch (e.kind) {
      case PurchaseEventKind.pending:
        // Sheet is showing — just keep spinner.
        break;
      case PurchaseEventKind.success:
        setState(() => buyingProductId = null);
        _showSnack(I18n.instance.t("credits.success"));
        _refreshBalance();
        break;
      case PurchaseEventKind.cancel:
        setState(() => buyingProductId = null);
        break;
      case PurchaseEventKind.error:
        setState(() => buyingProductId = null);
        _showSnack(e.message ?? "Purchase failed");
        break;
    }
  }

  Future<void> _refreshBalance() async {
    try {
      final m = await Api.me();
      if (mounted) setState(() => user = m);
    } catch (_) {}
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _buy(ProductDetails product) async {
    setState(() => buyingProductId = product.id);
    final ok = await IapService.buy(product);
    if (!ok && mounted) {
      setState(() => buyingProductId = null);
      _showSnack("Could not start purchase");
    }
  }

  String _formatBalance(int seconds, String mins, String secs) {
    if (seconds <= 0) return "0 $mins";
    final m = seconds ~/ 60;
    final s = seconds % 60;
    if (s == 0) return "$m $mins";
    return "$m $mins $s $secs";
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n.instance;
    final signedIn = AuthService.instance.isSignedIn;
    final products = IapService.products;
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
          title: Text(i18n.t("credits.title")),
        ),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (signedIn && user != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 24),
                        child: Text("${i18n.t("credits.balance")}: ${_formatBalance(user!.seconds, i18n.t("unit.minutes"), i18n.t("unit.seconds"))}",
                          style: TextStyle(fontSize: 16, color: Colors.black.withValues(alpha: 0.6))),
                      ),
                    if (products.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                "No purchases available.\nMake sure you're signed into the App Store / Play Store with a sandbox or live account, and that products are configured.",
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Colors.black.withValues(alpha: 0.5), fontSize: 14),
                              ),
                              const SizedBox(height: 16),
                              OutlinedButton(
                                onPressed: _retryLoadProducts,
                                child: const Text("Retry"),
                              ),
                            ],
                          ),
                        ),
                      )
                    else Expanded(
                      child: GridView.builder(
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 1.2,
                        ),
                        itemCount: products.length,
                        itemBuilder: (_, i) {
                          final p = products[i];
                          final busy = buyingProductId == p.id;
                          return Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.black12),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(p.title.isNotEmpty ? p.title : p.id, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16), maxLines: 1, overflow: TextOverflow.ellipsis),
                                FilledButton(
                                  onPressed: (buyingProductId != null) ? null : () => _buy(p),
                                  style: FilledButton.styleFrom(
                                    backgroundColor: const Color(0xFF0a0a0a),
                                    minimumSize: const Size(double.infinity, 40),
                                  ),
                                  child: busy
                                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                    : Text(p.price),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(i18n.t("credits.bySecond"),
                            style: TextStyle(fontSize: 11, color: Colors.black.withValues(alpha: 0.4))),
                          const SizedBox(height: 4),
                          Text(i18n.t("credits.noSubscription"),
                            style: TextStyle(fontSize: 11, color: Colors.black.withValues(alpha: 0.4))),
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
