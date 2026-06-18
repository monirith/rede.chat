// Wraps in_app_purchase. Lists products, drives the purchase flow, and
// forwards the resulting receipt/token to the rede-worker for verification.
// The worker is the source of truth for granted credits — never trust the
// device, matching the web Stripe-webhook pattern.

import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_storekit/store_kit_wrappers.dart';
import 'auth.dart';
import 'config.dart';
import 'device.dart';

// Mirror the worker's MINUTE_PACKS exactly. Product IDs are what you create
// in App Store Connect and Google Play Console.
//   rede.intro:   2.99 CHF — 30 minutes (sampler)
//   rede.starter: 9.99 CHF — 2 hours    (main pack)
// `rede.standard` / `rede.value` were deprecated; if any old purchase still
// references them the verify endpoint will reject them harmlessly.
const List<String> kIapProductIds = [
  "rede.intro",
  "rede.starter",
];

class IapService {
  static final InAppPurchase _iap = InAppPurchase.instance;
  static StreamSubscription<List<PurchaseDetails>>? _sub;
  static final _purchaseController = StreamController<PurchaseEvent>.broadcast();
  static List<ProductDetails> _products = [];

  static Stream<PurchaseEvent> get events => _purchaseController.stream;
  static List<ProductDetails> get products => _products;

  static Future<bool> available() async {
    return await _iap.isAvailable();
  }

  static Future<void> init() async {
    if (_sub != null) {
      // Already wired up — just refresh the catalog. The store can flap
      // (no sandbox account signed in at app launch, etc.) so reloading
      // on demand lets the Credits page recover without an app restart.
      await loadProducts();
      return;
    }
    if (!await available()) {
      debugPrint("[iap] store not available on this device");
      return;
    }

    // Pending transactions from a prior crash/abort must be finished or
    // they'll re-fire forever.
    if (Platform.isIOS) {
      final paymentWrapper = SKPaymentQueueWrapper();
      final transactions = await paymentWrapper.transactions();
      for (final t in transactions) {
        await paymentWrapper.finishTransaction(t);
      }
    }

    _sub = _iap.purchaseStream.listen(_onPurchasesUpdated,
      onDone: () { _sub?.cancel(); _sub = null; },
      onError: (e) => debugPrint("[iap] purchase stream error: $e"),
    );

    await loadProducts();
  }

  // Re-query the store. Safe to call repeatedly.
  static Future<void> loadProducts() async {
    if (!await available()) {
      debugPrint("[iap] loadProducts: store not available");
      _products = [];
      return;
    }
    final r = await _iap.queryProductDetails(kIapProductIds.toSet());
    if (r.error != null) debugPrint("[iap] product query error: ${r.error}");
    if (r.notFoundIDs.isNotEmpty) {
      debugPrint("[iap] product IDs not found in store: ${r.notFoundIDs}");
    }
    _products = r.productDetails;
    debugPrint("[iap] loaded ${_products.length} product(s): ${_products.map((p) => p.id).toList()}");
  }

  // Kick off the platform purchase sheet. Result delivered via [events].
  static Future<bool> buy(ProductDetails product) async {
    final param = PurchaseParam(productDetails: product);
    // Credit packs are consumable — same pack can be bought again.
    return _iap.buyConsumable(purchaseParam: param, autoConsume: true);
  }

  static Future<void> _onPurchasesUpdated(List<PurchaseDetails> list) async {
    for (final p in list) {
      switch (p.status) {
        case PurchaseStatus.pending:
          _purchaseController.add(PurchaseEvent.pending(p.productID));
          break;
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          final granted = await _verifyWithWorker(p);
          _purchaseController.add(granted
            ? PurchaseEvent.success(p.productID)
            : PurchaseEvent.error(p.productID, "Verification failed"));
          // Always finish — if verification failed, the user can retry by
          // calling restorePurchases; otherwise Apple keeps re-delivering.
          if (p.pendingCompletePurchase) {
            await _iap.completePurchase(p);
          }
          break;
        case PurchaseStatus.error:
        case PurchaseStatus.canceled:
          _purchaseController.add(p.status == PurchaseStatus.canceled
            ? PurchaseEvent.cancel(p.productID)
            : PurchaseEvent.error(p.productID, p.error?.message ?? "Purchase failed"));
          if (p.pendingCompletePurchase) {
            await _iap.completePurchase(p);
          }
          break;
      }
    }
  }

  static Future<bool> _verifyWithWorker(PurchaseDetails p) async {
    final deviceId = await DeviceService.id();
    final token = AuthService.instance.token;
    final body = <String, dynamic>{
      "platform": Platform.isIOS ? "apple" : "google",
      "productId": p.productID,
      "transactionId": p.purchaseID,
      "receipt": p.verificationData.serverVerificationData,
      "source": p.verificationData.source,
    };
    try {
      final res = await http.post(
        Uri.parse("${Config.workerHttpUrl}/api/iap/verify"),
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": deviceId,
          if (token != null) "Authorization": "Bearer $token",
        },
        body: jsonEncode(body),
      );
      if (res.statusCode == 200) return true;
      debugPrint("[iap] verify failed ${res.statusCode}: ${res.body}");
      return false;
    } catch (e) {
      debugPrint("[iap] verify exception: $e");
      return false;
    }
  }
}

enum PurchaseEventKind { pending, success, cancel, error }

class PurchaseEvent {
  final PurchaseEventKind kind;
  final String productId;
  final String? message;
  const PurchaseEvent._(this.kind, this.productId, [this.message]);
  factory PurchaseEvent.pending(String id) => PurchaseEvent._(PurchaseEventKind.pending, id);
  factory PurchaseEvent.success(String id) => PurchaseEvent._(PurchaseEventKind.success, id);
  factory PurchaseEvent.cancel(String id)  => PurchaseEvent._(PurchaseEventKind.cancel, id);
  factory PurchaseEvent.error(String id, String msg) => PurchaseEvent._(PurchaseEventKind.error, id, msg);
}
