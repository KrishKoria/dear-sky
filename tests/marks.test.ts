import { expect, test } from 'bun:test';
import { markSegments } from '../src/lib/ui/marks';

const join = (s: { text: string }[]) => s.map((x) => x.text).join('');

test('no matches: one plain run', () => {
  expect(markSegments('a quiet line', [])).toEqual([{ text: 'a quiet line', mark: false }]);
  expect(markSegments('', [])).toEqual([{ text: '', mark: false }]);
});

test('marks every occurrence and joins back to the text', () => {
  const text = 'I keep your number in Lucknow, in Lucknow still';
  const s = markSegments(text, ['Lucknow']);
  expect(s.filter((x) => x.mark).map((x) => x.text)).toEqual(['Lucknow', 'Lucknow']);
  expect(join(s)).toBe(text);
});

test('overlapping matches keep the earlier one', () => {
  const s = markSegments('wear your shawl when cold', ['wear your shawl', 'shawl when']);
  expect(s).toEqual([
    { text: 'wear your shawl', mark: true },
    { text: ' when cold', mark: false },
  ]);
});
