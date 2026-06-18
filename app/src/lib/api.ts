import { config } from "./config";
import { authHeader } from "./auth";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${config.workerUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...authHeader(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
  seconds: number;
  current_streak: number;
  longest_streak: number;
  last_session_date: string | null;
  created_at: string;
}
export interface SessionSummary {
  id: string; dialect: string; scenario: string;
  started_at: string; ended_at: string | null;
  duration_seconds: number | null; seconds_used: number;
  feedback_json: string | null;
}
export interface FullSession extends SessionSummary {
  transcript_text: string | null;
  tokens_input: number; tokens_output: number;
}
export interface VocabRow {
  id: string; dialect: string; expression: string;
  standard_german: string; explanation: string;
  saved_at: string; source_session_id: string | null;
}
export interface ProgressRow {
  dialect: string; session_count: number; total_seconds: number;
}
export interface CreditPack {
  key: string; amountChf: number; seconds: number; label: string;
}

const realApi = {
  me: () => req<{ user: UserInfo }>("/api/me"),
  updateMe: (data: { name?: string }) =>
    req<{ ok: true }>("/api/me", { method: "PATCH", body: JSON.stringify(data) }),
  history: () => req<{ sessions: SessionSummary[] }>("/api/history"),
  session: (id: string) => req<{ session: FullSession }>(`/api/session/${id}`),
  phrasebook: () => req<{ vocabulary: VocabRow[] }>("/api/phrasebook"),
  savePhrase: (data: Omit<VocabRow, "id" | "saved_at">) =>
    req<{ id: string }>("/api/phrasebook", { method: "POST", body: JSON.stringify(data) }),
  deletePhrase: (id: string) =>
    req<{ ok: true }>(`/api/phrasebook/${id}`, { method: "DELETE" }),
  progress: () => req<{ progress: ProgressRow[] }>("/api/progress"),
  packs: () => req<{ packs: CreditPack[] }>("/api/credits/packs"),
  checkout: (packKey: string) =>
    req<{ url: string }>("/api/credits/checkout", {
      method: "POST",
      body: JSON.stringify({ packKey }),
    }),
};

import { mockApi } from "./api.mock";
export const api = import.meta.env.VITE_MOCK === "true" ? mockApi : realApi;
