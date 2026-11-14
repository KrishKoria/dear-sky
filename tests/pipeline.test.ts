import { expect, test } from 'bun:test';
import { LetterPipeline, type Progress, type Steps } from '../src/lib/engine/pipeline';
import type { Essence, SafetyResult } from '../src/lib/engine/types';

type Call = { stage: string; letter: string; urgent: boolean; resolve: (v: unknown) => void; reject: (e: unknown) => void; delta?: (d: string) => void };

/** Steps whose calls finish only when the test says so. */
function controlled() {
  const calls: Call[] = [];
  const call = <T>(stage: string, letter: string, urgent: boolean, delta?: (d: string) => void) =>
    new Promise<T>((resolve, reject) => calls.push({ stage, letter, urgent, resolve: resolve as (v: unknown) => void, reject, delta }));
  const steps: Steps = {
    safety: (l, u) => call<SafetyResult>('safety', l, u),
    reflection: (l, u, d) => call<string>('reflection', l, u, d),
    essence: (l, u) => call<Essence>('essence', l, u),
  };
  const last = () => calls[calls.length - 1]!;
  return { calls, steps, last };
}

const tick = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};
const SAFE: SafetyResult = { risk: false, modelChecked: true };
const ESSENCE: Essence = { feeling: 'longing', essence: 'I still set two cups out.', motif: 'two cups' };
const order = (calls: Call[]) => calls.map((c) => `${c.stage}:${c.letter}${c.urgent ? '!' : ''}`);

test('a pause works ahead through safety, reflection and essence, one prompt at a time', async () => {
  const { calls, steps, last } = controlled();
  const p = new LetterPipeline(steps);
  p.prepare('dear nana');
  expect(order(calls)).toEqual(['safety:dear nana']);
  last().resolve(SAFE);
  await tick();
  expect(order(calls)).toEqual(['safety:dear nana', 'reflection:dear nana']);
  last().resolve('A note.');
  await tick();
  expect(order(calls)).toEqual(['safety:dear nana', 'reflection:dear nana', 'essence:dear nana']);
});

test('the next pause retries a step that failed, and starts nothing twice', async () => {
  const { calls, steps, last } = controlled();
  const p = new LetterPipeline(steps);
  p.prepare('dear nana');
  last().resolve(SAFE);
  await tick();
  last().reject(new Error('chrome hiccup'));
  await tick();
  expect(order(calls)).toEqual(['safety:dear nana', 'reflection:dear nana']);

  p.prepare('dear nana'); // same text, a later pause
  expect(order(calls)).toEqual(['safety:dear nana', 'reflection:dear nana', 'reflection:dear nana']);
  p.prepare('dear nana'); // and again while that one is still running
  expect(calls).toHaveLength(3);
});

test('latest wins: an older text never gets the rest of its pipeline, and texts in between are skipped', async () => {
  const { calls, steps, last } = controlled();
  const p = new LetterPipeline(steps);
  p.prepare('a');
  p.prepare('ab');
  p.prepare('abc');
  expect(order(calls)).toEqual(['safety:a']); // one prompt in flight
  last().resolve(SAFE);
  await tick();
  expect(order(calls)).toEqual(['safety:a', 'safety:abc']);
});

test('a flagged letter gets no reflection or essence in the background (D19)', async () => {
  const { calls, steps, last } = controlled();
  const p = new LetterPipeline(steps);
  p.prepare('a risk letter');
  last().resolve({ risk: true, modelChecked: true });
  await tick();
  expect(order(calls)).toEqual(['safety:a risk letter']);
  expect(await p.checkSafety('a risk letter')).toEqual({ risk: true, modelChecked: true });
});

test('done after the work is finished: safety and reflection come back without new prompts', async () => {
  const { calls, steps, last } = controlled();
  const p = new LetterPipeline(steps);
  p.prepare('dear nana');
  last().resolve(SAFE);
  await tick();
  last().delta!('A ');
  last().delta!('note.');
  last().resolve('A note.');
  await tick();

  expect(await p.checkSafety('dear nana')).toEqual(SAFE);
  const seen: string[] = [];
  expect(await p.reflect('dear nana', (d) => seen.push(d))).toBe('A note.');
  expect(seen).toEqual(['A ', 'note.']);
  expect(order(calls)).toEqual(['safety:dear nana', 'reflection:dear nana', 'essence:dear nana']);
});

test('done while the reflection is being written: earlier words replay, then it follows live', async () => {
  const { steps, last } = controlled();
  const p = new LetterPipeline(steps);
  p.prepare('dear nana');
  last().resolve(SAFE);
  await tick();
  const writing = last();
  writing.delta!('Leaving ');

  const seen: string[] = [];
  const text = p.reflect('dear nana', (d) => seen.push(d));
  expect(seen).toEqual(['Leaving ']);
  writing.delta!('the watch.');
  writing.resolve('Leaving the watch.');
  expect(await text).toBe('Leaving the watch.');
  expect(seen).toEqual(['Leaving ', 'the watch.']);
});

test('a changed letter at done runs fresh, at user priority', async () => {
  const { calls, steps, last } = controlled();
  const p = new LetterPipeline(steps);
  p.prepare('draft');
  const pending = p.checkSafety('final');
  expect(order(calls)).toEqual(['safety:draft', 'safety:final!']);
  last().resolve(SAFE);
  expect(await pending).toEqual(SAFE);
});

test('a background safety check that could not use the model runs again when someone waits', async () => {
  const { calls, steps } = controlled();
  const p = new LetterPipeline(steps);
  p.prepare('dear nana');
  const pending = p.checkSafety('dear nana'); // joins the background run
  calls[0]!.resolve({ risk: false, modelChecked: false });
  await tick();
  expect(order(calls)).toEqual(['safety:dear nana', 'safety:dear nana!']);
  calls[1]!.resolve(SAFE);
  expect(await pending).toEqual(SAFE);
});

test('a failed background essence runs again when someone waits', async () => {
  const { calls, steps, last } = controlled();
  const p = new LetterPipeline(steps);
  p.prepare('dear nana');
  last().resolve(SAFE);
  await tick();
  last().resolve('A note.');
  await tick();
  const pending = p.condense('dear nana'); // joins the background essence
  last().reject(new Error('empty reply twice'));
  await tick();
  expect(order(calls).slice(-2)).toEqual(['essence:dear nana', 'essence:dear nana!']);
  last().resolve(ESSENCE);
  expect(await pending).toEqual(ESSENCE);
});

test('progress follows the newest letter', async () => {
  const { steps, last } = controlled();
  const p = new LetterPipeline(steps);
  const seen: Progress[] = [];
  p.progress.subscribe((s) => seen.push(s));
  p.prepare('dear nana');
  last().resolve(SAFE);
  await tick();
  expect(seen.at(-1)).toEqual({ safety: 'done', reflection: 'running', essence: 'idle' });
  p.prepare('dear nana, again');
  expect(seen.at(-1)).toEqual({ safety: 'idle', reflection: 'idle', essence: 'idle' });
});

test('clear lets go of a burned letter: its note is never replayed, and progress is idle', async () => {
  const { calls, steps, last } = controlled();
  const progress: Progress[] = [];
  const p = new LetterPipeline(steps);
  p.progress.subscribe((s) => progress.push(s));
  p.prepare('dear nana');
  last().resolve(SAFE);
  await tick();
  last().resolve('A note.');
  await tick();
  p.clear();
  expect(progress.at(-1)).toEqual({ safety: 'idle', reflection: 'idle', essence: 'idle' });
  // The essence prompt already in flight finishes into nothing.
  last().resolve(ESSENCE);
  await tick();
  expect(progress.at(-1)).toEqual({ safety: 'idle', reflection: 'idle', essence: 'idle' });
  // The same words written again are a new letter: the old note is gone.
  const before = calls.length;
  void p.reflect('dear nana', () => {});
  await tick();
  expect(order(calls.slice(before))).toEqual(['reflection:dear nana!']);
});
