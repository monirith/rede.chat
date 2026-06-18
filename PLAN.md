# rede.chat — Tonight's Build Plan

Stack: Svelte + Vite, Cloudflare Worker, Cloudflare D1, Cloudflare Pages, Stripe
Gemini key: rede.chat dedicated (stored as wrangler secret GEMINI_API_KEY)
Audio pipeline: port from maredan gemini-live.ts (proven on Safari + iOS)

---

## Phase 1 — Infrastructure (45min)

### 1.1 Cloudflare Worker
- [ ] `wrangler init rede-worker`
- [ ] WebSocket proxy: client ↔ Worker ↔ Gemini Live WSS
- [ ] Inject `GEMINI_API_KEY` as encrypted env var
- [ ] Handle session setup message (dialect + scenario → system prompt assembly)
- [ ] On WebSocket close: extract `usageMetadata`, POST token counts to D1
- [ ] Deploy to Cloudflare

### 1.2 Cloudflare D1 Schema
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,         -- auth provider uid
  email TEXT UNIQUE NOT NULL,
  credits INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_session_date TEXT,      -- YYYY-MM-DD Zurich TZ
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  dialect TEXT NOT NULL,
  scenario TEXT NOT NULL,      -- 'free_talk' or scenario key
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,
  credits_deducted INTEGER,
  feedback_json TEXT,          -- post-session error summary
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE vocabulary (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  dialect TEXT NOT NULL,
  expression TEXT NOT NULL,
  standard_german TEXT NOT NULL,
  explanation TEXT NOT NULL,
  saved_at TEXT DEFAULT (datetime('now')),
  source_session_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Phase 2 — Svelte App Shell (1h)

### 2.1 Project setup
- [ ] `npm create vite@latest rede-app -- --template svelte-ts`
- [ ] Tailwind CSS
- [ ] Routing: svelte-spa-router (hash-based, works on Cloudflare Pages)

### 2.2 Auth
- [ ] Self-hosted Better Auth (email OTP + Google + Apple, no password)
- [ ] Auth guard on all routes except landing

### 2.3 Pages / Routes
- `/` — Landing (tagline, dialect preview, CTA)
- `/app` — Home (streak, credits balance, start session CTA)
- `/session` — Active session
- `/feedback` — Post-session feedback cards
- `/history` — Past sessions list
- `/phrasebook` — Saved vocabulary
- `/credits` — Buy credit packs (Stripe)
- `/profile` — Stats per dialect, longest streak

---

## Phase 3 — Audio Session (1.5h)

### 3.1 Port GeminiLiveSession
- [ ] Copy `capture.worklet.js` and `playback.worklet.js` from maredan
- [ ] Port `gemini-live.ts` → `gemini-live.ts` in rede (change WS URL to Cloudflare Worker)
- [ ] Add `visibilitychange` handler for AudioContext resume
- [ ] Add session start credit check (query D1 before opening socket)

### 3.2 Session UI
- [ ] Dialect selector (12 dialects, flag + name)
- [ ] Scenario selector (8 scenarios + Free Talk)
- [ ] Session screen: large mic button, 15min countdown timer, live transcript
- [ ] Interrupt/stop button
- [ ] Loading state while Worker connects to Gemini

### 3.3 Session end flow
- [ ] On WebSocket close: receive feedback JSON from Worker
- [ ] Navigate to `/feedback` with feedback cards
- [ ] Each card: what you said → correction → why → Save to phrasebook button

---

## Phase 4 — System Prompts (1h)

### 4.1 Dialect prompts (12 files)
One system prompt per dialect covering:
- Phonology (key sounds, vowel shifts)
- Characteristic vocabulary and expressions
- What to correct (Hochdeutsch intrusions)
- Tone and register

Dialects: Züridütsch, Berndütsch, Aargauerdeutsch, St. Galler, Baseldytsch,
Luzernerdeutsch, Thurgauerdeutsch, Solothurnerdeutsch, Walliserdeutsch,
Schaffhauserdeutsch, Graubündnerisch, Appenzellerdeutsch

### 4.2 Scenario prompt fragments (8 + free talk)
Injected after dialect base prompt:
- Role Gemini plays
- Context setting
- 3 suggested task hints for user

### 4.3 Personalized review injection
- Query last 3 sessions' feedback for user + dialect
- Append top errors to system prompt on session start

### 4.4 Post-session summary prompt
Injected on session close:
```
Summarise the top 5 errors from this session as JSON:
[{"said": "...", "correction": "...", "why": "..."}]
```

---

## Phase 5 — Payments (45min)

### 5.1 Credit packs
- CHF 10 → 60 minutes
- CHF 25 → 180 minutes
- CHF 50 → 420 minutes (best value)

### 5.2 Stripe integration
- [ ] Stripe Checkout session created by Cloudflare Worker
- [ ] Stripe webhook → Worker → D1 credit top-up on `checkout.session.completed`
- [ ] Credits page shows balance + purchase options
- [ ] Session start checks balance, blocks if 0

### 5.3 Credit deduction
- Token cost formula: `(tokens_input × input_rate + tokens_output × output_rate) × margin`
- Deducted on session close from Worker (has usageMetadata)
- If session exceeds remaining credits: session ends early, user notified

---

## Phase 6 — Backend Features (30min)

- [ ] Session history page (query D1, render list)
- [ ] Phrasebook page (query D1 vocabulary table, group by dialect)
- [ ] Streak update on session close (Worker logic)
- [ ] Progress stats on profile (GROUP BY dialect on sessions table)

---

## Phase 7 — Deploy (30min)

- [ ] `wrangler deploy` — Worker live
- [ ] `npm run build` + `wrangler pages deploy dist` — Svelte app on Cloudflare Pages
- [ ] Custom domain: rede.chat → Cloudflare Pages
- [ ] Environment variables set in Cloudflare dashboard
- [ ] Smoke test: full session, Stripe purchase, feedback cards

---

## Phase 8 — Flutter App: iOS + Android (post-web-launch)

Do this after the web app is live, validated, and has paying users. Not tonight.

### Why Flutter (not Capacitor)
- Native audio lifecycle — no AudioContext suspension on app switch
- Proper iOS mic permissions, background audio handling
- App Store / Play Store quality bar met out of the box
- 120fps ProMotion, native scroll feel

### What gets rewritten
- Audio session layer (~300 lines Dart) using `record` + `just_audio` packages
- All UI in Flutter widgets (Cupertino style for iOS feel)

### What stays the same
- Cloudflare Worker (identical WS endpoint)
- D1 database (identical schema)
- All system prompts (identical)
- Stripe (identical payment links)
- Auth (Better Auth HTTP, same Worker)

### Phases
- [ ] Flutter project init, Better Auth integration
- [ ] Audio session: `record` package for mic capture, PCM16 to Worker WS
- [ ] Playback: `just_audio` or raw AudioTrack for 24kHz PCM output
- [ ] Port all screens from Svelte (dialect picker, session, feedback, history, phrasebook)
- [ ] iOS: `NSMicrophoneUsageDescription`, background audio entitlement
- [ ] Android: `RECORD_AUDIO` permission, audio focus handling
- [ ] TestFlight beta → App Store submission
- [ ] Google Play internal track → production

### Estimated time: 2–3 days after web is validated

---

## Total estimated time: 6–7 hours (web), 2–3 days (Flutter apps)

## What ships tonight (web)
✓ Real-time voice session in 12 Swiss German dialects  
✓ 8 scenarios + Free Talk  
✓ Post-session error feedback  
✓ Pronunciation correction in-session  
✓ Hochdeutsch fallback  
✓ Session history  
✓ Streak tracking  
✓ Vocabulary phrasebook  
✓ Progress per dialect  
✓ Personalized review injection  
✓ Stripe credit packs  
✓ Live on rede.chat  

## What ships post-validation (Flutter)
✓ Native iOS app (App Store)
✓ Native Android app (Play Store)
✓ Reliable audio on mobile (no AudioContext issues)
✓ 120fps, native feel

## What does NOT ship (backlog)
✗ Phoneme-level pronunciation scoring  
✗ Structured curriculum  
✗ Gamification / leaderboards  
✗ Spaced repetition  
