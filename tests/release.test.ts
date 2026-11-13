import { expect, test } from 'bun:test';
import { approveRelease } from '../src/lib/privacy/release';
import { DEMO_LETTER } from './fixtures';

const clean = { feeling: 'longing' as const, essence: 'I still keep your number, just in case the phone rings.', motif: 'a shawl' };

test('clean words pass, trimmed and frozen', () => {
  const v = approveRelease(DEMO_LETTER, { ...clean, essence: `  ${clean.essence}  ` });
  expect(v.ok).toBe(true);
  if (!v.ok) return;
  expect(v.words.essence).toBe(clean.essence);
  expect(Object.isFrozen(v.words)).toBe(true);
});

test('a place from the letter, added in an edit, is held back (storyboard beat 6)', () => {
  const v = approveRelease(DEMO_LETTER, { ...clean, essence: 'I still keep your number in Lucknow, just in case.' });
  expect(v.ok).toBe(false);
  if (v.ok || v.reason !== 'leak') throw new Error('expected a leak');
  expect(v.problems.some((p) => p.match.includes('Lucknow'))).toBe(true);
});

test('five words copied from the letter are held back', () => {
  const v = approveRelease(DEMO_LETTER, { ...clean, essence: 'I wear your shawl when it is cold.' });
  expect(v.ok).toBe(false);
});

test('empty words are not released', () => {
  expect(approveRelease(DEMO_LETTER, { ...clean, essence: '   ' })).toEqual({ ok: false, reason: 'empty' });
});

test('non-English letters stay on the device (D26)', () => {
  const german = 'Liebe Oma, ich vermisse dich jeden Tag und ich denke oft an unsere Sonntage im Garten, als wir zusammen Kuchen gebacken haben.';
  expect(approveRelease(german, { ...clean, essence: 'I miss our Sundays in the garden.' })).toEqual({ ok: false, reason: 'language' });
});
