# rede-app

Svelte 5 + Vite + Tailwind. PWA for Schwiizerdütsch practice.

## Env vars

```
VITE_WORKER_URL=https://rede-worker.<account>.workers.dev
VITE_WORKER_WS_URL=wss://rede-worker.<account>.workers.dev
```

## Scripts

```bash
npm run dev      # vite dev server
npm run build    # production build to dist/
npm run check    # type-check
```

## Routes (hash-based, works on Cloudflare Pages static hosting)

- `/` — Landing
- `/signin` — Magic-link sign in
- `/app` — Home: streak, credits, start session
- `/session` — Active voice session
- `/feedback` — Post-session error cards
- `/history` — Past sessions
- `/phrasebook` — Saved vocabulary
- `/credits` — Buy credit packs
- `/profile` — Stats per dialect, longest streak

## Audio

Mic capture: 16kHz mono PCM16 → Cloudflare Worker WebSocket → Gemini Live  
Playback: 24kHz PCM16 from Gemini → AudioWorklet queue → speakers

Worklets live at `public/audio-processors/` and are loaded by `lib/gemini-live.ts`.
