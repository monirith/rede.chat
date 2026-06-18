// Anonymous device identity. No account required. Persists in localStorage.
// When the user signs in later, the Worker links the JWT to this device-id
// so credits / history / phrasebook carry over.

const KEY = "rede:device-id";

function generate(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for old environments
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function getDeviceId(): string {
  if (typeof localStorage === "undefined") return generate();
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = generate();
    localStorage.setItem(KEY, id);
  }
  return id;
}
