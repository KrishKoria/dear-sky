import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { SEEDS } from '../functions/scripts/seeds';
import { FEELINGS } from '../src/lib/engine/prompts';
import { isLanternWords, readKindred, readModeration, wordsJson } from '../src/lib/sky/lantern';

const words = { feeling: 'longing', essence: 'I still keep your number.', motif: 'a shawl' } as const;

test('the lantern shape', () => {
  expect(isLanternWords(words)).toBe(true);
  expect(isLanternWords({ ...words, feeling: 'rage' })).toBe(false);
  expect(isLanternWords({ ...words, essence: '   ' })).toBe(false);
  expect(isLanternWords({ ...words, essence: 'x'.repeat(141) })).toBe(false);
  expect(isLanternWords({ ...words, motif: 'x'.repeat(61) })).toBe(false);
  expect(isLanternWords(null)).toBe(false);
});

test('a model is shown exactly the three fields', () => {
  const extra = { ...words, uid: 'abc', letter: 'Dear Nani' } as unknown as typeof words;
  expect(Object.keys(JSON.parse(wordsJson(extra)))).toEqual(['feeling', 'essence', 'motif']);
});

test('moderation replies: anything odd is unchecked, never clear', () => {
  expect(readModeration('{"allowed":true}')).toBe('clear');
  expect(readModeration('{"allowed":false}')).toBe('held');
  expect(readModeration('{"allowed":"yes"}')).toBe('unchecked');
  expect(readModeration('')).toBe('unchecked');
  expect(readModeration('sure!')).toBe('unchecked');
});

test('kindred replies: only real ids, no repeats, at most three', () => {
  const ids = ['a', 'b', 'c', 'd'];
  expect(readKindred('{"ids":["b","zz","b","a","c","d"]}', ids)).toEqual(['b', 'a', 'c']);
  expect(readKindred('{"ids":[]}', ids)).toEqual([]);
  expect(readKindred('nope', ids)).toEqual([]);
});

test('every seed fits the lantern shape, and every feeling is seeded', () => {
  expect(SEEDS.length).toBeGreaterThanOrEqual(40);
  for (const s of SEEDS) expect(isLanternWords(s)).toBe(true);
  expect(new Set(SEEDS.map((s) => s.feeling))).toEqual(new Set(FEELINGS));
  expect(new Set(SEEDS.map((s) => s.essence)).size).toBe(SEEDS.length);
});

test("the Firestore rules' feeling list matches the app's", () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const list = /return \[([^\]]+)\];/.exec(rules)?.[1] ?? '';
  expect(list.split(',').map((s) => s.trim().replace(/'/g, ''))).toEqual([...FEELINGS]);
});
