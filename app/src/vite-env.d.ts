/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKER_URL: string;
  readonly VITE_WORKER_WS_URL: string;
  readonly VITE_MOCK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
