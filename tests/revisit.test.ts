import { describe, expect, test } from 'bun:test';
import { REVISIT_INITIAL, REVISIT_SYSTEM, revisitPrompt } from '../src/lib/engine/prompts';
import { keptAgo } from '../src/lib/engine/revisit';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const NOW = at(2026, 11, 20, 15);

describe('keptAgo', () => {
  test('the same calendar day is earlier today, even just after midnight', () => {
    expect(keptAgo(at(2026, 11, 20, 0, 1), NOW)).toBe('earlier today');
    expect(keptAgo(NOW, NOW)).toBe('earlier today');
    expect(keptAgo(NOW, at(2026, 11, 20, 23, 59))).toBe('earlier today');
  });

  test('yesterday is the previous calendar day, not 24 hours', () => {
    expect(keptAgo(at(2026, 11, 19, 23, 59), at(2026, 11, 20, 0, 1))).toBe('yesterday');
    expect(keptAgo(at(2026, 11, 19, 0, 0), NOW)).toBe('yesterday');
    expect(keptAgo(at(2026, 11, 18, 23, 59), NOW)).toBe('2 days ago');
  });

  test('days run up to 13, then weeks', () => {
    expect(keptAgo(at(2026, 11, 7), NOW)).toBe('13 days ago');
    expect(keptAgo(at(2026, 11, 6), NOW)).toBe('2 weeks ago');
    expect(keptAgo(at(2026, 11, 13), at(2026, 11, 26))).toBe('13 days ago');
    expect(keptAgo(at(2026, 11, 1), NOW)).toBe('2 weeks ago');
    expect(keptAgo(at(2026, 10, 30), NOW)).toBe('3 weeks ago');
  });

  test('weeks run up to 8, then months', () => {
    expect(keptAgo(at(2026, 9, 19), NOW)).toBe('8 weeks ago'); // 62 days
    expect(keptAgo(at(2026, 9, 18), NOW)).toBe('2 months ago'); // 63 days
    expect(keptAgo(at(2026, 5, 20), NOW)).toBe('6 months ago');
    expect(keptAgo(at(2025, 11, 21), NOW)).toBe('11 months ago'); // 364 days
  });

  test('a year or more is over a year ago', () => {
    expect(keptAgo(at(2025, 11, 20), NOW)).toBe('over a year ago'); // 365 days
    expect(keptAgo(at(2019, 1, 1), NOW)).toBe('over a year ago');
  });

  test('a clock set backwards reads as today, never a negative phrase', () => {
    expect(keptAgo(at(2026, 11, 25), NOW)).toBe('earlier today');
  });
});

describe('revisit prompt', () => {
  test('carries the letter and how long ago it was kept', () => {
    const prompt = revisitPrompt('Dear A, the kettle.', '3 weeks ago');
    expect(prompt).toContain('Dear A, the kettle.');
    expect(prompt).toContain('wrote this letter 3 weeks ago');
  });

  test('has three worked examples, each a note of 35 words or fewer with no question or name', () => {
    const roles = REVISIT_INITIAL.map((m) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
    const notes = REVISIT_INITIAL.filter((m) => m.role === 'assistant').map((m) => (m.content as { value: string }[])[0].value);
    for (const note of notes) {
      expect(note.split(/\s+/).length).toBeLessThanOrEqual(35);
      expect(note).not.toContain('?');
      expect(note).not.toMatch(/\b(seems|sounds|shows|quiet|weight|heavy|courage|strength|journey)\b/i);
    }
  });

  test('the instruction states the hard rules', () => {
    for (const rule of ['35 words', 'Never quote', 'No advice', 'no questions', 'No greeting']) expect(REVISIT_SYSTEM).toContain(rule);
  });
});
