/**
 * The release gate: the only way to make words that may leave the device (PREP.md D1, D2).
 *
 * Call it when the writer presses the consent button (gate 3), with the exact words on the
 * tag after any edits. It runs the language guard (D26) and the leak check (gate 2, D25)
 * on those words. Cloud code accepts only `ApprovedWords`, so letter text can't reach it
 * by accident: a plain string or an unchecked `Essence` doesn't type-check.
 */
import type { Feeling } from '../engine/prompts';
import { releaseLanguage } from './language';
import { leakCheck, type LeakProblem } from './leakcheck';

declare const approved: unique symbol;

/** Lantern words that passed every gate. Only `approveRelease` makes them. */
export type ApprovedWords = {
  readonly feeling: Feeling;
  readonly essence: string;
  readonly motif: string;
  readonly [approved]: true;
};

export type ReleaseVerdict =
  | { ok: true; words: ApprovedWords }
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'language' }
  | { ok: false; reason: 'leak'; problems: LeakProblem[] };

export function approveRelease(
  letter: string,
  words: { feeling: Feeling; essence: string; motif: string },
): ReleaseVerdict {
  const exact = { feeling: words.feeling, essence: words.essence.trim(), motif: words.motif.trim() };
  if (!exact.essence) return { ok: false, reason: 'empty' };
  if (!releaseLanguage(letter).ok) return { ok: false, reason: 'language' };
  const check = leakCheck(letter, exact);
  if (!check.ok) return { ok: false, reason: 'leak', problems: check.problems };
  return { ok: true, words: Object.freeze(exact) as ApprovedWords };
}
