// Browser-local store of per-session user mic audio (raw WAV blobs).
// Lives in IndexedDB so it survives navigations and reloads on the same device.
// We don't sync to the server — these recordings are private, locally-scoped
// proof of "what the user actually said." Gemini's input transcription is
// frequently wrong on Mundart, so the wav is the authoritative record.
//
// Schema:
//   key   = `${sessionId}:${turnIdx}`
//   value = { blob: Blob; createdAt: number; sessionId: string; turnIdx: number; durationMs: number }

const DB_NAME = "rede-audio";
const STORE_NAME = "user-turns";
const DB_VERSION = 1;

export interface UserTurnRecord {
  sessionId: string;
  turnIdx: number;
  blob: Blob;
  durationMs: number;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("by_session", "sessionId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putUserTurn(rec: UserTurnRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const id = `${rec.sessionId}:${rec.turnIdx}`;
    store.put({ id, ...rec });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getUserTurn(sessionId: string, turnIdx: number): Promise<UserTurnRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(`${sessionId}:${turnIdx}`);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getUserTurnsForSession(sessionId: string): Promise<UserTurnRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.index("by_session").getAll(sessionId);
    req.onsuccess = () => {
      db.close();
      const rows = (req.result ?? []) as UserTurnRecord[];
      rows.sort((a, b) => a.turnIdx - b.turnIdx);
      resolve(rows);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function deleteSessionAudio(sessionId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.index("by_session").getAllKeys(sessionId);
    req.onsuccess = () => {
      for (const key of req.result as IDBValidKey[]) {
        store.delete(key);
      }
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
