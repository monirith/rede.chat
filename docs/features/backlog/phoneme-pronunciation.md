# Backlog: Phoneme-Level Pronunciation Scoring

Speak.com equivalent: proprietary ASR + phonetic model gives word-by-word breakdown.

## Why it's backlog
- Requires a dedicated ASR/phonetic model trained on Swiss German dialects
- No off-the-shelf solution exists for Mundart
- Gemini Live can flag obvious pronunciation issues but cannot score phonemes
- Significant ML work — months, not hours

## What we have instead
- Conversational pronunciation feedback via Gemini (Feature 05)
- Good enough for launch, covers the most common errors

## Future approach
- Fine-tune Whisper on Swiss German dialect audio
- Build phoneme comparison layer on top
- Or wait for Google to add phoneme scoring to Gemini Live API
