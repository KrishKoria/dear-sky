import { beforeAll, expect, test } from 'bun:test';

/** Just enough of the browser's audio to watch what sound.ts builds and starts. */
class FakeParam {
  value = 0;
  cancelScheduledValues() {}
  setValueAtTime(v: number) {
    this.value = v;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
  }
}
class FakeNode {
  gain = new FakeParam();
  connect<T>(to: T): T {
    return to;
  }
}
class FakeSource extends FakeNode {
  buffer: unknown;
  onended: (() => void) | null = null;
  start() {}
  stop() {}
}
const made = { contexts: 0, audios: [] as FakeAudio[], resumed: 0, fetched: [] as string[], sources: 0 };

class FakeAudio {
  currentTime = 0;
  duration = 100;
  paused = true;
  plays = 0;
  listeners: Record<string, (() => void)[]> = {};
  preload = '';
  constructor(public src: string) {
    made.audios.push(this);
  }
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  play() {
    this.paused = false;
    this.plays++;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  fire(type: string) {
    for (const fn of this.listeners[type] ?? []) fn();
  }
}
class FakeContext {
  currentTime = 0;
  destination = {};
  constructor() {
    made.contexts++;
  }
  createGain() {
    return new FakeNode();
  }
  createMediaElementSource() {
    made.sources++;
    return new FakeNode();
  }
  createBufferSource() {
    return new FakeSource();
  }
  decodeAudioData() {
    return Promise.resolve({ duration: 10 });
  }
  resume() {
    made.resumed++;
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
}

let sound: typeof import('../src/lib/sound/sound');
const handlers: Record<string, () => void> = {};

beforeAll(async () => {
  const g = globalThis as Record<string, unknown>;
  g.AudioContext = FakeContext;
  g.Audio = FakeAudio;
  g.fetch = (url: string) => {
    made.fetched.push(String(url));
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) });
  };
  g.localStorage = { getItem: () => null, setItem() {} };
  g.window = {
    addEventListener: (type: string, fn: () => void) => (handlers[type] = fn),
    removeEventListener() {},
  };
  g.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  sound = await import('../src/lib/sound/sound');
  sound.installSound();
  handlers.pointerdown();
});

const skyElements = () => made.audios.filter((a) => a.src.includes('sky-pad'));

test('the first gesture resumes the context and fetches only the rise that is played', () => {
  expect(made.contexts).toBe(1);
  expect(made.resumed).toBeGreaterThan(0);
  const files = made.fetched.map((u) => u.split('/').pop());
  expect(files).toContain('rise-barn.m4a');
  expect(files).not.toContain('rise-large.m4a');
  expect(files).not.toContain('rise-medium.m4a');
});

test('opening and closing the sky again and again reuses its two elements', () => {
  for (let i = 0; i < 4; i++) {
    sound.skyMusic(true);
    sound.skyMusic(false);
  }
  sound.skyMusic(true);
  expect(skyElements().length).toBe(2);
  expect(made.sources).toBe(4);
  expect(skyElements()[0].plays).toBeGreaterThan(1);
});

test('a piece that ends before the loop watcher ticks hands over to the other element', () => {
  const [first, second] = skyElements();
  expect(first.paused).toBe(false);
  const before = second.plays;
  first.paused = true;
  first.fire('ended');
  expect(second.plays).toBe(before + 1);
  expect(second.paused).toBe(false);
});
