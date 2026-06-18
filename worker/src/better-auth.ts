// Self-hosted authentication (Better Auth).
//
// Runs entirely inside this Worker and stores identity in the same D1 database
// as the rest of the app. No third-party auth platform, nothing that pauses on
// inactivity. Better Auth owns four tables (user / session / account /
// verification); the app's own `users` table (credits, seconds, streaks, the
// anonymous device-user model) is untouched. The two are bridged in auth.ts:
// a Better Auth login is mapped onto an app `users` row by email, exactly the
// way external logins map onto local app users.
//
// Login methods: passwordless email OTP + Google + Apple.

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { emailOTP, bearer } from "better-auth/plugins";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { Env } from "./types";
import { sendOtpEmail } from "./email";

// D1-backed rate-limit counter. The auth_rate_limit table is added by
// migrate_betterauth.sql. Keyed by Better Auth's own composite key (IP + path).
function rateLimitStorage(env: Env) {
  return {
    get: async (key: string) => {
      const row = await env.DB.prepare(
        "SELECT count, last_request FROM auth_rate_limit WHERE key = ?",
      ).bind(key).first<{ count: number; last_request: number }>();
      return row ? { key, count: row.count, lastRequest: row.last_request } : undefined;
    },
    set: async (key: string, value: { count: number; lastRequest: number }, isUpdate?: boolean) => {
      if (isUpdate) {
        await env.DB.prepare(
          "UPDATE auth_rate_limit SET count = ?, last_request = ? WHERE key = ?",
        ).bind(value.count, value.lastRequest, key).run();
      } else {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO auth_rate_limit (key, count, last_request) VALUES (?, ?, ?)",
        ).bind(key, value.count, value.lastRequest).run();
      }
    },
  };
}

// One instance per isolate. Workers reuse the isolate across requests and `env`
// is stable for the isolate's lifetime, so memoizing avoids rebuilding the
// Kysely connection and crypto material on every request. Type is inferred from
// the factory so the concrete (plugin-augmented) Auth type is preserved.
let _auth: ReturnType<typeof build> | null = null;

export function getAuth(env: Env) {
  return (_auth ??= build(env));
}

function build(env: Env) {
  const db = new Kysely({ dialect: new D1Dialect({ database: env.DB }) });

  const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) {
    socialProviders.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
      // Lets native iOS "Sign in with Apple" tokens (audience = bundle id) be
      // accepted in addition to the web service-id flow.
      ...(env.IOS_BUNDLE_ID ? { appBundleIdentifier: env.IOS_BUNDLE_ID } : {}),
    };
  }

  return betterAuth({
    database: { db, type: "sqlite" },
    baseURL: env.APP_ORIGIN,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    // SPA on rede.chat, plus the mobile deep-link scheme for Flutter OAuth
    // returns. Add/trim here if the bundle id or scheme changes.
    trustedOrigins: [
      env.APP_ORIGIN,
      "rede://",
    ],
    // Passwordless only — no password storage.
    emailAndPassword: { enabled: false },
    socialProviders,
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24,      // refresh once per day of activity
    },
    // Cloudflare sets cf-connecting-ip as the canonical client address;
    // pin it (and x-forwarded-for as a fallback) so the rate limiter keys
    // off the real user IP instead of seeing all traffic as "no IP".
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
    },
    // Per-IP rate limits. Tight explicit caps on the email-OTP endpoints
    // matter — sending an OTP triggers a real PurelyMail email, so we don't
    // want a stranger's inbox or our SMTP bill weaponised.
    //
    // The counter storage is D1, not Better Auth's default in-memory Map:
    // Workers spawn many short-lived isolates per region, so a per-Map
    // counter never crosses the threshold (5/5 OK in production audit).
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customStorage: rateLimitStorage(env),
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp":                { window: 60, max: 5 },
        "/sign-in/social":                   { window: 60, max: 10 },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60, // 10 minutes
        async sendVerificationOTP({ email, otp, type }) {
          await sendOtpEmail(env, email, otp, type);
        },
      }),
      // Issues a bearer token alongside the cookie so non-browser clients
      // (Flutter) and the WebSocket `?token=` path can authenticate without
      // relying on cookies.
      bearer(),
    ],
  });
}
