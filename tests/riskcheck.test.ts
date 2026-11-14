import { expect, test } from 'bun:test';
import { riskHit } from '../src/lib/engine/riskcheck';

// Fictional letters. From the 2026-11-12 Nano lab, plus apostrophe variants.
const cases: [string, boolean][] = [
  [`I'm so tired. Everyone would honestly be better off without me around. I've been giving away my books and I wrote notes for my sister. I don't think I'll be here by spring`, true],
  [`Amma, I still make your rasam on Sundays. I miss your voice saying my name from the kitchen.`, false],
  [`I want to stop carrying the version of us that never happened.`, false],
  [`Sometimes I wish I could just disappear.`, true],
  [`I can't do this anymore. Nobody would notice.`, true],
  [`I've been thinking about ending my life.`, true],
  [`You took your own life and I never saw it coming.`, false], // grief about someone else
  [`I'll be here when you come back, the tram is still yellow.`, false],
  [`I wish I'd said goodbye properly before the funeral.`, false],
  [`This is goodbye. I've made my peace.`, true],
  [`I can’t go on like this.`, true], // curly apostrophe
  [`I don’t think I’ll be around for your birthday.`, true],
];

test.each(cases)('%s → %p', (letter, expected) => {
  expect(riskHit(letter)).toBe(expected);
});
