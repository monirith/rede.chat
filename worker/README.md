# rede-worker

Cloudflare Worker: WebSocket proxy to Gemini Live + D1 backend + Stripe checkout.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | — | Service ping |
| WS | `/ws/live?token=<jwt>` | JWT | Browser ↔ Gemini Live proxy |
| GET | `/api/dialects` | — | List of 12 dialects |
| GET | `/api/scenarios` | — | List of 9 scenarios |
| GET | `/api/me` | JWT | Current user + credits + streak |
| GET | `/api/history` | JWT | Last 50 sessions |
| GET | `/api/session/:id` | JWT | Full session (transcript + feedback) |
| GET | `/api/phrasebook` | JWT | Saved vocabulary |
| POST | `/api/phrasebook` | JWT | Save a phrase |
| DELETE | `/api/phrasebook/:id` | JWT | Delete a phrase |
| GET | `/api/progress` | JWT | Minutes per dialect |
| GET | `/api/credits/packs` | — | Credit pack prices |
| POST | `/api/credits/checkout` | JWT | Stripe Checkout session |
| POST | `/api/stripe/webhook` | signature | Stripe webhook |

## Secrets to set

```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
```

## D1 commands

```bash
wrangler d1 create rede                # one-time, paste id into wrangler.toml
npm run db:migrate:local               # local dev
npm run db:migrate                     # remote production
wrangler d1 execute rede --remote --command "SELECT * FROM users LIMIT 5"
```

## Local dev

```bash
npm run dev
# → http://localhost:8787
```
