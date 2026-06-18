# Feature: Scenario-Based Roleplay

User picks a real-world context before the session. Gemini plays the other person.

## Launch Scenarios
- Migros checkout (cashier)
- Tram / public transport (asking for help)
- Office small talk (colleague)
- Beiz / restaurant (ordering, chatting)
- Hausverwaltung (landlord, maintenance request)
- Doctor appointment
- Bank / post office
- Meeting a neighbour

## Behaviour
- Each scenario has a system prompt preamble injected before the dialect prompt
- Gemini plays the role (cashier, colleague, etc.), user plays themselves
- Gemini gives 3 optional task hints at session start ("try to ask about X")
- Gemini ends scenario naturally when tasks are complete or at 15min cap
- Post-session: summary of what tasks were completed

## V2
- User-defined custom scenarios (Free Talk upgrade)
- Difficulty levels per scenario (beginner slows down, uses simpler vocabulary)
