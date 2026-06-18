# Feature: Session History

User can review all past sessions — what they practiced, feedback received, credits spent.

## Data stored per session (D1)
- user_id
- dialect
- scenario
- started_at, ended_at, duration_seconds
- tokens_input, tokens_output (from usageMetadata)
- credits_deducted
- feedback_json (post-session error summary)
- transcript_text (optional, privacy consideration)

## UI
- List view: date, dialect, scenario, duration, credit cost
- Tap session → see post-session feedback cards again
- Filter by dialect
- Total credits spent / sessions completed shown on profile

## V2
- Mistake frequency across sessions (which errors repeat)
- Export transcript as PDF
- "Practice this again" — restarts same scenario + dialect
