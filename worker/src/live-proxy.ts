// WebSocket proxy: browser <-> Worker <-> Gemini Live (raw WebSocket).
//
// Protocol with client (browser):
//   - First text msg: {"type":"start","dialect":"zuri","scenario":"migros"}
//   - Subsequent binary frames: raw PCM16 LE @ 16kHz (arrives as Blob in Workers)
//   - Worker sends binary frames back: raw PCM16 LE @ 24kHz (Gemini audio)
//   - Worker sends text frames: transcript / interrupted / feedback / ready / error.

import type { Env } from "./types";
import { assembleSystemPrompt, type PriorError } from "./prompts/assemble";
import { resolveUserFromHeadersAndQuery } from "./auth";

const GEMINI_WS = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const INPUT_RATE = 16000;

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function fetchPriorErrors(env: Env, userId: string, dialect: string): Promise<PriorError[]> {
  const rows = await env.DB.prepare(
    `SELECT feedback_json FROM sessions
     WHERE user_id = ? AND dialect = ? AND feedback_json IS NOT NULL
     ORDER BY started_at DESC LIMIT 3`
  )
    .bind(userId, dialect)
    .all<{ feedback_json: string }>();
  const errors: PriorError[] = [];
  for (const r of rows.results ?? []) {
    try {
      const parsed = JSON.parse(r.feedback_json) as PriorError[];
      if (Array.isArray(parsed)) errors.push(...parsed);
    } catch { /* ignore */ }
    if (errors.length >= 5) break;
  }
  return errors.slice(0, 5);
}

export async function handleLiveProxy(request: Request, env: Env): Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const url = new URL(request.url);
  const resolved = await resolveUserFromHeadersAndQuery(request.headers, url, env);
  if (!resolved) return new Response("Missing device id", { status: 400 });
  const userId = resolved.id;

  const user = await env.DB.prepare("SELECT seconds FROM users WHERE id = ?")
    .bind(userId)
    .first<{ seconds: number }>();
  if (!user || user.seconds <= 0) {
    return new Response("No minutes", { status: 402 });
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();

  // Server-side cap = min(user balance, 15-min hard cap). Prevents a user from
  // talking far longer than they paid for.
  const HARD_CAP = 15 * 60;
  const allowedSeconds = Math.min(user.seconds, HARD_CAP);

  handleSession(server, env, userId, allowedSeconds).catch((err) => {
    console.error("[live-proxy] session error:", err);
    try {
      server.send(JSON.stringify({ type: "error", message: String(err?.message ?? err) }));
      server.close(1011, "internal");
    } catch { /* ignore */ }
  });

  return new Response(null, { status: 101, webSocket: client });
}

async function handleSession(client: WebSocket, env: Env, userId: string, allowedSeconds: number) {
  console.log(`[live-proxy] handleSession start user=${userId} cap=${allowedSeconds}s`);
  let gemini: WebSocket | null = null;
  let sessionId: string | null = null;
  let dialect = "";
  let scenario = "";
  let startedAt = "";
  let tokensInput = 0;
  let tokensOutput = 0;
  let summaryRequested = false;
  let transcriptLines: string[] = [];
  let framesIn = 0;
  let lastLog = Date.now();
  let capTimer: ReturnType<typeof setTimeout> | null = null;

  const finalize = async (feedback: unknown[]) => {
    if (sessionId) {
      await finaliseSession(env, sessionId, userId, startedAt, tokensInput, tokensOutput, feedback);
    }
    try { client.close(1000, "done"); } catch { /* ignore */ }
  };

  const startGemini = async (init: {
    type: "start"; dialect: string; scenario: string;
    sessionId?: string; newsContext?: { title: string; body: string }; knowledge?: string[];
    level?: "A" | "B" | "C";
  }) => {
    dialect = init.dialect;
    scenario = init.scenario;
    startedAt = new Date().toISOString();
    sessionId = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO sessions (id, user_id, dialect, scenario, started_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`
    )
      .bind(sessionId, userId, dialect, scenario, startedAt)
      .run();
    try { client.send(JSON.stringify({ type: "session_id", id: sessionId })); } catch { /* ignore */ }

    const priorErrors = await fetchPriorErrors(env, userId, dialect);
    const systemPrompt = assembleSystemPrompt(
      dialect as any,
      scenario as any,
      priorErrors,
      init.level ?? "C",
    );

    const url = `${GEMINI_WS}?key=${env.GEMINI_API_KEY}`;
    gemini = new WebSocket(url);

    let setupComplete = false;
    gemini.addEventListener("open", () => {
      const setup = {
        setup: {
          model: env.GEMINI_MODEL,
          generationConfig: {
            responseModalities: ["AUDIO"],
            temperature: 1.0,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
          },
          systemInstruction: { parts: [{ text: systemPrompt }] },
          // Match maredan: only turnCoverage, let Gemini use its server-side
          // defaults for VAD and activity handling. Overriding silenceDurationMs
          // or prefixPaddingMs can keep the turn open long enough for the AI's
          // own output (picked up by the speakers) to be re-ingested.
          realtimeInputConfig: {
            turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY",
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      };
      gemini!.send(JSON.stringify(setup));
      console.log("[live-proxy] setup sent");
    });

    gemini.addEventListener("message", async (event: MessageEvent) => {
      // Outbound WS from Worker delivers messages as string or ArrayBuffer
      let text: string;
      if (typeof event.data === "string") {
        text = event.data;
      } else if (event.data instanceof ArrayBuffer) {
        text = new TextDecoder().decode(event.data);
      } else if (typeof Blob !== "undefined" && event.data instanceof Blob) {
        text = await (event.data as Blob).text();
      } else {
        console.log("[live-proxy] gemini msg unknown type:", typeof event.data, (event.data as any)?.constructor?.name);
        return;
      }
      console.log(`[live-proxy] gemini msg len=${text.length}: ${text.slice(0, 500)}`);
      let msg: any;
      try { msg = JSON.parse(text); } catch { return; }

      if (msg.setupComplete) {
        setupComplete = true;
        const contextParts: string[] = [];
        if (init.knowledge?.length) contextParts.push(`[What I know about you]\n${init.knowledge.map((d) => `- ${d}`).join("\n")}`);
        if (init.newsContext) contextParts.push(`[News context]\nTitle: ${init.newsContext.title}\n\n${init.newsContext.body.slice(0, 3000)}`);
        if (contextParts.length) {
          gemini!.send(JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: contextParts.join("\n\n") }] }],
              turnComplete: true,
            },
          }));
        }
        try { client.send(JSON.stringify({ type: "ready" })); } catch { /* ignore */ }
        // Arm the server-side credit cap. Force-close the session when the
        // user runs out of seconds.
        if (capTimer) clearTimeout(capTimer);
        capTimer = setTimeout(() => {
          console.log(`[live-proxy] credit cap (${allowedSeconds}s) reached, ending session`);
          requestSummary().catch((e) => {
            console.error("[live-proxy] cap-triggered summary failed:", e);
            try { client.close(1000, "cap reached"); } catch { /* ignore */ }
          });
        }, allowedSeconds * 1000);
        return;
      }

      const sc = msg.serverContent;
      if (sc) {
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.inlineData?.data && !summaryRequested) {
              const bytes = base64ToBytes(part.inlineData.data);
              try { client.send(bytes.buffer as ArrayBuffer); } catch { /* ignore */ }
            }
          }
        }
        if (sc.inputTranscription?.text && !summaryRequested) {
          transcriptLines.push(`User: ${sc.inputTranscription.text}`);
          try { client.send(JSON.stringify({ type: "transcript", role: "user", text: sc.inputTranscription.text })); } catch { /* ignore */ }
        }
        if (sc.outputTranscription?.text && !summaryRequested) {
          transcriptLines.push(`AI: ${sc.outputTranscription.text}`);
          try { client.send(JSON.stringify({ type: "transcript", role: "model", text: sc.outputTranscription.text })); } catch { /* ignore */ }
        }
        if (sc.interrupted) {
          try { client.send(JSON.stringify({ type: "interrupted" })); } catch { /* ignore */ }
        }
        // Signal end of an AI's response — the client uses this to switch
        // playback from buffering to playable WAV blob. generationComplete
        // fires once the model finishes producing audio; turnComplete fires
        // later when the whole exchange ends.
        if (sc.generationComplete) {
          try { client.send(JSON.stringify({ type: "ai_turn_end" })); } catch { /* ignore */ }
        }
      }

      if (msg.usageMetadata) {
        tokensInput = msg.usageMetadata.promptTokenCount ?? tokensInput;
        tokensOutput = msg.usageMetadata.responseTokenCount ?? msg.usageMetadata.candidatesTokenCount ?? tokensOutput;
      }
    });

    gemini.addEventListener("close", async (e: any) => {
      console.log("[live-proxy] gemini close", e?.code, e?.reason);
      if (sessionId && !summaryRequested) {
        await finalize([]);
      }
    });

    gemini.addEventListener("error", (e: any) => {
      console.error("[live-proxy] gemini error:", e?.message ?? e);
      try { client.send(JSON.stringify({ type: "error", message: String(e?.message ?? e) })); } catch { /* ignore */ }
    });
  };

  // End the session cleanly. We used to ask the model for a JSON summary of
  // corrections, but that flow was unreliable (model would speak the JSON
  // aloud under AUDIO modality, partial output crashed parsing). To be
  // replaced by a tool-call once Gemini Live function calling is wired in.
  const requestSummary = async () => {
    if (summaryRequested) return;
    summaryRequested = true;
    if (capTimer) { clearTimeout(capTimer); capTimer = null; }
    try { gemini?.close(); } catch { /* ignore */ }
    try { client.send(JSON.stringify({ type: "feedback", feedback: [] })); } catch { /* ignore */ }
    if (sessionId) {
      await finaliseSession(env, sessionId, userId, startedAt, tokensInput, tokensOutput, []);
    }
    try { client.close(1000, "done"); } catch { /* ignore */ }
  };

  const forwardAudio = async (data: any) => {
    if (!gemini || gemini.readyState !== 1) return;
    let buf: ArrayBuffer;
    if (data instanceof ArrayBuffer) {
      buf = data;
    } else if (typeof Blob !== "undefined" && data instanceof Blob) {
      buf = await data.arrayBuffer();
    } else if (data instanceof Uint8Array) {
      // .buffer is ArrayBuffer | SharedArrayBuffer in newer lib.dom types; a
      // WebSocket payload is never the latter, so narrow with a cast.
      buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    } else {
      return;
    }
    framesIn++;
    const b64 = bytesToBase64(new Uint8Array(buf));
    try {
      gemini.send(JSON.stringify({
        realtimeInput: {
          audio: { mimeType: "audio/pcm", data: b64 },
        },
      }));
    } catch (e) { console.error("[live-proxy] gemini send failed:", e); }
    if (Date.now() - lastLog > 2000) {
      console.log(`[live-proxy] frames in=${framesIn} bytes/frame=${buf.byteLength}`);
      lastLog = Date.now();
    }
  };

  client.addEventListener("message", (event: MessageEvent) => {
    if (typeof event.data === "string") {
      let msg: any;
      try { msg = JSON.parse(event.data); } catch { return; }
      console.log("[live-proxy] client msg:", msg.type);
      if (msg.type === "start" && !gemini) {
        startGemini(msg).catch((e) => {
          console.error("[live-proxy] startGemini error:", e);
          try { client.send(JSON.stringify({ type: "error", message: String(e?.message ?? e) })); } catch { /* ignore */ }
          try { client.close(1011, "start failed"); } catch { /* ignore */ }
        });
      } else if (msg.type === "stop") {
        requestSummary();
      } else if (msg.type === "context" && typeof msg.text === "string" && gemini && gemini.readyState === 1) {
        // Inject text context into the conversation without triggering a
        // model response (turnComplete: false). Used for level switches,
        // user-profile updates, app-state hints, etc.
        try {
          gemini.send(JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: `[System context]: ${msg.text}` }] }],
              turnComplete: false,
            },
          }));
        } catch (e) { console.error("[live-proxy] context send failed:", e); }
      }
    } else {
      forwardAudio(event.data);
    }
  });

  client.addEventListener("close", async () => {
    if (capTimer) { clearTimeout(capTimer); capTimer = null; }
    if (sessionId && !summaryRequested) {
      await finaliseSession(env, sessionId, userId, startedAt, tokensInput, tokensOutput, []);
    }
    try { gemini?.close(); } catch { /* ignore */ }
  });
}

function isValidSessionId(id: string | undefined): boolean {
  return typeof id === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(id);
}

async function finaliseSession(
  env: Env,
  sessionId: string,
  userId: string,
  startedAt: string,
  tokensInput: number,
  tokensOutput: number,
  feedback: unknown[]
) {
  const endedAt = new Date().toISOString();
  const duration = Math.floor((Date.parse(endedAt) - Date.parse(startedAt)) / 1000);

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE sessions SET ended_at = ?, duration_seconds = ?, tokens_input = ?, tokens_output = ?,
       seconds_used = ?, feedback_json = ? WHERE id = ? AND user_id = ?`
    ).bind(endedAt, duration, tokensInput, tokensOutput, duration, JSON.stringify(feedback), sessionId, userId),
    env.DB.prepare(
      `UPDATE users SET seconds = MAX(0, seconds - ?) WHERE id = ?`
    ).bind(duration, userId),
  ]);

  await updateStreak(env, userId);
}

async function updateStreak(env: Env, userId: string) {
  const user = await env.DB.prepare("SELECT last_session_date, current_streak, longest_streak FROM users WHERE id = ?")
    .bind(userId)
    .first<{ last_session_date: string | null; current_streak: number; longest_streak: number }>();
  if (!user) return;

  const todayZurich = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });
  if (user.last_session_date === todayZurich) return;

  let newStreak = 1;
  if (user.last_session_date) {
    const yesterday = new Date(todayZurich);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toLocaleDateString("en-CA");
    if (user.last_session_date === yStr) newStreak = user.current_streak + 1;
  }
  const longest = Math.max(user.longest_streak, newStreak);

  await env.DB.prepare(
    `UPDATE users SET last_session_date = ?, current_streak = ?, longest_streak = ? WHERE id = ?`
  )
    .bind(todayZurich, newStreak, longest, userId)
    .run();
}
