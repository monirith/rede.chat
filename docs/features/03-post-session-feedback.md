# Feature: Post-Session Feedback

After every session, user gets a summary of errors and corrections.

## Behaviour
- On session end, Gemini is prompted to produce a structured summary
- Summary includes:
  - What the user said (transcript excerpt)
  - What was wrong or unnatural
  - The correct dialect expression
  - Why — brief explanation of the rule or cultural context
- Maximum 5-7 corrections (not overwhelming)
- Summary displayed as a card list, saveable to session history

## Technical
- Triggered by session close event (WebSocket close)
- Final prompt injected before close: "Summarise the top errors from this session in JSON"
- JSON parsed and rendered as feedback cards in UI
- Summary stored in D1 session_log alongside token usage

## V2
- "Generate a review drill" — creates a custom scenario targeting the user's specific mistakes
- Email summary (for users who want async review)
