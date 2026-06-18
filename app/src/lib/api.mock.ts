// Mock API — returns hardcoded data for local dev without a running Worker.
// Toggle with VITE_MOCK=true in .env.local

import type { UserInfo, SessionSummary, VocabRow, ProgressRow, CreditPack } from "./api";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

const MOCK_USER: UserInfo = {
  id: "mock-user-1",
  name: "Felix Müller",
  email: "felix.mueller@example.ch",
  seconds: 3600,
  current_streak: 5,
  longest_streak: 12,
  last_session_date: "2026-05-14",
  created_at: "2026-01-01T00:00:00Z",
};

const MOCK_SESSIONS: SessionSummary[] = [
  {
    id: "sess-001",
    dialect: "zuri",
    scenario: "migros",
    started_at: "2026-05-14T09:12:00Z",
    ended_at: "2026-05-14T09:27:00Z",
    duration_seconds: 900,
    seconds_used: 900,
    feedback_json: JSON.stringify([
      { said: "Ich habe ein Brot gekauft", correction: "Ich ha es Brot kauft", why: "Perfekt with 'ha' not 'habe', and kauft not gekauft in Züridütsch" },
      { said: "Wie viel kostet das?", correction: "Was choschtet das?", why: "'choschtet' is the Züridütsch form of 'kostet'" },
    ]),
  },
  {
    id: "sess-002",
    dialect: "bern",
    scenario: "beiz",
    started_at: "2026-05-13T19:45:00Z",
    ended_at: "2026-05-13T20:00:00Z",
    duration_seconds: 900,
    seconds_used: 900,
    feedback_json: JSON.stringify([]),
  },
  {
    id: "sess-003",
    dialect: "basel",
    scenario: "tram",
    started_at: "2026-05-12T08:30:00Z",
    ended_at: "2026-05-12T08:45:00Z",
    duration_seconds: 900,
    seconds_used: 900,
    feedback_json: null,
  },
];

const MOCK_VOCAB: VocabRow[] = [
  { id: "v-1", dialect: "zuri", expression: "Was choschtet das?", standard_german: "Was kostet das?", explanation: "choschtet is the Züridütsch form of kostet", saved_at: "2026-05-14T09:27:00Z", source_session_id: "sess-001" },
  { id: "v-2", dialect: "zuri", expression: "Ich ha es Brot kauft", standard_german: "Ich habe ein Brot gekauft", explanation: "Perfekt uses 'ha' and past participle without ge- prefix", saved_at: "2026-05-14T09:27:00Z", source_session_id: "sess-001" },
  { id: "v-3", dialect: "bern", expression: "äuä", standard_german: "wohl / vielleicht", explanation: "Very Bernese expression of probability or agreement", saved_at: "2026-05-13T20:00:00Z", source_session_id: "sess-002" },
];

const MOCK_PROGRESS: ProgressRow[] = [
  { dialect: "zuri", session_count: 8, total_seconds: 7200 },
  { dialect: "bern", session_count: 3, total_seconds: 2700 },
  { dialect: "basel", session_count: 1, total_seconds: 900 },
];

const MOCK_PACKS: CreditPack[] = [
  { key: "intro",   amountChf: 299, seconds: 1800, label: "30 minutes" },
  { key: "starter", amountChf: 999, seconds: 7200, label: "2 hours" },
];

export const mockApi = {
  me: async () => { await delay(); return { user: MOCK_USER }; },
  updateMe: async (data: { name?: string }) => { await delay(100); if (data.name !== undefined) MOCK_USER.name = data.name || null; return { ok: true as const }; },
  history: async () => { await delay(); return { sessions: MOCK_SESSIONS }; },
  session: async (id: string) => { await delay(); const s = MOCK_SESSIONS.find((s) => s.id === id); return { session: { ...s!, transcript_text: null, tokens_input: 1200, tokens_output: 800 } }; },
  phrasebook: async () => { await delay(); return { vocabulary: MOCK_VOCAB }; },
  savePhrase: async (data: Omit<VocabRow, "id" | "saved_at">) => { await delay(100); return { id: `v-${Date.now()}` }; },
  deletePhrase: async (_id: string) => { await delay(100); return { ok: true as const }; },
  progress: async () => { await delay(); return { progress: MOCK_PROGRESS }; },
  packs: async () => { await delay(); return { packs: MOCK_PACKS }; },
  checkout: async (_packKey: string, _email?: string) => { await delay(500); return { url: "/credits?status=success" }; },
};
