// In-App Purchase verification + credit grant. Mirrors the Stripe webhook
// flow: device hands us a receipt, we verify with Apple / Google, then grant
// credits idempotently (keyed by store-issued transaction id).
//
// Environment / secrets required (set with `wrangler secret put …`):
//   APPLE_SHARED_SECRET        — App Store Connect → App → App Information → App-Specific Shared Secret
//   IOS_BUNDLE_ID              — e.g. "chat.rede.app" (must match Info.plist)
//   ANDROID_PACKAGE_NAME       — e.g. "chat.rede.app" (must match build.gradle)
//   GOOGLE_PLAY_SA_JSON        — full service-account JSON string (single line)
//
// Apple: legacy `/verifyReceipt` endpoint. Production URL is tried first;
//   it returns code 21007 for sandbox receipts, in which case we retry against
//   sandbox.
// Google: GET androidpublisher v3 purchases.products.get, OAuth2 via service
//   account JWT.

import type { Env } from "./types";
import { resolveUser } from "./auth";
import { corsHeaders } from "./api";
import { MINUTE_PACKS } from "./stripe";

const APPLE_PROD_URL    = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

interface VerifyBody {
  platform: "apple" | "google";
  productId: string;
  transactionId?: string | null;
  receipt: string; // Apple base64 receipt OR Google purchase token
  source?: string;
}

export async function handleIapVerify(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin);
  const user = await resolveUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "missing identity" }), {
      status: 400, headers: { "content-type": "application/json", ...cors },
    });
  }

  let body: VerifyBody;
  try {
    body = await request.json<VerifyBody>();
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), {
      status: 400, headers: { "content-type": "application/json", ...cors },
    });
  }

  const pack = productIdToPack(body.productId);
  if (!pack) {
    return new Response(JSON.stringify({ error: "unknown product" }), {
      status: 400, headers: { "content-type": "application/json", ...cors },
    });
  }

  let verification: VerifyResult;
  try {
    verification = body.platform === "apple"
      ? await verifyApple(body, env)
      : await verifyGoogle(body, env);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[iap] verify error:", msg);
    return new Response(JSON.stringify({ error: "verify failed", message: msg }), {
      status: 400, headers: { "content-type": "application/json", ...cors },
    });
  }
  if (!verification.ok) {
    return new Response(JSON.stringify({ error: verification.reason ?? "invalid receipt" }), {
      status: 400, headers: { "content-type": "application/json", ...cors },
    });
  }

  // Idempotent insert keyed on (platform, transaction_id). If the transaction
  // is already recorded we don't double-grant.
  const txId = verification.transactionId;
  const purchaseId = `iap_${body.platform}_${txId}`;
  const existing = await env.DB.prepare("SELECT id FROM purchases WHERE id = ?")
    .bind(purchaseId).first();
  if (existing) {
    return new Response(JSON.stringify({ ok: true, alreadyGranted: true }), {
      headers: { "content-type": "application/json", ...cors },
    });
  }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO purchases (id, user_id, stripe_checkout_id, amount_chf, seconds, status)
       VALUES (?, ?, ?, ?, ?, 'completed')`
    ).bind(purchaseId, user.id, txId, pack.amountChf, pack.seconds),
    env.DB.prepare("UPDATE users SET seconds = seconds + ? WHERE id = ?")
      .bind(pack.seconds, user.id),
  ]);

  return new Response(JSON.stringify({ ok: true, secondsGranted: pack.seconds }), {
    headers: { "content-type": "application/json", ...cors },
  });
}

function productIdToPack(productId: string) {
  // Convention: "rede.<packKey>" — see kIapProductIds in iap_service.dart.
  const key = productId.replace(/^rede\./, "");
  return MINUTE_PACKS.find((p) => p.key === key) ?? null;
}

interface VerifyResult {
  ok: boolean;
  transactionId: string;
  reason?: string;
}

// ── Apple ────────────────────────────────────────────────────────────────────

async function verifyApple(body: VerifyBody, env: Env): Promise<VerifyResult> {
  if (!env.APPLE_SHARED_SECRET) {
    throw new Error("APPLE_SHARED_SECRET not configured");
  }
  const payload = {
    "receipt-data": body.receipt,
    "password": env.APPLE_SHARED_SECRET,
    "exclude-old-transactions": true,
  };
  let result = await applePost(APPLE_PROD_URL, payload);
  if (result.status === 21007) {
    // Sandbox receipt sent to prod — retry sandbox.
    result = await applePost(APPLE_SANDBOX_URL, payload);
  }
  if (result.status !== 0) {
    return { ok: false, transactionId: "", reason: `apple status ${result.status}` };
  }

  if (env.IOS_BUNDLE_ID && result.receipt?.bundle_id && result.receipt.bundle_id !== env.IOS_BUNDLE_ID) {
    return { ok: false, transactionId: "", reason: "bundle_id mismatch" };
  }

  // For consumables we look at in_app or latest_receipt_info. Match by
  // product_id and pick the most recent matching transaction.
  const txs = [
    ...(result.receipt?.in_app ?? []),
    ...(result.latest_receipt_info ?? []),
  ];
  const matching = txs
    .filter((t: any) => t.product_id === body.productId)
    .sort((a: any, b: any) => Number(b.purchase_date_ms ?? 0) - Number(a.purchase_date_ms ?? 0));
  if (matching.length === 0) {
    return { ok: false, transactionId: "", reason: "no matching transaction" };
  }
  const tx = matching[0];
  return { ok: true, transactionId: String(tx.transaction_id) };
}

async function applePost(url: string, payload: unknown): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`apple http ${res.status}`);
  return res.json();
}

// ── Google Play ──────────────────────────────────────────────────────────────

async function verifyGoogle(body: VerifyBody, env: Env): Promise<VerifyResult> {
  if (!env.GOOGLE_PLAY_SA_JSON || !env.ANDROID_PACKAGE_NAME) {
    throw new Error("GOOGLE_PLAY_SA_JSON / ANDROID_PACKAGE_NAME not configured");
  }
  const sa = JSON.parse(env.GOOGLE_PLAY_SA_JSON);
  const token = await googleAccessToken(sa);

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.ANDROID_PACKAGE_NAME)}/purchases/products/${encodeURIComponent(body.productId)}/tokens/${encodeURIComponent(body.receipt)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    return { ok: false, transactionId: "", reason: `google http ${res.status}` };
  }
  const data = await res.json<any>();
  // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
  if (data.purchaseState !== 0) {
    return { ok: false, transactionId: "", reason: `purchaseState ${data.purchaseState}` };
  }
  // Use orderId as the transaction id (unique across Play purchases).
  return { ok: true, transactionId: String(data.orderId ?? body.receipt) };
}

async function googleAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  // JWT-Bearer flow for OAuth2 service accounts.
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${enc(header)}.${enc(claims)}`;

  const pem = sa.private_key.replace(/\\n/g, "\n");
  const key = await importPkcs8(pem);
  const sigBuf = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const assertion = `${signingInput}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
  });
  if (!res.ok) throw new Error(`google token ${res.status}: ${await res.text()}`);
  const data = await res.json<any>();
  return data.access_token as string;
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return crypto.subtle.importKey(
    "pkcs8", buf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
}
