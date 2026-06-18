export interface KnowledgeItem {
  id: string;
  text: string;
  created_at: string;
}

export interface KnowledgeStore {
  enabled: boolean;
  items: KnowledgeItem[];
}

const KEY = "rede:knowledge";

export function loadKnowledge(): KnowledgeStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { enabled: true, items: [] };
}

function save(store: KnowledgeStore) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function setKnowledgeEnabled(enabled: boolean) {
  const store = loadKnowledge();
  store.enabled = enabled;
  save(store);
}

export function addKnowledgeItem(text: string): KnowledgeItem {
  const store = loadKnowledge();
  const item: KnowledgeItem = { id: crypto.randomUUID(), text: text.trim(), created_at: new Date().toISOString() };
  store.items = [item, ...store.items];
  save(store);
  return item;
}

export function deleteKnowledgeItem(id: string) {
  const store = loadKnowledge();
  store.items = store.items.filter((i) => i.id !== id);
  save(store);
}
