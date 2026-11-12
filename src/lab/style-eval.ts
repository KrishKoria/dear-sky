/**
 * Rule-based eval of a margin note against the style rules in SYSTEM_PROMPT (prompts.ts).
 * Dev only: the lab runs it on fictional letters to measure prompt tuning
 * (research/chrome-ai-docs.md, "Evals course"). Binary PASS/FAIL, with the failed rules
 * as the rationale.
 */
import { leakCheck } from '../lib/privacy/leakcheck';

export interface StyleResult {
  pass: boolean;
  /** One entry per broken rule, e.g. `banned word: quiet`. */
  failures: string[];
}

/** Words the system prompt tells the model to avoid. */
export const BANNED_WORDS = ['quiet', 'weight', 'heavy', 'courage', 'strength', 'palpable', 'profound', 'journey', 'testament'];

const PRAISE = /\b(?:it'?s|it is|that'?s|that is|what a)\s+(?:so\s+|really\s+|very\s+)?(?:good|great|powerful|wonderful|beautiful|brave|admirable|amazing|lovely|inspiring|impressive|incredible|remarkable)\b|\bproud of you\b|\byou should be proud\b|\bwell done\b/i;
// Imperatives ("Try to…") only count at the start of a sentence: "you still try to cook it" describes.
const ADVICE = /\byou (?:should|could|might want to|need to|must)\b|\b(?:it might help|maybe you could)\b|(?<=^|[.!?]\s+)(?:try to|consider|remember to|don'?t forget|make sure)\b/i;
const HEDGED_OPENING = /^(?:it sounds like|it seems|you\b)/i;

export function evalStyle(letter: string, note: string): StyleResult {
  const text = note.replace(/[‘’]/g, "'").trim();
  const failures: string[] = [];

  const sentences = text.split(/(?<=[.!?…])\s+/).filter((s) => /\p{L}/u.test(s));
  if (sentences.length < 2 || sentences.length > 3) failures.push(`sentences: ${sentences.length} (want 2–3)`);

  if (text.includes('?')) failures.push('asks a question');

  const opening = text.match(HEDGED_OPENING);
  if (opening) failures.push(`opens with "${opening[0]}"`);

  for (const word of BANNED_WORDS) {
    if (new RegExp(`\\b${word}`, 'i').test(text)) failures.push(`banned word: ${word}`);
  }

  const praise = text.match(PRAISE);
  if (praise) failures.push(`praise: "${praise[0]}"`);

  const advice = text.match(ADVICE);
  if (advice) failures.push(`advice: "${advice[0]}"`);

  // Names, places and contact details from the letter (the leak check's rules; copying a
  // short detail is allowed in a margin note, so "copied" is ignored here).
  for (const p of leakCheck(letter, { essence: text, motif: '' }).problems) {
    if (p.kind !== 'copied') failures.push(`${p.kind}: ${p.match}`);
  }

  return { pass: failures.length === 0, failures };
}
