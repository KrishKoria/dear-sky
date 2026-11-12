/**
 * Deterministic safety prefilter (PREP.md D12, D19). Recall over precision: a hit only
 * shows a gentle local care card, and never sends anything anywhere.
 * Patterns from research/riskcheck-draft.ts, tested on 2026-11-12.
 */
const PATTERNS: RegExp[] = [
  /\b(kill|hurt|harm|cut)(ing)?\s+(my\s?self|myself)\b/i,
  /\b(end|ending|take|taking)\s+(it all|my (own )?life|my life)\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(want|wanna|wish)(ed)?\s+(to\s+)?(die|be dead|disappear|not (be here|exist|wake up))\b/i,
  /\b(could|would|should) (just )?(die|disappear|not wake up)\b/i,
  /\bbetter off without me\b/i,
  /\b(won'?t|will not|don'?t think i'?ll|not going to)\s+be (here|around)\b/i,
  /\bno (reason|point) (to|in) (live|living|going on)\b/i,
  /\bgiving (away )?(away )?my (things|stuff|books|belongings)\b|\bgave away my\b/i,
  /\b(goodbye|good-?bye) for (good|ever)\b|\bthis is (my )?goodbye\b/i,
  /\bcan'?t (go on|do this anymore|keep going)\b/i,
  /\b(wrote|written|writing|leave|left) (a |the )?(note|notes|letters) for\b/i,
];

/** True when the letter matches any risk pattern. Matched text is never stored or sent. */
export function riskHit(letter: string): boolean {
  // Curly apostrophes are common in pasted or phone-typed text.
  const text = letter.replace(/[‘’]/g, "'");
  return PATTERNS.some((p) => p.test(text));
}
