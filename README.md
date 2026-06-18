# rede.chat

> Schwiizerdütsch (Swiss German) conversation practice with AI. 12 dialects.
> Pay-as-you-go. Live voice in, live voice out.

[![CI](https://github.com/monirith/rede/actions/workflows/ci.yml/badge.svg)](https://github.com/monirith/rede/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-f38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Svelte 5](https://img.shields.io/badge/frontend-Svelte%205-ff3e00?logo=svelte&logoColor=white)](https://svelte.dev/)
[![Flutter](https://img.shields.io/badge/mobile-Flutter-02569b?logo=flutter&logoColor=white)](https://flutter.dev/)

---

## The premise

This service was built **in a single night**, end to end, as an experiment
to measure how fast a full AI startup can ship today:

- live voice conversation with a domain-specific LLM (Swiss German dialects),
- self-hosted authentication with passwordless email + Google + Apple,
- pay-as-you-go credit metering with Stripe and in-app purchases,
- a public web app, a Flutter mobile shell, and the supporting infrastructure.

The git history is intentionally a single initial commit — the goal was to
see *how short the path is* from idea to production-deployed product. The
codebase is open here as a real-world reference and as a portfolio piece.

## What it does

Pick a Swiss dialect (Zürich, Bern, Basel, Luzern, …) and a situation (free
talk, news headlines, a doctor's appointment, …). The browser opens a
WebSocket to a Cloudflare Worker that proxies bidirectional audio to
**Gemini 3.1 Flash Live**. Audio in is 16 kHz PCM16; audio out is 24 kHz PCM16,
no resampling overhead in the worker. Each session is metered in seconds and
deducted from your balance.

## Stack

| Layer        | Tech                                                                 |
| ------------ | -------------------------------------------------------------------- |
| Frontend     | Svelte 5 + Vite + TailwindCSS, deployed to Cloudflare Pages          |
| Mobile       | Flutter (iOS / Android), shares the same Worker backend              |
| Backend      | Cloudflare Worker (TypeScript)                                       |
| Database     | Cloudflare D1 (SQLite at the edge)                                   |
| Auth         | Self-hosted [Better Auth](https://better-auth.com) — email OTP + Google + Apple |
| Email        | PurelyMail SMTP over Cloudflare Workers sockets (`worker-mailer`)    |
| Payments     | Stripe Checkout (web), StoreKit + Google Play Billing (mobile)       |
| AI           | Gemini Live (`models/gemini-3.1-flash-live-preview`)                 |
| Audio        | WebAudio AudioWorklet — 16 kHz mic capture, 24 kHz playback (PCM16)  |
| CI / quality | TypeScript strict, Vitest, `svelte-check`, `flutter analyze`, GitHub Actions |

## Architecture

```
Browser / Flutter                                       Stripe / App Store
       │  wss + Bearer(session)                                  │
       ▼                                                         ▼
┌──────────────────────────────────────────────────────────────────┐
│ Cloudflare Worker — rede.chat/{api,ws}/*                         │
│                                                                  │
│  /api/auth/*   → Better Auth (email OTP, Google, Apple, bearer)  │
│  /api/*        → app API (me, history, phrasebook, credits, …)   │
│  /ws/live      → bidi proxy to Gemini Live                       │
│  /api/stripe/* → checkout + webhook                              │
│  /api/iap/*    → Apple / Google IAP receipt verification         │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────┐
│ Cloudflare D1                              │
│  • app tables: users, sessions, vocabulary, purchases             │
│  • auth tables: user, session, account, verification (Better Auth)│
└────────────────────────────────────────────┘
```

The Worker is the single source of truth for identity and credits; the
SPA and Flutter app are thin clients. Conversation transcripts stay on the
user's device — the database stores metadata only.

## Local dev

```bash
# Worker
cd worker
npm install
wrangler d1 create rede                # one-time, copy id into wrangler.toml
npm run db:migrate:local               # base schema
wrangler d1 execute rede --local --file=./migrate_betterauth.sql

# Production secrets go via `wrangler secret put NAME`. For local dev, use a
# gitignored worker/.dev.vars file — wrangler dev loads it automatically.
cat > .dev.vars <<EOF
BETTER_AUTH_SECRET=local-dev-secret-change-me
EMAIL_PROVIDER=purelymail
EMAIL_FROM=rede <login@example.com>
EMAIL_USER=login@example.com
EMAIL_API_KEY=your-smtp-password
EMAIL_SMTP_HOST=smtp.purelymail.com
EMAIL_SMTP_PORT=465
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APPLE_CLIENT_ID=...
APPLE_CLIENT_SECRET=...
EOF
npm run dev                            # http://localhost:8787

# SPA (separate terminal)
cd app
npm install
cat > .env.local <<EOF
VITE_WORKER_URL=http://localhost:8787
VITE_WORKER_WS_URL=ws://localhost:8787
VITE_OAUTH_PROVIDERS=google,apple
EOF
npm run dev                            # http://localhost:5173

# Mobile (optional, separate terminal)
cd rede_flutter
flutter pub get
flutter run                            # picks first connected device
```

## Tests and quality gates

| Surface | Command                            | What it runs                                          |
| ------- | ---------------------------------- | ----------------------------------------------------- |
| Worker  | `npm --prefix worker run typecheck`| `tsc --noEmit` against strict TypeScript              |
| Worker  | `npm --prefix worker test`         | Vitest — auth invariants, email transport selection, Apple secret JWT generation + signature verification |
| Worker  | `npm --prefix worker run deploy --dry-run` | Bundle for the Workers runtime                |
| SPA     | `npm --prefix app run check`       | `svelte-check` + TypeScript across all `.svelte` and `.ts` |
| SPA     | `npm --prefix app run build`       | Production Vite build + prerender                     |
| Mobile  | `flutter analyze` (in `rede_flutter/`) | Dart static analysis with the recommended Flutter lint set |

The GitHub Actions workflow at [.github/workflows/ci.yml](.github/workflows/ci.yml)
runs every one of these on each push and pull request.

## Deploy (production)

The Worker serves `rede.chat/api/*` and `rede.chat/ws/*` (same-origin routes,
`workers_dev = false`). The SPA is served by Pages at `rede.chat/*`.

```bash
# 1. Worker
cd worker
wrangler d1 create rede                # capture the id, paste into wrangler.toml
npm run db:migrate                     # base schema → remote D1
wrangler d1 execute rede --remote --file=./migrate_betterauth.sql

# Set every secret listed in worker/src/types.ts via:
#   wrangler secret put <NAME>
# At minimum: GEMINI_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
# BETTER_AUTH_SECRET, EMAIL_{PROVIDER,FROM,USER,API_KEY,SMTP_HOST,SMTP_PORT},
# GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APPLE_CLIENT_ID, APPLE_CLIENT_SECRET.
# Apple's secret expires every 180 days — regenerate via:
#   node scripts/gen-apple-secret.mjs --p8 AuthKey_XXXX.p8 \
#     --kid XXXX --team YYYYYYYYYY --services your.services.id \
#     | wrangler secret put APPLE_CLIENT_SECRET
npm run deploy

# 2. SPA
cd ../app
cat > .env.production <<EOF
VITE_WORKER_URL=https://rede.chat
VITE_WORKER_WS_URL=wss://rede.chat
VITE_OAUTH_PROVIDERS=google,apple
EOF
npm run build
npx wrangler pages deploy dist --project-name=rede-app --branch=main

# 3. Domain (one-time)
# Cloudflare dashboard → Pages project rede-app → Custom domains → add rede.chat
```

## External setup checklist

- [ ] Cloudflare account + `wrangler login` (D1, Workers, Pages)
- [ ] Email provider for OTP delivery (PurelyMail SMTP works via Cloudflare sockets; Resend / Postmark / Mailgun also supported via HTTP)
- [ ] Google OAuth client (Web application) — redirect URI `https://rede.chat/api/auth/callback/google`
- [ ] Apple Sign in — paid Apple Developer account, App ID with Sign in with Apple, a Services ID with return URL `https://rede.chat/api/auth/callback/apple`, a Sign in with Apple `.p8` key; client secret regenerated every ≤ 180 days via [`worker/scripts/gen-apple-secret.mjs`](worker/scripts/gen-apple-secret.mjs)
- [ ] Stripe account — products defined in [`worker/src/stripe.ts`](worker/src/stripe.ts) (30 min / 2 h packs), webhook → `https://rede.chat/api/stripe/webhook` with event `checkout.session.completed`
- [ ] Domain rede.chat → Cloudflare DNS

## Cost model

- Sessions are metered in **seconds**, deducted from the user's balance in real time.
- Token rates configurable via `TOKEN_INPUT_RATE_USD` / `TOKEN_OUTPUT_RATE_USD` / `CREDIT_MARGIN` env vars.
- Time packs: **30 minutes (CHF 2.99)** and **2 hours (CHF 9.99)**. Defined in [`worker/src/stripe.ts`](worker/src/stripe.ts).

## Layout

```
rede/
├── worker/             # Cloudflare Worker — WebSocket proxy to Gemini Live,
│   ├── src/            #   D1 backend, Stripe + IAP, Better Auth handler
│   ├── test/           # Vitest unit tests
│   ├── scripts/        # Tooling (Apple client secret generator)
│   ├── schema.sql      # Base D1 schema
│   └── migrate_betterauth.sql  # Better Auth tables
├── app/                # Svelte 5 + Vite PWA
├── rede_flutter/       # Flutter mobile shell (iOS + Android)
├── docs/               # Feature specs
└── .github/workflows/  # CI
```

## License

[MIT](LICENSE).
