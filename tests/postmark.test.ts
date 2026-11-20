import { expect, test } from 'bun:test';
import { postmark, wordsSent, type Journey } from '../src/lib/privacy/postmark';
import { approveRelease, type ApprovedWords } from '../src/lib/privacy/release';
import { DEMO_LETTER } from './fixtures';

function approved(): ApprovedWords {
  const v = approveRelease(DEMO_LETTER, {
    feeling: 'longing',
    essence: 'I still keep your number, just in case the phone rings.',
    motif: 'a shawl',
  });
  if (!v.ok) throw new Error('the fixture words should pass');
  return v.words;
}

const journey = (over: Partial<Journey> = {}): Journey => ({
  letter: DEMO_LETTER,
  words: 'device',
  sent: approved(),
  paintedBy: 'device',
  kindred: 0,
  ...over,
});

test('the count that left is exactly the words in the payload', () => {
  // longing (1) + the line (11) + a shawl (2)
  expect(wordsSent(approved())).toBe(14);
  expect(postmark(journey()).left).toBe(14);
});

test('the letter is counted whole and always stays on this device', () => {
  const words = DEMO_LETTER.trim().split(/\s+/).length;
  const [first] = postmark(journey()).stamps;
  expect(first.what).toBe(`your letter, all ${words} words`);
  expect(first.where).toBe('device');
});

test("who wrote the lantern's words is told as it happened", () => {
  const how = (words: Journey['words']) => postmark(journey({ words })).stamps[1];
  expect(how('device')).toMatchObject({ where: 'device', how: 'found on this device' });
  expect(how('edited').how).toContain('changed by you');
  expect(how('own')).toMatchObject({ where: 'you', how: 'written by you' });
});

test('the picture is credited to whoever chose it', () => {
  const where = (paintedBy: Journey['paintedBy']) =>
    postmark(journey({ paintedBy })).stamps.find((s) => s.what === 'its picture')?.where;
  expect(where('device')).toBe('device');
  expect(where('cloud')).toBe('cloud');
  expect(where('words')).toBe('code');
});

test('kindred are only mentioned when some were found', () => {
  expect(postmark(journey()).stamps.some((s) => s.what.includes('kindred'))).toBe(false);
  const found = postmark(journey({ kindred: 2 })).stamps.at(-1);
  expect(found).toMatchObject({ what: 'found two kindred lanterns', where: 'cloud' });
});
