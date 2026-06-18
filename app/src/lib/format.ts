export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "-";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatBalance(seconds: number | null | undefined, minutesLabel: string, secondsLabel: string): string {
  if (seconds == null) return "-";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (s === 0) return `${m} ${minutesLabel}`;
  return `${m} ${minutesLabel} ${s} ${secondsLabel}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("de-CH", { day: "numeric", month: "short" })
    + ", " + d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}
