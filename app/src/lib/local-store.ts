// Local-only conversation storage. Transcripts live on this device — they
// never travel to the server. If the user clears browser data, they lose
// the transcripts (but the session metadata + feedback remain server-side).

export interface TranscriptTurn {
  role: "user" | "model";
  text: string;
}

export interface LocalTranscript {
  sessionId: string;
  dialect: string;
  scenario: string;
  startedAt: number;
  endedAt: number;
  turns: TranscriptTurn[];
}

const PREFIX = "rede:transcript:";

export function saveTranscript(t: LocalTranscript): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PREFIX + t.sessionId, JSON.stringify(t));
  } catch (e) {
    // Quota exceeded — drop the oldest entries
    pruneOldest(20);
    try { localStorage.setItem(PREFIX + t.sessionId, JSON.stringify(t)); } catch { /* give up */ }
  }
}

export function getTranscript(sessionId: string): LocalTranscript | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(PREFIX + sessionId);
  if (!raw) return null;
  try { return JSON.parse(raw) as LocalTranscript; } catch { return null; }
}

export function deleteTranscript(sessionId: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(PREFIX + sessionId);
}

export function listTranscriptIds(): string[] {
  if (typeof localStorage === "undefined") return [];
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) out.push(key.slice(PREFIX.length));
  }
  return out;
}

function pruneOldest(keep: number) {
  if (typeof localStorage === "undefined") return;
  const entries: LocalTranscript[] = [];
  for (const id of listTranscriptIds()) {
    const t = getTranscript(id);
    if (t) entries.push(t);
  }
  entries.sort((a, b) => b.endedAt - a.endedAt);
  for (const e of entries.slice(keep)) deleteTranscript(e.sessionId);
}
