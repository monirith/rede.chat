// Runtime config. Overridden by Vite env vars at build time.
export const config = {
  workerUrl: import.meta.env.VITE_WORKER_URL || "https://rede-worker.workers.dev",
  workerWsUrl: (import.meta.env.VITE_WORKER_WS_URL as string)
    || "wss://rede-worker.workers.dev",
  // Which OAuth buttons to show on the sign-in screen. Add "apple" once the
  // Apple Sign in credentials are configured on the Worker.
  oauthProviders: ((import.meta.env.VITE_OAUTH_PROVIDERS as string) || "google")
    .split(",").map((s) => s.trim()).filter(Boolean),
};
