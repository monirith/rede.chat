# Feature: Hochdeutsch Fallback

When user is confused, Gemini briefly explains in standard German then returns to dialect.

## Behaviour
- User can say "Ich verstehe nicht" / "auf Hochdeutsch bitte" / "was heisst das?"
- Gemini switches to clear Hochdeutsch for the explanation
- After explanation, Gemini returns to the dialect automatically
- Can be triggered mid-sentence — Gemini detects confusion signals
- Explained concept is logged for post-session feedback

## Purpose
- Removes frustration wall for beginners
- Keeps sessions productive instead of stuck
- Mirrors how a real Swiss person would help someone learning the dialect

## System Prompt Instruction
- Gemini is instructed: if user shows confusion signals, offer Hochdeutsch clarification
- Never stays in Hochdeutsch — always pulls back to dialect
- Counts as a learning moment, not a failure
