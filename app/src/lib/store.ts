// Lightweight cross-page session payload (for Session -> Feedback handoff).

import type { Feedback } from "./gemini-live";

interface PendingFeedback {
  dialect: string;
  scenario: string;
  feedback: Feedback[];
  transcript: { role: "user" | "model"; text: string }[];
  startedAt: number;
  endedAt: number;
}

let lastFeedback: PendingFeedback | null = null;

export function setLastFeedback(f: PendingFeedback) {
  lastFeedback = f;
}
export function getLastFeedback(): PendingFeedback | null {
  return lastFeedback;
}
