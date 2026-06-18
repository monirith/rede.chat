// Auth resolution — two SEPARATE identities can exist on the same device:
//
//   1. Anonymous device-user: client sends `X-Device-Id: <uuid>`. Worker
//      upserts a row with id = "dev_<uuid>", auth_sub = NULL. Owns its own
//      seconds, sessions, vocab.
//
//   2. Signed-in JWT user: client sends `Authorization: Bearer <session-token>`
//      issued by Better Auth (or the session cookie same-origin on web). The
//      Worker resolves the session and finds/creates a row with id =
//      "usr_<uuid>" and auth_sub = <better-auth user id>. Owns its own data,
//      separate from the device-user.
//
// First-time sign-in (no row exists for this auth_sub yet) is treated as
// "create account" — we move the device-user's seconds, sessions and vocab
// into the new JWT user, then reset the device-user (so the anonymous identity
// starts fresh). Subsequent sign-ins do NOT touch the device-user: the user
// keeps two separate identities on the same device.

import type { Env, UserRow } from "./types";
import { getAuth } from "./better-auth";

// Minimal shape the app needs from an authenticated identity. Better Auth's
// session gives us a stable user id (used as `auth_sub`) and the verified
// email. Everything else (credits, device merge, welcome bonus) is derived
// from the app's own `users` table below.
interface AuthIdentity {
  sub: string;
  email?: string | null;
}

export const DEVICE_ID_RE = /^[A-Za-z0-9_-]{16,128}$/;

function deviceUserId(deviceId: string): string {
  return `dev_${deviceId}`;
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function upsertDeviceUser(env: Env, deviceId: string, ip: string | null): Promise<UserRow> {
  const id = deviceUserId(deviceId);
  const existing = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first<UserRow>();

  const bonus = parseInt(env.ANON_WELCOME_SECONDS ?? "0", 10);
  const ipHash = ip ? await hashIp(ip, env.IP_HASH_SALT || "rede-anon-salt") : null;

  // One anon welcome bonus per IP, ever. Without this, clearing localStorage
  // or opening an Incognito window mints a fresh device-id and a fresh bonus.
  // Households behind NAT lose out, but that's acceptable: anyone can still
  // get the full 10 min by creating an account.
  async function alreadyClaimedOnThisIp(): Promise<boolean> {
    if (!ipHash) return false;
    const prev = await env.DB.prepare(
      `SELECT 1 FROM users
       WHERE ip_hash = ?
         AND id != ?
         AND welcome_credits_granted_at IS NOT NULL
       LIMIT 1`
    ).bind(ipHash, id).first();
    return !!prev;
  }

  if (existing) {
    // Retroactively grant the bonus once to old rows that predated it, unless
    // another device on the same IP has already claimed it.
    if (bonus > 0 && !existing.welcome_credits_granted_at && !(await alreadyClaimedOnThisIp())) {
      await env.DB.prepare(
        `UPDATE users SET seconds = seconds + ?, ip_hash = COALESCE(ip_hash, ?),
            welcome_credits_granted_at = ?
         WHERE id = ? AND welcome_credits_granted_at IS NULL`
      )
        .bind(bonus, ipHash, new Date().toISOString(), id)
        .run();
    } else if (ipHash && !existing.ip_hash) {
      await env.DB.prepare("UPDATE users SET ip_hash = ? WHERE id = ?").bind(ipHash, id).run();
    }
  } else {
    const grant = bonus > 0 && !(await alreadyClaimedOnThisIp());
    await env.DB.prepare(
      `INSERT INTO users (id, seconds, ip_hash, welcome_credits_granted_at)
       VALUES (?, ?, ?, ?)`
    )
      .bind(id, grant ? bonus : 0, ipHash, grant ? new Date().toISOString() : null)
      .run();
  }

  return (await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>())!;
}

async function grantWelcomeBonus(env: Env, userId: string): Promise<void> {
  // One-time welcome credits on first sign-in. Atomically guarded by the
  // welcome_credits_granted_at column: only fires when it is currently NULL.
  const bonus = parseInt(env.WELCOME_SECONDS ?? "0", 10);
  if (!bonus || bonus <= 0) return;
  await env.DB.prepare(
    `UPDATE users
     SET seconds = seconds + ?, welcome_credits_granted_at = datetime('now')
     WHERE id = ? AND welcome_credits_granted_at IS NULL`
  )
    .bind(bonus, userId)
    .run();
}

async function resolveJwtUser(env: Env, jwt: AuthIdentity, deviceId: string | null): Promise<UserRow> {
  // Existing JWT user → return as-is. Device-user is NOT touched. The user
  // can have an anonymous identity on this device that lives in parallel.
  const existing = await env.DB.prepare("SELECT * FROM users WHERE auth_sub = ?")
    .bind(jwt.sub)
    .first<UserRow>();
  if (existing) {
    // Legacy migration: under the old auth model, the JWT user row reused the
    // anonymous device-user's id (`dev_<deviceId>`). Detect this and split
    // the row so the device-user becomes empty/anonymous again and the JWT
    // user gets a fresh `usr_<uuid>` id.
    if (existing.id.startsWith("dev_")) {
      const newId = `usr_${crypto.randomUUID()}`;
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO users (id, name, email, auth_sub, seconds,
              current_streak, longest_streak, last_session_date,
              welcome_credits_granted_at, created_at)
           SELECT ?, name, email, auth_sub, seconds,
              current_streak, longest_streak, last_session_date,
              welcome_credits_granted_at, created_at
           FROM users WHERE id = ?`
        ).bind(newId, existing.id),
        env.DB.prepare(
          `UPDATE users SET auth_sub = NULL, email = NULL, name = NULL,
              seconds = 0, current_streak = 0, longest_streak = 0,
              last_session_date = NULL, welcome_credits_granted_at = NULL
           WHERE id = ?`
        ).bind(existing.id),
        env.DB.prepare("UPDATE sessions SET user_id = ? WHERE user_id = ?").bind(newId, existing.id),
        env.DB.prepare("UPDATE vocabulary SET user_id = ? WHERE user_id = ?").bind(newId, existing.id),
      ]);
      return (await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(newId).first<UserRow>())!;
    }
    return existing;
  }

  // First-time sign-in for this JWT sub = "create account".
  //
  // Before inserting fresh, check whether an orphan row already owns this
  // email. That happens in the "anonymous Stripe purchase" path: the buyer
  // paid without signing in, Stripe collected an email, but the webhook
  // skipped writing it because another row already held that address. Now
  // that the human signs in under that email, we adopt the orphan row
  // instead of inserting fresh (which would hit the UNIQUE constraint and
  // fail signup). Bought credits carry forward.
  let targetId: string;
  let orphanByEmail: UserRow | null = null;

  if (jwt.email) {
    orphanByEmail = await env.DB.prepare(
      "SELECT * FROM users WHERE email = ? AND auth_sub IS NULL"
    ).bind(jwt.email).first<UserRow>();
  }

  if (orphanByEmail) {
    await env.DB.prepare(
      "UPDATE users SET auth_sub = ? WHERE id = ?"
    ).bind(jwt.sub, orphanByEmail.id).run();
    targetId = orphanByEmail.id;
  } else {
    const newId = `usr_${crypto.randomUUID()}`;
    try {
      await env.DB.prepare(
        "INSERT INTO users (id, email, auth_sub, seconds) VALUES (?, ?, ?, 0)"
      )
        .bind(newId, jwt.email ?? null, jwt.sub)
        .run();
    } catch (e) {
      // Email already on a row with a different auth_sub: real identity
      // collision (two sessions, same email). Fall back to inserting
      // without email so signup still succeeds; the row can be reconciled
      // by hand from the log line.
      console.warn(
        `[auth] could not insert user with email ${jwt.email} for sub ${jwt.sub}: ` +
        `${e}. Inserted without email, manual reconciliation needed.`
      );
      await env.DB.prepare(
        "INSERT INTO users (id, email, auth_sub, seconds) VALUES (?, NULL, ?, 0)"
      ).bind(newId, jwt.sub).run();
    }
    targetId = newId;
  }

  await grantWelcomeBonus(env, targetId);

  if (deviceId && DEVICE_ID_RE.test(deviceId)) {
    const devId = deviceUserId(deviceId);
    const devUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(devId)
      .first<UserRow>();
    if (devUser && devUser.id !== targetId) {
      // Move seconds, sessions, vocab, purchases from the device-user to the
      // target row. Streak data carries over too.
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE users SET seconds = seconds + ?,
              current_streak = MAX(current_streak, ?),
              longest_streak = MAX(longest_streak, ?),
              last_session_date = COALESCE(?, last_session_date)
           WHERE id = ?`
        ).bind(
          devUser.seconds ?? 0,
          devUser.current_streak ?? 0,
          devUser.longest_streak ?? 0,
          devUser.last_session_date ?? null,
          targetId
        ),
        env.DB.prepare(
          `UPDATE users SET seconds = 0, current_streak = 0, longest_streak = 0,
              last_session_date = NULL
           WHERE id = ?`
        ).bind(devId),
        env.DB.prepare("UPDATE sessions SET user_id = ? WHERE user_id = ?").bind(targetId, devId),
        env.DB.prepare("UPDATE vocabulary SET user_id = ? WHERE user_id = ?").bind(targetId, devId),
        env.DB.prepare("UPDATE purchases SET user_id = ? WHERE user_id = ?").bind(targetId, devId),
      ]);
    }
  }

  return (await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(targetId).first<UserRow>())!;
}

export interface ResolvedUser {
  id: string;
  email: string | null;
  signedIn: boolean;
}

/**
 * Resolve the user for a given request. Returns null only if neither auth
 * header nor device-id was supplied (or both are invalid). Anonymous users
 * are auto-created on first sight.
 */
export async function resolveUser(request: Request, env: Env): Promise<ResolvedUser | null> {
  return resolveUserFromHeadersAndQuery(request.headers, new URL(request.url), env);
}

export async function resolveUserFromHeadersAndQuery(
  headers: Headers,
  url: URL,
  env: Env
): Promise<ResolvedUser | null> {
  const deviceId =
    headers.get("X-Device-Id") ??
    url.searchParams.get("device") ??
    null;

  const ip = headers.get("CF-Connecting-IP") ?? headers.get("X-Forwarded-For")?.split(",")[0].trim() ?? null;

  // Better Auth reads the session from cookies or an `Authorization: Bearer`
  // header. WebSocket clients can't set headers, so they pass the bearer token
  // as `?token=`; fold that into a synthetic header for getSession.
  const authHeaders = new Headers(headers);
  const tokenFromQuery = url.searchParams.get("token");
  if (tokenFromQuery && !authHeaders.get("Authorization")) {
    authHeaders.set("Authorization", `Bearer ${tokenFromQuery}`);
  }

  try {
    const session = await getAuth(env).api.getSession({ headers: authHeaders });
    if (session?.user) {
      const user = await resolveJwtUser(
        env,
        { sub: session.user.id, email: session.user.email },
        deviceId
      );
      return { id: user.id, email: user.email, signedIn: true };
    }
  } catch (e) {
    // Never let an auth lookup failure block the anonymous fallback below.
    console.warn("[auth] getSession failed, falling back to device user:", e);
  }

  if (deviceId && DEVICE_ID_RE.test(deviceId)) {
    const user = await upsertDeviceUser(env, deviceId, ip);
    return { id: user.id, email: user.email, signedIn: false };
  }

  return null;
}
