# Feature: Streak Tracking

Daily practice streak. Simple motivation mechanic.

## Behaviour
- Streak increments when user completes at least one session per calendar day (Zurich timezone)
- Displayed on home screen: "🔥 7 days"
- Streak breaks if no session on a calendar day
- Streak freeze: not in v1 (add if churn data shows streak loss = cancellation)

## Data (D1)
- last_session_date (date only, Zurich TZ)
- current_streak (integer)
- longest_streak (integer)
- Updated on session close

## UI
- Single number on home screen, no elaborate gamification
- Longest streak shown on profile
- No leaderboard in v1 (not relevant for solo practice app)
