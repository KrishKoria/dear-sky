import { expect, mock, test } from 'bun:test';
import type { Readiness } from '../src/lib/engine/readiness';

/** Every prompt the fake on-device model receives, in order. */
const prompts: string[] = [];

// Firebase AI Logic with one fake: every model answers at once, from the device. The rest of the
// module stays real, because a Bun module mock applies to every test file in the run.
const real = await import('firebase/ai');
mock.module('firebase/ai', () => ({
  ...real,
  getGenerativeModel: () => ({
    initializeDeviceModel: () => Promise.resolve(),
    generateContent: (prompt: string) => {
      prompts.push(prompt);
      return Promise.resolve({ response: { inferenceSource: real.InferenceSource.ON_DEVICE, text: () => 'ok' } });
    },
  }),
}));
(globalThis as { LanguageModel?: unknown }).LanguageModel = { availability: () => Promise.resolve('available') };

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
