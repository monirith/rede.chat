# Feature: Vocabulary Phrasebook

User saves dialect expressions from sessions for later review.

## Behaviour
- During post-session feedback, each correction card has a "Save" button
- Saved phrases stored in D1 with: dialect, expression, Hochdeutsch equivalent, explanation
- Phrasebook view: browseable list, filterable by dialect
- No automatic spaced repetition in v1 — manual review only

## Data (D1)
- user_id
- dialect
- expression (dialect form)
- standard_german (Hochdeutsch equivalent)
- explanation
- saved_at
- source_session_id

## UI
- Phrasebook tab in nav
- Grouped by dialect
- Each entry: dialect word/phrase → Hochdeutsch → explanation
- Delete entry

## V2
- Spaced repetition review mode
- Auto-extract phrases from transcript (NLP processing)
- Export to Anki
