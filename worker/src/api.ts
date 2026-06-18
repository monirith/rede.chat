import type { Env } from "./types";
import { resolveUser } from "./auth";
import { DIALECT_LIST } from "./prompts/dialects";
import { SCENARIO_LIST } from "./prompts/scenarios";

const ALLOWED_ORIGINS = new Set([
  "https://rede.chat",
  "https://www.rede.chat",
]);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://rede.chat";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Device-Id",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

export function corsPreflight(origin: string | null = null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function handleApi(request: Request, env: Env, pathname: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return corsPreflight(origin);

  // Public endpoints — no user resolution needed
  if (pathname === "/api/dialects" && request.method === "GET") {
    return json({
      dialects: DIALECT_LIST.map((d) => ({
        key: d.key, name: d.name, region: d.region, speakers: d.speakers,
      })),
    }, 200, origin);
  }
  if (pathname === "/api/scenarios" && request.method === "GET") {
    return json({
      scenarios: SCENARIO_LIST.map((s) => ({
        key: s.key, name: s.name, description: s.description,
      })),
    }, 200, origin);
  }

  // All other endpoints work for anonymous (device-id) and signed-in users
  const user = await resolveUser(request, env);
  if (!user) return json({ error: "missing X-Device-Id" }, 400, origin);
  const userId = user.id;

  if (pathname === "/api/me" && request.method === "GET") {
    const row = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(userId)
      .first();
    return json({ user: row, signedIn: user.signedIn }, 200, origin);
  }

  if (pathname === "/api/me" && request.method === "PATCH") {
    const body = await request.json<any>();
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : null;
    await env.DB.prepare("UPDATE users SET name = ? WHERE id = ?")
      .bind(name || null, userId)
      .run();
    return json({ ok: true }, 200, origin);
  }

  if (pathname === "/api/history" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT id, dialect, scenario, started_at, ended_at, duration_seconds,
              seconds_used, feedback_json
       FROM sessions
       WHERE user_id = ? AND ended_at IS NOT NULL
       ORDER BY started_at DESC LIMIT 50`
    )
      .bind(userId)
      .all();
    return json({ sessions: rows.results ?? [] }, 200, origin);
  }

  if (pathname.startsWith("/api/session/") && request.method === "GET") {
    const id = pathname.split("/").pop();
    const row = await env.DB.prepare(
      "SELECT * FROM sessions WHERE id = ? AND user_id = ?"
    )
      .bind(id, userId)
      .first();
    if (!row) return json({ error: "not found" }, 404, origin);
    return json({ session: row }, 200, origin);
  }

  if (pathname === "/api/phrasebook" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT id, dialect, expression, standard_german, explanation, saved_at, source_session_id
       FROM vocabulary
       WHERE user_id = ?
       ORDER BY saved_at DESC LIMIT 500`
    )
      .bind(userId)
      .all();
    return json({ vocabulary: rows.results ?? [] }, 200, origin);
  }

  if (pathname === "/api/phrasebook" && request.method === "POST") {
    const body = await request.json<any>();
    const dialect = typeof body.dialect === "string" ? body.dialect.slice(0, 32) : null;
    const expression = typeof body.expression === "string" ? body.expression.slice(0, 500) : null;
    const standard_german = typeof body.standard_german === "string" ? body.standard_german.slice(0, 500) : null;
    const explanation = typeof body.explanation === "string" ? body.explanation.slice(0, 2000) : "";
    const source_session_id = typeof body.source_session_id === "string" ? body.source_session_id.slice(0, 64) : null;
    if (!dialect || !expression || !standard_german) {
      return json({ error: "missing fields" }, 400, origin);
    }
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO vocabulary (id, user_id, dialect, expression, standard_german, explanation, source_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, userId, dialect, expression, standard_german, explanation, source_session_id)
      .run();
    return json({ id }, 200, origin);
  }

  if (pathname.startsWith("/api/phrasebook/") && request.method === "DELETE") {
    const id = pathname.split("/").pop();
    await env.DB.prepare("DELETE FROM vocabulary WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .run();
    return json({ ok: true }, 200, origin);
  }

  if (pathname === "/api/progress" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT dialect,
              COUNT(*) as session_count,
              COALESCE(SUM(duration_seconds), 0) as total_seconds
       FROM sessions
       WHERE user_id = ? AND ended_at IS NOT NULL
       GROUP BY dialect
       ORDER BY total_seconds DESC`
    )
      .bind(userId)
      .all();
    return json({ progress: rows.results ?? [] }, 200, origin);
  }

  return json({ error: "not found" }, 404, origin);
}
