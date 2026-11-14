import { expect, test } from 'bun:test';
import { followMotion } from '../src/lib/ui/motion';

function fakeQuery(matches: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  return {
    matches,
    addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.add(l),
    flip(next: boolean) {
      for (const l of listeners) l({ matches: next });
    },
  };
}

test('reads the preference once, then follows its change event', () => {
  const q = fakeQuery(false);
  const calm = followMotion(q as never);
  expect(calm()).toBe(false);
  q.flip(true);
  expect(calm()).toBe(true);
  q.flip(false);
  expect(calm()).toBe(false);
});

test('starts calm when the preference is already on', () => {
  expect(followMotion(fakeQuery(true) as never)()).toBe(true);
});
