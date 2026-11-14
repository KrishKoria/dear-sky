import { expect, test } from 'bun:test';
import { lazySky } from '../src/lib/sky/lazy';

/** A stand-in for the sky module that records what it was asked, and a loader that counts loads. */
function fake() {
  const calls: string[] = [];
  let loads = 0;
  const unwatched: string[] = [];
  const module = {
    release: async () => (calls.push('release'), 'id-1'),
    watch: (id: string) => (calls.push(`watch ${id}`), () => void unwatched.push(id)),
    sendWaiting: async () => void calls.push('sendWaiting'),
  };
  const load = async () => (loads++, module as never);
  return { calls, unwatched, loads: () => loads, load };
}

test('a visit with nothing in the outbox never loads the sky', async () => {
  const f = fake();
  await lazySky(f.load, async () => 0).sendWaiting();
  expect(f.loads()).toBe(0);
  expect(f.calls).toEqual([]);
});

test('lanterns waiting from an earlier visit load the sky and are sent', async () => {
  const f = fake();
  await lazySky(f.load, async () => 2).sendWaiting();
  expect(f.calls).toEqual(['sendWaiting']);
});

test('release loads the sky and hands the lantern to it', async () => {
  const f = fake();
  const id = await lazySky(f.load, async () => 0).release({} as never, 'bird' as never);
  expect(id).toBe('id-1');
  expect(f.calls).toEqual(['release']);
});

test('watching follows the lantern once the code is here, and stopping reaches it', async () => {
  const f = fake();
  const stop = lazySky(f.load, async () => 0).watch('a', () => {});
  await Promise.resolve();
  await Promise.resolve();
  expect(f.calls).toEqual(['watch a']);
  stop();
  expect(f.unwatched).toEqual(['a']);
});

test('stopping before the code has arrived means it never starts watching', async () => {
  const f = fake();
  lazySky(f.load, async () => 0).watch('a', () => {})();
  await Promise.resolve();
  await Promise.resolve();
  expect(f.calls).toEqual([]);
});
