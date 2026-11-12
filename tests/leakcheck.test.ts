import { describe, expect, test } from 'bun:test';
import { leakCheck, type LeakKind } from '../src/lib/privacy/leakcheck';
import { LETTERS } from '../src/lab/letters';

// All letters are fictional.
const kinds = (letter: string, essence: string, motif = 'a paper lantern') =>
  leakCheck(letter, { essence, motif }).problems.map((p) => p.kind);

describe('names from the letter', () => {
  const letter = `Amma, I still make your rasam on Sundays. Meena from MG Road asked about you. Rakesh never called back.`;

  test.each<[string, string, LeakKind[]]>([
    ['clean words pass', 'I still make your soup on slow Sundays.', []],
    ['allowlisted family name passes', 'Amma, the kitchen still smells like you.', []],
    ['mid-sentence name is blocked', 'I wish meena had stayed for dinner.', ['name']],
    ['possessive is blocked', "I still have Meena's recipe card.", ['name']],
    ['sentence-initial name in the letter is blocked', 'You and rakesh were never the same after.', ['name']],
    ['place words are blocked', 'The walk to the road felt shorter with you.', ['name']],
  ])('%s', (_, essence, expected) => {
    expect(kinds(letter, essence)).toEqual(expected);
  });

  test('a salutation name with a comma is a name', () => {
    expect(kinds(`Sophie, you left without a word.`, 'I wanted sophie to stay.')).toEqual(['name']);
  });

  test('a common word that only starts a sentence is not a name', () => {
    const l = `Keep the blue notebook. Promise me you will draw again.`;
    expect(kinds(l, 'I hope you keep drawing in that notebook.')).toEqual([]);
  });

  test('a word that also appears in lowercase is not a name', () => {
    const l = `Tram rides were our thing. I took the tram alone today.`;
    expect(kinds(l, 'Every tram ride still feels half empty.')).toEqual([]);
  });

  test('curly apostrophes are normalised', () => {
    expect(kinds(`I can’t forget Priya’s laugh.`, 'I still hear priya’s laugh.')).toEqual(['name']);
  });
});

describe('capitalised words in the lantern words themselves', () => {
  test('a name the model added mid-sentence is blocked', () => {
    expect(kinds('I miss her laugh.', 'I still hear Priya laugh at night.')).toEqual(['name']);
  });

  test('a capitalised motif word is blocked', () => {
    expect(kinds('We rode the tram every day.', 'I miss the rides we took.', 'a Melbourne tram')).toEqual(['name']);
  });

  test('a motif from the letter is fine (motifs are objects from the letter)', () => {
    expect(kinds('Keep the blue notebook.', 'I hope you never stop drawing.', 'a blue notebook')).toEqual([]);
  });
});

describe('contact details', () => {
  test.each<[string, LeakKind]>([
    ['Call me on +91 98765 43210 sometime.', 'phone'],
    ['My number is still (555) 123-4567.', 'phone'],
    ['I never deleted 9876543210.', 'phone'],
    ['Write to me at meena.k@gmail.com someday.', 'email'],
    ['I still read https://example.org/our-blog at night.', 'url'],
    ['Your old page www.example.com is gone.', 'url'],
    ['I still check insta.com for your photos.', 'url'],
    ['I still check @meena_k every night.', 'handle'],
  ])('%s → %s', (essence, kind) => {
    expect(kinds('A plain letter.', essence)).toEqual([kind]);
  });

  test('an email is reported once, not also as a URL or handle', () => {
    expect(kinds('A plain letter.', 'Write to me at friend@mail.com.')).toEqual(['email']);
  });

  test('short numbers are fine', () => {
    expect(kinds('A plain letter.', 'After 20 years I still set 2 cups out.')).toEqual([]);
  });
});

describe('copied letter text (D25)', () => {
  test('5 or more words in a row from the letter are blocked', () => {
    const l = 'I miss your voice saying my name from the kitchen.';
    const result = leakCheck(l, { essence: 'Your voice saying my name from the kitchen.', motif: 'a kitchen' });
    expect(result.problems).toEqual([
      { kind: 'copied', field: 'essence', match: 'your voice saying my name from the kitchen' },
    ]);
  });

  test('4 shared words in a row are fine', () => {
    expect(kinds('I miss your voice every day.', 'Your voice every morning would be enough.')).toEqual([]);
  });

  test('copying is judged with curly and straight apostrophes alike', () => {
    expect(kinds(`I’m still not ready to let go.`, "I'm still not ready to let go of you.")).toEqual(['copied']);
  });

  test('the motif may reuse letter words', () => {
    expect(kinds('the yellow tram we took to school', 'Those rides were the best part of my week.', 'the yellow tram we took')).toEqual([]);
  });
});

describe('scripts without capital letters', () => {
  test('caseless words in the lantern words are blocked', () => {
    expect(kinds('A plain letter.', 'मैं तुम्हें याद करती हूँ')).toContain('script');
  });
});

// Regression: the five essences nano_v3 returned in the 2026-11-12 lab re-run (PREP.md §3b-2).
describe('lab re-run, 2026-11-12', () => {
  test.each<[keyof typeof LETTERS, string, boolean]>([
    ['amma', 'Your voice saying my name from the kitchen.', false],
    ['ex', 'I loved you more loudly than you could hear.', false],
    ['manager', 'I say your line to every new hire now.', false],
    ['younger', 'Keep the blue notebook. Keep the ugly sketches.', false],
    ['abroad', 'Calls became messages, then just birthday reactions.', true], // a paraphrase
  ])('%s: "%s" → ok %p', (name, essence, ok) => {
    expect(leakCheck(LETTERS[name], { essence, motif: 'a paper lantern' }).ok).toBe(ok);
  });
});
