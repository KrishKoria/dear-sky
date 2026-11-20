/**
 * How long ago the writer kept a letter, as a plain lowercase phrase for the revisit note's prompt
 * ("earlier today", "yesterday", "5 days ago", "3 weeks ago", "4 months ago", "over a year ago").
 * Today and yesterday are calendar days in local time; a clock set backwards reads as today.
 */
const DAY_MS = 86_400_000;

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export function keptAgo(keptAt: number, now: number): string {
  // Rounded, because a local day is 23 or 25 hours long when the clocks change.
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(keptAt)) / DAY_MS));
  if (days === 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days <= 13) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks <= 8) return `${weeks} weeks ago`;
  if (days >= 365) return 'over a year ago';
  return `${Math.floor(days / 30.44)} months ago`;
}

/** A "you" right after one of these is the object: "for you", "I miss you", "I made you look". */
const OBJECT_AFTER = new Set([
  // Prepositions. Not "like", "than", "before", "after", "since" or "until": a subject often follows them.
  'to', 'for', 'with', 'at', 'about', 'without', 'of', 'from', 'behind', 'beside', 'near', 'around',
  'toward', 'towards', 'into', 'onto', 'upon', 'against', 'among', 'between', 'by', 'past', 'under',
  'over', 'through', 'within', 'despite', 'beyond',
  // Verbs that take a person. Not "know", "remember" or "believe": "I knew you were" is a subject.
  'thank', 'thanked', 'miss', 'missed', 'love', 'loved', 'hate', 'hated', 'forgive', 'forgave',
  'make', 'made', 'let', 'help', 'helped', 'tell', 'told', 'ask', 'asked', 'want', 'wanted', 'need',
  'needed', 'see', 'saw', 'watch', 'watched', 'hear', 'heard', 'call', 'called', 'hug', 'hugged',
  'kiss', 'kissed', 'bring', 'brought', 'give', 'gave', 'show', 'showed', 'owe', 'owed', 'meet', 'met',
  'lose', 'lost', 'left', 'find', 'found', 'blame', 'blamed', 'trust', 'trusted', 'hurt', 'visit',
  'visited', 'texted', 'phoned',
]);

const THEIRS: Record<string, string> = { your: 'their', yours: 'theirs', yourself: 'themselves', yourselves: 'themselves' };

function matchCase(from: string, to: string): string {
  if (from.length > 1 && from === from.toUpperCase()) return to.toUpperCase();
  return from[0] === from[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to;
}

/**
 * The letter as the revisit prompt shows it: the person it was written to becomes "they". In the
 * letter "you" is that person, but in the note "you" is the writer, and a small model mixes the
 * two up (2026-11-20: both "papa" notes gave the father's kept report cards to the writer). Only
 * the model on this device reads the result; the writer never sees it. Subject or object is
 * guessed from the word before and the mark after, and a rare wrong guess still says who is meant.
 */
export function theyForYou(letter: string): string {
  return letter.replace(/\b(?:you|your|yours|yourself|yourselves)\b/gi, (word: string, offset: number) => {
    const lower = word.toLowerCase();
    if (lower !== 'you') return matchCase(word, THEIRS[lower]);
    const before = /([a-z']+)[ \t]+$/i.exec(letter.slice(Math.max(0, offset - 24), offset))?.[1].toLowerCase();
    const after = letter.slice(offset + word.length);
    const contracted = /^['’]/.test(after); // you're, you'll, you'd, you've: always the subject
    const atEnd = /^[ \t]*(?:[.,!?;:)"”—–-]|\n|$)/.test(after);
    const object = !contracted && ((before !== undefined && OBJECT_AFTER.has(before)) || atEnd);
    return matchCase(word, object ? 'them' : 'they');
  });
}
