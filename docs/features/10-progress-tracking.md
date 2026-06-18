# Feature: Progress Tracking per Dialect

Shows how much time the user has spent on each dialect.

## Behaviour
- Per-dialect stats: total sessions, total minutes practiced
- Home screen: "You've practiced Züridütsch for 3h 20min"
- No mastery score in v1 — purely time-based (no proprietary assessment model)
- Favourite dialect auto-detected (most practiced) and shown on profile

## Data (D1)
- Derived from session_log: GROUP BY dialect, SUM(duration_seconds)
- Computed on profile load, no separate table needed in v1

## UI
- Profile screen: bar or list per dialect with minutes
- Simple — not a dashboard, just a summary

## V2
- Error frequency per dialect (from feedback_json across sessions)
- "Weakest dialect" recommendation
- Progress toward fluency milestones (user-defined goals)
