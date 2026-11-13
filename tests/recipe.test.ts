import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { SEEDS } from '../functions/scripts/seeds';
import { FEELINGS } from '../src/lib/engine/prompts';
import { GLYPHS, GLYPH_SCHEMA, isGlyph, matchGlyph, readGlyph, recipeOf } from '../src/lib/sky/recipe';
import { GLYPH_ART } from '../src/lib/ui/glyphs';

test('the word match reads the object, which is the motif\'s last known word', () => {
  const m = (motif: string) => matchGlyph({ feeling: 'grief', essence: '', motif });
  expect(m('a front door key')).toBe('key');
  expect(m('a porch light')).toBe('flame');
  expect(m('a second teacup')).toBe('cup');
  expect(m('a soup pot')).toBe('cup');
  expect(m('a dog’s leash')).toBe('paw');
  expect(m('a jar of sand')).toBe('wave');
  expect(m('a train ticket')).toBe('boat');
  expect(m('two paper boats')).toBe('boat');
  expect(m('Yellow Umbrellas')).toBe('umbrella');
});

test('with no known word, the essence and then the feeling decide', () => {
  expect(matchGlyph({ feeling: 'love', essence: 'we sang in the car', motif: 'a thing' })).toBe('boat');
  expect(matchGlyph({ feeling: 'love', essence: 'always', motif: '' })).toBe('heart');
  for (const feeling of FEELINGS) expect(isGlyph(matchGlyph({ feeling, essence: '', motif: '' }))).toBe(true);
});

test('every seed lantern finds a picture from its own words, and the sky gets some variety', () => {
  const found = SEEDS.map((s) => matchGlyph({ ...s, essence: '' }));
  const fallback = SEEDS.filter((s) => matchGlyph({ ...s, essence: '' }) === matchGlyph({ ...s, essence: '', motif: '' }));
  expect(fallback.length).toBeLessThanOrEqual(2);
  expect(new Set(found).size).toBeGreaterThanOrEqual(10);
});

test('a recipe is the same for everyone, and a stored glyph wins', () => {
  const words = { feeling: 'grief' as const, essence: 'I still set out two cups.', motif: 'a second teacup' };
  expect(recipeOf(words)).toEqual(recipeOf({ ...words }));
  expect(recipeOf(words).glyph).toBe('cup');
  expect(recipeOf({ ...words, glyph: 'moon' }).glyph).toBe('moon');
  expect(recipeOf({ ...words, glyph: 'rocket' }).glyph).toBe('cup');
  expect(recipeOf(words).tone).toBe('ember');
  for (const feeling of FEELINGS) expect(recipeOf({ ...words, feeling }).tone).toBeTruthy();
  const ribs = new Set(SEEDS.map((s) => recipeOf(s).ribs));
  const shapes = new Set(SEEDS.map((s) => recipeOf(s).shape));
  expect([...ribs].sort()).toEqual([3, 4, 5]);
  expect([...shapes].sort()).toEqual(['bell', 'round', 'tall']);
});

test('a model reply counts only when it is exactly one glyph from the list', () => {
  expect(readGlyph('{"glyph":"bird"}')).toBe('bird');
  expect(readGlyph('{"glyph":"rocket"}')).toBeNull();
  expect(readGlyph('{"glyph":"toString"}')).toBeNull();
  expect(readGlyph('bird')).toBeNull();
  expect(readGlyph('')).toBeNull();
  expect(GLYPH_SCHEMA.properties.glyph.enum).toEqual(GLYPHS);
});

test('every glyph is drawn', () => {
  for (const g of GLYPHS) expect(GLYPH_ART[g].fill || GLYPH_ART[g].line).toBeTruthy();
});

test('the Firestore rules allow exactly the same glyphs', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const list = /function glyphs\(\) \{\s*return \[([^\]]*)\]/.exec(rules)?.[1] ?? '';
  expect(list.split(',').map((s) => s.trim().replace(/'/g, ''))).toEqual(GLYPHS);
});
