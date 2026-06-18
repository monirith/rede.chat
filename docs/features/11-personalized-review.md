# Feature: Personalized Review

Prior session mistakes are passed into the next session's system prompt so Gemini can target them.

## Behaviour
- On session start, last N feedback entries for that dialect are fetched from D1
- Injected into system prompt: "This user previously struggled with: [list of errors]"
- Gemini naturally works these into the conversation as correction opportunities
- No UI needed — invisible to user, improves experience automatically

## Technical
- On session start: query D1 for last 3 sessions' feedback_json for this user + dialect
- Extract top errors, format as bullet list
- Append to system prompt before sending setup message to Gemini Live

## Example injection
```
Previous errors to address naturally:
- Uses "nöd" incorrectly (says "nicht" instead)
- Hochdeutsch "ich" pronunciation (should be softer "ig" in Züridütsch)
- Formal "Sie" when "du" is expected in casual Beiz context
```

## V2
- Cross-dialect mistake patterns (user always makes same error regardless of dialect)
- User can view what Gemini knows about their weaknesses
- "Focus session" — session specifically targeting one error category
