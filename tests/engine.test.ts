import { expect, mock, test } from 'bun:test';
import type { Readiness } from '../src/lib/engine/readiness';
import type { ApprovedWords } from '../src/lib/privacy/release';

/** Every prompt the fake on-device model receives, in order. */
const prompts: string[] = [];

// Firebase AI Logic with one fake: every model answers at once, from the device. The rest of the
// module stays real, because a Bun module mock applies to every test file in the run.
const real = await import('firebase/ai');

type Reply = { source: string; text: string; ms?: number };
const onDevice = (text = 'ok'): Reply => ({ source: real.InferenceSource.ON_DEVICE, text });
/** How the fake answers each model, by its inference mode. Tests may change it. */
let answer: (mode: string) => Reply = () => onDevice();

mock.module('firebase/ai', () => ({
  ...real,
  getGenerativeModel: (_ai: unknown, params: { mode: string }) => ({
    initializeDeviceModel: () => Promise.resolve(),
    generateContent: async (prompt: string) => {
      prompts.push(prompt);
      const { source, text, ms = 0 } = answer(params.mode);
      if (ms) await sleep(ms);
      return { response: { inferenceSource: source, text: () => text } };
    },
  }),
}));
let availability = 'available';
(globalThis as { LanguageModel?: unknown }).LanguageModel = { availability: () => Promise.resolve(availability) };

const { AILogicEngine } = await import('../src/lib/engine/ailogic-engine');

const settle = () => new Promise((r) => setTimeout(r, 0));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('after an idle unload, the next gesture loads the model again (D35)', async () => {
  const engine = new AILogicEngine({} as never, { idleMs: 30 });
  let state = 'warming' as Readiness['state'];
  engine.readiness.subscribe((r) => (state = r.state));

  engine.warmUp();
  await settle();
  expect(state).toBe('ready');
  expect(prompts).toHaveLength(1);

  // While warm, every keystroke offers a warm-up, and none of them prompts the model.
  engine.warmUp();
  engine.warmUp();
  await settle();
  expect(prompts).toHaveLength(1);

  // Chrome unloads the model after a quiet spell.
  await sleep(60);
  expect(state).toBe('warming');

  // The writer's next keystroke reloads it, so work-ahead can resume before "done".
  engine.warmUp();
  await settle();
  expect(prompts).toHaveLength(2);
  expect(state).toBe('ready');
});

const approved = (motif: string) =>
  ({ feeling: 'hope', essence: 'I kept the window open for you.', motif }) as unknown as ApprovedWords;

test('the lantern is painted on the device when the model is there (D13)', async () => {
  answer = (mode) => (mode === real.InferenceMode.PREFER_ON_DEVICE ? onDevice('{"glyph":"bird"}') : onDevice());
  const engine = new AILogicEngine({} as never);
  await settle();
  const before = prompts.length;
  expect(await engine.paint(approved('a kite'))).toEqual({ glyph: 'bird', by: 'device' });
  // Only the approved words go into the prompt.
  expect(prompts.slice(before)).toEqual(['{"feeling":"hope","essence":"I kept the window open for you.","motif":"a kite"}']);
});

test('a slow or odd answer never holds the lantern: the word match paints it', async () => {
  const engine = new AILogicEngine({} as never, { paintTimeoutMs: 30 });
  await settle();
  answer = () => ({ ...onDevice('{"glyph":"bird"}'), ms: 200 });
  expect(await engine.paint(approved('a front door key'))).toEqual({ glyph: 'key', by: 'words' });
  answer = () => onDevice('{"glyph":"rocket"}');
  expect(await engine.paint(approved('a front door key'))).toEqual({ glyph: 'key', by: 'words' });
  answer = () => {
    throw new Error('offline');
  };
  expect(await engine.paint(approved('a front door key'))).toEqual({ glyph: 'key', by: 'words' });
});

test('one that timed out while queued is never sent at all', async () => {
  const engine = new AILogicEngine({} as never, { paintTimeoutMs: 30 });
  await settle();
  // A long prompt is running: the glyph pick waits its turn, then gives up.
  answer = () => ({ ...onDevice(), ms: 120 });
  engine.warmUp();
  await settle();
  const before = prompts.length;
  expect((await engine.paint(approved('a candle'))).by).toBe('words');
  await sleep(150);
  expect(prompts.length).toBe(before);
});

test('with no model on this device, the cloud paints it, without queueing', async () => {
  availability = 'unavailable';
  const engine = new AILogicEngine({} as never);
  await settle();
  answer = () => ({ source: real.InferenceSource.IN_CLOUD, text: '{"glyph":"flower"}' });
  expect(await engine.paint(approved('a cherry branch'))).toEqual({ glyph: 'flower', by: 'cloud' });
  availability = 'available';
});

test('painted ahead on the device, the lantern lights at once, with no second prompt', async () => {
  const modes: string[] = [];
  answer = (mode) => {
    modes.push(mode);
    return onDevice('{"glyph":"star"}');
  };
  const engine = new AILogicEngine({} as never);
  engine.warmUp();
  await settle();
  modes.length = 0;
  const words = approved('a jar of fireflies');
  engine.sketch(words);
  await sleep(10);
  // Before approval only the on-device-only instance has seen the words.
  expect(modes).toEqual([real.InferenceMode.ONLY_ON_DEVICE]);
  expect(await engine.paint(words)).toEqual({ glyph: 'star', by: 'device' });
  expect(modes).toHaveLength(1);
});

test('only the newest words on the tag are painted ahead', async () => {
  answer = () => ({ ...onDevice('{"glyph":"moon"}'), ms: 20 });
  const engine = new AILogicEngine({} as never);
  engine.warmUp();
  await settle();
  await sleep(30);
  const before = prompts.length;
  engine.sketch(approved('a pillow'));
  engine.sketch(approved('a pillowcase'));
  engine.sketch(approved('a pillowcase, washed'));
  await sleep(120);
  expect(prompts.length - before).toBe(1);
  expect(prompts.at(-1)).toContain('washed');
});
