import type { Env } from "./types";
import { handleLiveProxy } from "./live-proxy";
import { handleApi, corsPreflight, corsHeaders } from "./api";
import { handleStripeRoute } from "./stripe";
import { handleIapVerify } from "./iap";
import { getAuth } from "./better-auth";


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    try {
      if (request.method === "OPTIONS") return corsPreflight(origin);

      if (url.pathname === "/ws/live") {
        return await handleLiveProxy(request, env);
      }

      // Self-hosted auth: Better Auth owns everything under /api/auth/*
      // (OTP issue/verify, OAuth start/callback, session, sign-out).
      if (url.pathname.startsWith("/api/auth/")) {
        return await getAuth(env).handler(request);
      }

      if (url.pathname === "/api/credits/packs"
        || url.pathname === "/api/credits/checkout"
        || url.pathname === "/api/stripe/webhook") {
        return await handleStripeRoute(request, env, url.pathname);
      }

      if (url.pathname === "/api/iap/verify" && request.method === "POST") {
        return await handleIapVerify(request, env);
      }

      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url.pathname);
      }

      if (url.pathname === "/" || url.pathname === "/health") {
        return new Response(JSON.stringify({ ok: true, service: "rede-worker" }), {
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("not found", { status: 404 });
    } catch (err) {
      // Any unhandled exception must still return CORS headers, otherwise the
      // browser reports a misleading "No Access-Control-Allow-Origin" error
      // instead of the actual 500.
      const message = err instanceof Error ? err.message : String(err);
      console.error("[worker] unhandled error:", message, err instanceof Error ? err.stack : "");
      return new Response(JSON.stringify({ error: "internal", message }), {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders(origin) },
      });
    }
  },
};
