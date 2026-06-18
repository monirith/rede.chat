# Feature: Pronunciation Feedback

Gemini hears the user's pronunciation and corrects it conversationally.

## Behaviour
- Not phoneme-level (no proprietary ASR model needed)
- Gemini flags when pronunciation is clearly wrong or Hochdeutsch-accented
- Format: "You said [X] — in Züridütsch it sounds more like [Y], the vowel is shorter"
- Integrated into natural conversation flow, not a separate mode
- Corrections happen in-session, not just post-session
- Hochdeutsch accent vs dialect pronunciation specifically called out

## What this covers
- Vowel shifts (Züridütsch "ü" vs Hochdeutsch "ü")
- Final consonant softening
- Characteristic dialect sounds (Züridütsch "ch", Berndütsch rhythm)
- Wrong dialect mixing (using Züridütsch words in a Berndütsch session)

## What this does NOT cover
- Phoneme-level breakdown with scoring (requires proprietary ASR — backlog)
- Side-by-side waveform comparison
- Accent scoring / fluency metrics
