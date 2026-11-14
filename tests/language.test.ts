import { expect, test } from 'bun:test';
import { LETTERS } from '../src/lab/letters';
import { caselessShare, englishShare, MIN_ENGLISH_SHARE, releaseLanguage } from '../src/lib/privacy/language';

// Fictional letters, roughly the length of the lab letters.
const GERMAN = `Liebe Oma, dein Garten ist jetzt ganz still. Ich gehe jeden Sonntag hin und gieße die Rosen, auch wenn sie mich nicht mehr erkennen würden. Mama sagt, ich soll loslassen, aber ich rieche noch immer deinen Kuchen, wenn ich die Küche betrete.`;
const SPANISH = `Abuela, todavía guardo tu delantal en el cajón de la cocina. Los domingos hago tu sopa pero nunca sabe igual, creo que le ponías algo que nunca me dijiste. Mamá dice que debo dejar de ir a tu casa, pero me siento en tu silla de todos modos.`;
const FRENCH = `Papi, ton jardin est devenu silencieux. Je vais encore le dimanche arroser tes tomates, même si elles ne me reconnaissent plus. Maman dit que je dois passer à autre chose, mais je garde ta casquette sur le crochet près de la porte.`;
const HINGLISH = `Amma, tumhari yaad bahut aati hai. Har Sunday main tumhara rasam banati hoon par woh kabhi waisa nahi banta. Meena aunty kehti hai ki ghar mat jaya karo par main phir bhi tumhari kursi pe baith jaati hoon.`;

test('caselessShare', () => {
  expect(caselessShare('Hello there')).toBe(0);
  expect(caselessShare('ありがとう')).toBe(1);
  expect(caselessShare('12 !!')).toBe(0);
  expect(caselessShare('Ça va? Schön.')).toBe(0); // accents have case
});

test.each(Object.entries(LETTERS))('English lab letter "%s" may be released', (_, letter) => {
  expect(englishShare(letter)).toBeGreaterThan(MIN_ENGLISH_SHARE);
  expect(releaseLanguage(letter)).toEqual({ ok: true });
});

test.each([
  ['German', GERMAN],
  ['Spanish', SPANISH],
  ['French', FRENCH],
  ['Hinglish', HINGLISH],
])('%s is held back', (_, letter) => {
  expect(englishShare(letter)).toBeLessThan(MIN_ENGLISH_SHARE);
  expect(releaseLanguage(letter)).toEqual({ ok: false, reason: 'not-english' });
});

test('a caseless script is held back', () => {
  expect(releaseLanguage('नानी, मुझे तुम्हारी बहुत याद आती है')).toEqual({ ok: false, reason: 'script' });
});

test('one caseless word in a long English letter is tolerated', () => {
  const english = 'I still keep your scarf on the hook by the door and I think of you every winter morning. ';
  expect(releaseLanguage(`${english}${english}नानी`)).toEqual({ ok: true });
});

test('a very short letter is not judged (the leak check still runs)', () => {
  expect(releaseLanguage('Liebe Oma, ich vermisse dich.')).toEqual({ ok: true });
});

test('a short letter in another Latin-script language is held back', () => {
  expect(releaseLanguage('Te extraño mucho mamá. Nunca olvidaré el jardín donde jugábamos juntos')).toEqual({
    ok: false,
    reason: 'not-english',
  });
});

test('a short English letter without function words still passes', () => {
  expect(releaseLanguage('happy birthday dad')).toEqual({ ok: true });
  expect(releaseLanguage('miss you, mom')).toEqual({ ok: true });
});
