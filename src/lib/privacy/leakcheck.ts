/**
 * The leak check: gate 2 of 3 before lantern words leave the device (PREP.md D2, D25).
 *
 * A deterministic check of the exact words the cloud would receive, against the letter
 * they came from. It runs on Nano's essence and on words the writer types or edits
 * themselves (the no-Nano path, D10). A model can't be the privacy guarantee; this can.
 *
 * It blocks phone numbers, emails, URLs, @handles, any capitalised word from the letter
 * that isn't on the allowlist, capitalised words inside the lantern words themselves,
 * words in scripts without capital letters (names can't be told apart there), and any
 * run of COPY_RUN or more words copied from the letter (letter text never leaves, D1).
 *
 * Problems quote only the lantern words, never the letter, so they are safe to show.
 */

export type LeakKind = 'phone' | 'email' | 'url' | 'handle' | 'name' | 'copied' | 'script';
export type LanternField = 'essence' | 'motif';

export interface LeakProblem {
  kind: LeakKind;
  field: LanternField;
  /** The offending part of the lantern words, for highlighting. */
  match: string;
}

export interface LeakResult {
  ok: boolean;
  problems: LeakProblem[];
}

export interface LanternWords {
  essence: string;
  motif: string;
}

/** This many words in a row shared with the letter count as copied letter text. */
export const COPY_RUN = 5;

/** Capitalised words that are fine: family names-for-people, God, days of the week. */
const ALLOWLIST = new Set(
  `i i'm i've i'd i'll mom mum mommy mummy mother dad daddy father papa pappa mama maa ma pa amma appa achan ammi abbu
  abba baba bapu nana nani dada dadi thatha paati ajji ajja aai baba nonna nonno abuela abuelo oma opa
  grandma grandpa granny gran grandad grandmother grandfather nan aunty auntie uncle sis bro god lord
  monday tuesday wednesday thursday friday saturday sunday
  mondays tuesdays wednesdays thursdays fridays saturdays sundays`.split(/\s+/),
);

/** Words that often start a sentence; capitalised there, they are not names. */
const COMMON_OPENERS = new Set(
  `a an the and but or so yet if when then now still even just maybe perhaps sometimes today tonight
  yesterday tomorrow every all some most no not never always after before since because though although
  while until as at in on of for from with without to by about into over under there here this that
  these those what which who why how where my your our their his her its we you he she it they me us
  them dear hi hello hey love thank thanks sorry please yes okay ok oh also only one two nothing
  everything something someone everyone nobody last first remember i'm i've i'd i'll it's that's
  there's you're you've we're we'd don't didn't can't couldn't won't wouldn't isn't wasn't let's
  do does did is was are were have has had can could would should will may might must keep tell give
  take let make come go look see say said wish hope miss wait stop promise forgive really honestly
  anyway somehow probably again back once well funny imagine whatever other another each both much
  many more less very too almost already later soon goodbye bye nobody none people life time home`.split(/\s+/),
);

const PATTERNS: [LeakKind, RegExp][] = [
  ['email', /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu],
  ['url', /\b(?:https?:\/\/|www\.)\S+|\b[\p{L}\p{N}-]+\.(?:com|net|org|io|co|in|uk|me|app|dev|ly|gg|tv|edu|gov|info|xyz)\b(?:\/\S*)?/giu],
  // Not preceded by a letter or digit, so the "@" inside an email isn't a handle.
  ['handle', /(?<![\p{L}\p{N}_])@[\p{L}\p{N}_.]{2,}/gu],
];

const WORD = /\p{L}[\p{L}\p{M}'-]*/gu;

/** Runs the leak check on the lantern words, given the letter they came from. */
export function leakCheck(letter: string, words: LanternWords): LeakResult {
  const candidates = nameCandidates(letter, lowercaseVocab(letter));
  const problems: LeakProblem[] = [];
  const fields: [LanternField, string][] = [
    ['essence', words.essence],
    ['motif', words.motif],
  ];

  for (const [field, raw] of fields) {
    const text = normalise(raw);
    const add = (kind: LeakKind, match: string) => {
      if (!problems.some((p) => p.kind === kind && p.field === field && p.match === match)) {
        problems.push({ kind, field, match });
      }
    };

    // In order, removing each match, so an email isn't also reported as a URL and a handle.
    let rest = text;
    for (const [kind, pattern] of PATTERNS) {
      for (const m of rest.matchAll(pattern)) add(kind, m[0]);
      rest = rest.replace(pattern, ' ');
    }
    for (const m of phoneNumbers(rest)) add('phone', m);

    for (const m of text.matchAll(WORD)) {
      const word = m[0];
      if (isCaseless(word)) {
        add('script', word);
        continue;
      }
      if (candidates.has(bare(word))) add('name', word);
    }
    // Capitalised words mid-sentence in the lantern words themselves: catches names the model
    // spelled differently from the letter. A sentence's first word is only checked against the
    // letter (above): the lantern words are too short to tell "Call me" from a name.
    for (const name of nameCandidates(text, new Set(), true)) {
      const shown = [...text.matchAll(WORD)].find((m) => bare(m[0]) === name)?.[0] ?? name;
      add('name', shown);
    }

    if (field === 'essence') {
      for (const run of copiedRuns(letter, text)) add('copied', run);
    }
  }

  return { ok: problems.length === 0, problems };
}

/** Curly quotes and apostrophes, as typed on phones or pasted, become straight ones. */
function normalise(text: string): string {
  return text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');
}

/** Lowercase form without a possessive "'s", so "Meena's" matches "Meena". */
function bare(word: string): string {
  return normalise(word).toLowerCase().replace(/'s$/, '').replace(/^'+|'+$/g, '');
}

function isCaseless(word: string): boolean {
  return [...word].some((ch) => /\p{L}/u.test(ch) && ch.toLowerCase() === ch.toUpperCase());
}

/** Every word that appears in lowercase somewhere in the text. */
function lowercaseVocab(text: string): Set<string> {
  const vocab = new Set<string>();
  for (const m of normalise(text).matchAll(WORD)) {
    if (m[0] === m[0].toLowerCase()) vocab.add(bare(m[0]));
  }
  return vocab;
}

/**
 * Capitalised words that may be names. Mid-sentence, every capitalised word counts.
 * At the start of a sentence (or line), a word counts unless it is a common opener or
 * appears in lowercase elsewhere ("Keep the notebook… keep drawing").
 */
function nameCandidates(text: string, vocab: Set<string>, midSentenceOnly = false): Set<string> {
  const names = new Set<string>();
  const t = normalise(text);
  for (const m of t.matchAll(WORD)) {
    const word = m[0];
    if (!/^\p{Lu}/u.test(word)) continue;
    const key = bare(word);
    if (ALLOWLIST.has(key)) continue;
    const before = t.slice(0, m.index).trimEnd();
    const sentenceStart = before === '' || /[.!?…:;"(\n\r]$/.test(before) || /[\n\r]\s*$/.test(t.slice(0, m.index));
    if (sentenceStart && (midSentenceOnly || COMMON_OPENERS.has(key) || vocab.has(key))) continue;
    names.add(key);
  }
  return names;
}

/** Digit runs (with spaces, dots, dashes or brackets) holding 7 or more digits. */
function phoneNumbers(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/\+?\d[\d\s().\/-]*\d/g)) {
    if ((m[0].match(/\d/g) ?? []).length >= 7) found.push(m[0].trim());
  }
  return found;
}

/** Spans of the essence that share COPY_RUN or more consecutive words with the letter. */
function copiedRuns(letter: string, essence: string): string[] {
  const tokens = (s: string) => [...normalise(s).toLowerCase().matchAll(/[\p{L}\p{N}']+/gu)].map((m) => m[0]);
  const letterTokens = tokens(letter);
  const grams = new Set<string>();
  for (let i = 0; i + COPY_RUN <= letterTokens.length; i++) {
    grams.add(letterTokens.slice(i, i + COPY_RUN).join(' '));
  }

  const essenceTokens = tokens(essence);
  const covered = new Array<boolean>(essenceTokens.length).fill(false);
  for (let i = 0; i + COPY_RUN <= essenceTokens.length; i++) {
    if (grams.has(essenceTokens.slice(i, i + COPY_RUN).join(' '))) covered.fill(true, i, i + COPY_RUN);
  }

  const runs: string[] = [];
  let start = -1;
  for (let i = 0; i <= covered.length; i++) {
    if (covered[i] && start < 0) start = i;
    if (!covered[i] && start >= 0) {
      runs.push(essenceTokens.slice(start, i).join(' '));
      start = -1;
    }
  }
  return runs;
}
