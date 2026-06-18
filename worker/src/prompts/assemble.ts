import { DIALECTS, type DialectKey } from "./dialects";
import { SCENARIOS, type ScenarioKey } from "./scenarios";

export interface PriorError {
  said: string;
  correction: string;
  why: string;
}

export type Level = "A" | "B" | "C";

const LEVEL_INSTRUCTIONS: Record<Level, string> = {
  A: `LEARNER LEVEL — A1 (BEGINNER). Restrict yourself for this entire session:
- Sentences: ONE short clause each. No subordinate clauses.
- Vocabulary: only the most common ~500 everyday words. No idioms, no slang, no rare/technical terms.
- Grammar: present tense mostly. Simple past sparingly. NO subjunctive, NO complex conjugations.
- Pace: speak slowly, clearly, with pauses.
- If the user struggles, simplify even further. If they're clearly fluent, stay at A1 anyway — that's the rule.`,

  B: `LEARNER LEVEL — B1 (INTERMEDIATE). Restrict yourself for this entire session:
- Sentences: up to two clauses, simple subordinates ok.
- Vocabulary: common everyday words plus the ~2000 most frequent. Avoid rare, literary, or technical terms.
- Grammar: full range of present, past, future. Conditional and subjunctive only when truly natural.
- Pace: natural but not rushed.
- Stay within these bounds for the whole session even if the user seems advanced.`,

  C: `LEARNER LEVEL — C (UNRESTRICTED / NATIVE). No restrictions. Speak as you would with a native speaker — full vocabulary, idioms, complex grammar, natural pace.`,
};

export function assembleSystemPrompt(
  dialectKey: DialectKey,
  scenarioKey: ScenarioKey,
  priorErrors: PriorError[] = [],
  level: Level = "C"
): string {
  const dialect = DIALECTS[dialectKey];
  const scenario = SCENARIOS[scenarioKey];
  if (!dialect) throw new Error(`unknown dialect: ${dialectKey}`);
  if (!scenario) throw new Error(`unknown scenario: ${scenarioKey}`);

  let prompt = dialect.prompt + "\n\n" + scenario.prompt;

  // Level constraint is appended right after dialect+scenario so the model
  // weights it heavily.
  prompt += `\n\n${LEVEL_INSTRUCTIONS[level]}\n`;

  if (priorErrors.length > 0) {
    const errorLines = priorErrors
      .slice(0, 5)
      .map((e) => `- User said "${e.said}" — correct form: "${e.correction}". ${e.why}`)
      .join("\n");

    prompt += `\n\nPRIOR USER WEAKNESSES (work these in naturally as correction opportunities, do NOT list them upfront):
${errorLines}\n`;
  }

  prompt += `\n\nSESSION DURATION: max 15 minutes. Wrap up naturally as time approaches end.\n`;

  return prompt;
}

export const SESSION_SUMMARY_PROMPT = `The session is ending. Output ONLY a JSON array of the top 5 most important corrections from this session. Format:
[
  {"said": "<what the user actually said>", "correction": "<correct dialect form>", "why": "<one short sentence>"}
]
If there were fewer than 5 notable errors, output fewer. If none, output [].
Output ONLY the JSON, no preamble, no markdown fences.`;
