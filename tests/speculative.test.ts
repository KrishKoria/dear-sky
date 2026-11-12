import { expect, test } from 'bun:test';
import { Speculative } from '../src/lib/engine/speculative';

/** Work whose runs finish only when the test says so. */
function controlled() {
  const calls: { key: string; urgent: boolean; finish: (v: string) => void }[] = [];
  const work = (key: string, urgent: boolean) =>
    new Promise<string>((resolve) => calls.push({ key, urgent, finish: resolve }));
  return { calls, work };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('a primed result is reused when the text is unchanged', async () => {
  const { calls, work } = controlled();
  const s = new Speculative(work);
  s.prime('a');
  calls[0]!.finish('result-a');
  await tick();
  expect(await s.get('a')).toBe('result-a');
  expect(calls).toHaveLength(1);
});

test('get joins a run that is still in flight', async () => {
  const { calls, work } = controlled();
  const s = new Speculative(work);
  s.prime('a');
  const pending = s.get('a');
  calls[0]!.finish('result-a');
  expect(await pending).toBe('result-a');
  expect(calls).toHaveLength(1);
});

test('latest wins: one run at a time, the newest text runs next, the ones in between never run', async () => {
  const { calls, work } = controlled();
  const s = new Speculative(work);
  s.prime('a');
  s.prime('ab');
  s.prime('abc');
  expect(calls.map((c) => c.key)).toEqual(['a']);
  calls[0]!.finish('result-a');
  await tick();
  expect(calls.map((c) => c.key)).toEqual(['a', 'abc']);
  expect(calls[1]!.urgent).toBe(false);
});

test('changed text runs fresh and urgent, and drops the queued background run', async () => {
  const { calls, work } = controlled();
  const s = new Speculative(work);
  s.prime('a');
  s.prime('ab');
  const pending = s.get('final');
  expect(calls.map((c) => [c.key, c.urgent])).toEqual([['a', false], ['final', true]]);
  calls[1]!.finish('result-final');
  expect(await pending).toBe('result-final');
  calls[0]!.finish('result-a');
  await tick();
  expect(calls).toHaveLength(2); // 'ab' was never run
});

test('results that must not be kept are computed again', async () => {
  let n = 0;
  const s = new Speculative(async () => `try-${++n}`, (v) => v !== 'try-1');
  s.prime('a');
  await tick();
  expect(await s.get('a')).toBe('try-2'); // try-1 was not kept, so get ran again
  expect(await s.get('a')).toBe('try-2'); // and try-2 was
});

test('a failed background run never throws from prime, and get runs again', async () => {
  let n = 0;
  const s = new Speculative(async () => {
    if (++n === 1) throw new Error('boom');
    return 'ok';
  });
  s.prime('a');
  await tick();
  expect(await s.get('a')).toBe('ok');
});
