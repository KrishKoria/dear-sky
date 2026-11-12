import { describe, expect, test } from 'bun:test';
import { LETTERS } from '../src/lab/letters';
import { evalStyle } from '../src/lab/style-eval';

const plain = 'A plain letter about my grandmother.';

describe('rules', () => {
  test('a note that follows every rule passes', () => {
    const note = 'Leaving the watch unwound lets it keep his time a little longer. Those stones still skip badly, and somehow that keeps him close.';
    expect(evalStyle(plain, note)).toEqual({ pass: true, failures: [] });
  });

  test.each<[string, string]>([
    ['One sentence only.', 'sentences: 1 (want 2–3)'],
    ['One. Two. Three. Four.', 'sentences: 4 (want 2–3)'],
    ['The tram is still yellow. That matters, doesn’t it?', 'asks a question'],
    ['It sounds like you miss her. The kitchen holds her voice.', 'opens with "It sounds like"'],
    ['You still set two cups out. The kitchen holds her voice.', 'opens with "You"'],
    ['The house feels heavy now. Her chair still waits.', 'banned word: heavy'],
    ["It's beautiful that you still cook for her. The rasam keeps her near.", 'praise: "It\'s beautiful"'],
    ['The rasam keeps her near. You should cook it again soon.', 'advice: "You should"'],
  ])('%s → %s', (note, failure) => {
    expect(evalStyle(plain, note).failures).toContain(failure);
  });

  test('an imperative at the start of a sentence is advice', () => {
    expect(evalStyle(plain, 'Her chair still waits. Try to sit in it sometimes.').failures).toContain('advice: "Try to"');
  });

  test('"try to" describing the writer is not advice', () => {
    expect(evalStyle(plain, 'It makes sense that you still try to make things the same way. Her voice is what is missing.').pass).toBe(true);
  });

  test('a name from the letter fails', () => {
    expect(evalStyle('I miss Meena so much.', 'Meena still feels close. Her absence fills the room.').failures).toContain('name: Meena');
  });

  test('a short detail copied from the letter is fine', () => {
    const letter = 'I still make your rasam on Sundays but it never tastes right.';
    expect(evalStyle(letter, 'Your rasam on Sundays never tastes right without her. That missing taste keeps her close.').pass).toBe(true);
  });
});

// The five reflections nano_v3 wrote in the 2026-11-12 lab re-run (PREP.md §3b-2).
describe('lab re-run, 2026-11-12', () => {
  test.each<[keyof typeof LETTERS, string, string[]]>([
    ['amma', 'The rasam doesn’t taste the same without that secret ingredient. Sitting in your chair must feel like a visit. It’s clear that the missed calls are a sharp reminder of that night.', []],
    ['ex', "That number is so familiar after all these deletes. It feels like a quiet echo in the late hours. You held a great deal of love for him, even if it wasn't fully reciprocated.", ['banned word: quiet']],
    ['manager', "It's powerful that you carry that small kindness forward to new team members. That line of yours created a ripple, didn't it?", ['asks a question', 'praise: "It\'s powerful"']],
    ['younger', "It seems you felt a disconnect, a sense of being overlooked. It's good that you recognize the value in those drawings, even the imperfect ones.", ['opens with "It seems"', 'praise: "It\'s good"']],
    ['abroad', 'Holding onto the photo is a quiet way to remember the shared moments. It’s understandable that things shift, and that certain parts of yourself feel less present without someone.', ['banned word: quiet']],
  ])('%s', (name, note, failures) => {
    expect(evalStyle(LETTERS[name], note).failures).toEqual(failures);
  });
});
