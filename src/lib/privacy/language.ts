/**
 * Release language guard (PREP.md D26).
 *
 * The leak check finds names by their capital letter. That only works in languages that
 * capitalise names and little else: German capitalises every noun (everything would be
 * blocked), and many scripts have no capitals at all (names would slip through). So in v1
 * only English letters can be released. Other letters still get their reflection; the app
 * explains gently why the lantern stays on the device.
 *
 * Deterministic on purpose, no model: it works without Nano (Brave, Safari), and the
 * contest rules require all AI inference to go through Firebase AI Logic, which rules out
 * Chrome's Language Detector API.
 */

export type LanguageVerdict = { ok: true } | { ok: false; reason: 'script' | 'not-english' };

/** Block when more than this share of the letters come from a script without capitals. */
export const MAX_CASELESS_SHARE = 0.05;
/** Below this many words a letter is too short to judge; the leak check still runs. */
export const MIN_WORDS_TO_JUDGE = 12;
/** English prose is usually 35–50% function words; German, Spanish, French score far lower here. */
export const MIN_ENGLISH_SHARE = 0.2;

/** Short, frequent English words that rarely mean anything in German, Spanish or French. */
const ENGLISH_FUNCTION_WORDS = new Set(
  `the a an and or but if of to at for with from by as is are was were be been being i me my mine
  myself you your yours he him his she her hers it its we us our they them their this that these those
  not do did does done have has had will would can could should there here what when where who why how
  all just than then too very about into over after before because while still never always again
  i'm i've i'd i'll it's that's don't didn't can't won't couldn't wasn't isn't you're we're they're`.split(/\s+/),
);

/** Share of the text's letters that come from scripts without capital letters (0 to 1). */
export function caselessShare(text: string): number {
  let letters = 0;
  let caseless = 0;
  for (const ch of text) {
    if (!/\p{L}/u.test(ch)) continue;
    letters++;
    if (ch.toLowerCase() === ch.toUpperCase()) caseless++;
  }
  return letters === 0 ? 0 : caseless / letters;
}

function words(text: string): string[] {
  return [...text.replace(/[‘’]/g, "'").toLowerCase().matchAll(/\p{L}+(?:'\p{L}+)?/gu)].map((m) => m[0]);
}

/** Share of the words that are English function words (0 to 1). */
export function englishShare(text: string): number {
  const all = words(text);
  return all.length === 0 ? 0 : all.filter((w) => ENGLISH_FUNCTION_WORDS.has(w)).length / all.length;
}

/** Whether this letter's lantern may be released. Pure code; sends nothing. */
export function releaseLanguage(letter: string): LanguageVerdict {
  if (caselessShare(letter) > MAX_CASELESS_SHARE) return { ok: false, reason: 'script' };
  if (words(letter).length >= MIN_WORDS_TO_JUDGE && englishShare(letter) < MIN_ENGLISH_SHARE) {
    return { ok: false, reason: 'not-english' };
  }
  return { ok: true };
}
