import Stripe from "stripe";
import type { Env } from "./types";
import { resolveUser } from "./auth";
import { corsHeaders } from "./api";

export interface MinutePack {
  key: string;
  amountChf: number;
  seconds: number;
  label: string;
}

// Two-tier pricing. Conversations are billed by the second of actual speech,
// so these are upper bounds on a balance, not minimum session lengths.
//   - intro: 2.99 CHF / 30 minutes — sampler tier; 4–7× cheaper than a Swiss
//     German tutor's cheapest rates already, with the highest per-hour margin.
//   - starter: 9.99 CHF / 2 hours — main pack, 17% better per-hour rate than
//     intro. Where most volume should land.
// Margin after Gemini Live (~2.50 CHF/hour) and Stripe (~1.5% + 0.30):
//   intro: ~1.40 net (47%) — best margin
//   starter: ~4.55 net (45%) — best absolute profit
export const MINUTE_PACKS: MinutePack[] = [
  { key: "intro",   amountChf:  299, seconds:  30 * 60, label: "30 minutes" },
  { key: "starter", amountChf:  999, seconds: 120 * 60, label: "2 hours"    },
];

function stripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function handleStripeRoute(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin);

  if (pathname === "/api/credits/packs" && request.method === "GET") {
    return new Response(JSON.stringify({ packs: MINUTE_PACKS }), {
      headers: { "content-type": "application/json", ...cors },
    });
  }

  if (pathname === "/api/credits/checkout" && request.method === "POST") {
    const user = await resolveUser(request, env);
    if (!user) {
      return new Response("missing X-Device-Id", { status: 400, headers: cors });
    }
    const body = await request.json<{ packKey: string }>();
    const pack = MINUTE_PACKS.find((p) => p.key === body.packKey);
    if (!pack) {
      return new Response("unknown pack", { status: 400, headers: cors });
    }

    // If we already have an email on the user row (signed-in user), pre-fill
    // it so Stripe shows it and the receipt routes correctly. Otherwise Stripe
    // Checkout asks for one itself.
    const emailForCheckout = user.email || undefined;

    const stripe = stripeClient(env);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // No payment_method_types: Stripe Checkout shows every method enabled in
      // the dashboard. In CH that means card + TWINT + Apple/Google Pay if you
      // enabled them. Restricting to ["card"] hurts conversion among Swiss
      // customers who default to TWINT.
      line_items: [{
        price_data: {
          currency: "chf",
          product_data: { name: `rede.chat ${pack.label}` },
          unit_amount: pack.amountChf,
        },
        quantity: 1,
      }],
      success_url: `${env.APP_ORIGIN}/credits?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_ORIGIN}/credits?status=cancel`,
      ...(emailForCheckout ? { customer_email: emailForCheckout } : {}),
      metadata: { user_id: user.id, pack_key: pack.key },
    });

    const purchaseId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO purchases (id, user_id, stripe_checkout_id, amount_chf, seconds, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`
    )
      .bind(purchaseId, user.id, session.id, pack.amountChf, pack.seconds)
      .run();

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { "content-type": "application/json", ...cors },
    });
  }

  if (pathname === "/api/stripe/webhook" && request.method === "POST") {
    const sig = request.headers.get("stripe-signature") ?? "";
    const body = await request.text();
    const stripe = stripeClient(env);

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (e) {
      return new Response("invalid signature", { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const purchase = await env.DB.prepare(
        "SELECT * FROM purchases WHERE stripe_checkout_id = ?"
      )
        .bind(session.id)
        .first<{ id: string; user_id: string; seconds: number; status: string }>();
      if (purchase && purchase.status !== "completed") {
        // Critical batch: credit the user and mark the purchase complete.
        // These two must land together; anything else is best-effort.
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE purchases SET status = 'completed', completed_at = datetime('now') WHERE id = ?"
          ).bind(purchase.id),
          env.DB.prepare(
            "UPDATE users SET seconds = seconds + ? WHERE id = ?"
          ).bind(purchase.seconds, purchase.user_id),
        ]);

        // Best-effort: save the Stripe-collected email on the user row, but
        // only if this row currently has no email AND no other row already
        // owns it. The UNIQUE constraint on users.email means a duplicate
        // would otherwise blow up the whole webhook (and the credit, before
        // we split the batch). Logging the conflict so we can fix identity
        // conflation later — usually it's the same human under both an
        // anonymous device-user and a previously-signed-in account.
        const stripeEmail = session.customer_details?.email;
        if (stripeEmail) {
          try {
            const conflict = await env.DB.prepare(
              "SELECT id FROM users WHERE email = ? AND id != ?"
            ).bind(stripeEmail, purchase.user_id).first<{ id: string }>();
            if (conflict) {
              console.warn(
                `[stripe] email ${stripeEmail} already on user ${conflict.id}; ` +
                `skipping write for ${purchase.user_id}. Identity link not made.`
              );
            } else {
              await env.DB.prepare(
                "UPDATE users SET email = ? WHERE id = ? AND email IS NULL"
              ).bind(stripeEmail, purchase.user_id).run();
            }
          } catch (e) {
            console.warn("[stripe] non-fatal email update failed:", e);
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response("not found", { status: 404 });
}
