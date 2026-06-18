# Feature: Real-Time Voice Session

Core product. User speaks, Gemini Live responds in the selected Swiss German dialect.

## Behaviour
- User selects dialect + scenario before session starts
- Single tap to begin — this is the required user gesture for iOS AudioContext
- Bidirectional audio: mic capture at 16kHz PCM16, playback at 24kHz
- Gemini speaks the dialect, understands the dialect, corrects in dialect
- Hard 15-minute cap per session — resets context window, controls cost
- Session ends: user taps stop, timer hits 0, or connection drops

## Technical
- AudioWorklet capture + playback (port from maredan gemini-live.ts)
- WebSocket to Cloudflare Worker proxy
- Worker injects GEMINI_API_KEY, forwards to Gemini Live WSS endpoint
- visibilitychange handler resumes AudioContext on app foreground
- On session end: Worker receives usageMetadata, logs tokens to D1, deducts credits

## Cost model
- Credits deducted per session based on actual token consumption × Gemini rate + margin
- No session starts if credit balance = 0
