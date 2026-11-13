/**
 * Dev only: a stand-in engine whose readiness the state switcher controls, so every state in
 * DESIGN.md §4b can be seen on any browser. It runs the real `LetterPipeline` with fake model
 * steps, so the UI meets the same work-ahead behaviour as the real engine (D28).
 * Never imported by production code.
 */
import { LetterPipeline, type Stage } from '../engine/pipeline';
import { riskHit } from '../engine/riskcheck';
import type { Readiness } from '../engine/readiness';
import { writable } from '../engine/store';
import type { Essence, OnDeviceEngine, Painted, SafetyResult } from '../engine/types';
import type { ApprovedWords } from '../privacy/release';
import { matchGlyph } from '../sky/recipe';

const REFLECTIONS = [
  "You write about them with such care, as if the small things are where they still live. The missing sits right beside the love here, and both feel true. It's alright to keep the door a little open.",
  "There's a tenderness in how you hold this, even the parts that still sting. You're not asking to undo anything, only to be understood. That kind of honesty takes a quiet courage.",
  "So much of this letter is gratitude that never found its way out loud. It sounds like their kindness became part of how you treat people now. That's a lovely way for something to keep going.",
];

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SimEngine implements OnDeviceEngine {
  private readonly state = writable<Readiness>({ state: 'ready' });
  readonly readiness = { subscribe: this.state.subscribe };
  /** Dev toggle: the model's safety prompt "flags" every letter. */
  risky = false;
  private download: ReturnType<typeof setInterval> | undefined;

  private readonly pipeline = new LetterPipeline({
    safety: async (letter) => {
      await this.step(700);
      return { risk: this.risky || riskHit(letter), modelChecked: true } satisfies SafetyResult;
    },
    reflection: async (letter, _urgent, onDelta) => {
      await this.step(900);
      const text = REFLECTIONS[hash(letter) % REFLECTIONS.length];
      // Chrome streams a few characters at a time.
      for (let i = 0; i < text.length; i += 9) {
        await this.step(70);
        onDelta(text.slice(i, i + 9));
      }
      return text;
    },
    essence: async () => {
      await this.step(1200);
      return { feeling: 'longing', essence: 'some doors I keep a little open', motif: 'a half-open door' } satisfies Essence;
    },
  });
  readonly progress = this.pipeline.progress;

  set(readiness: Readiness): void {
    clearInterval(this.download);
    this.state.set(readiness);
  }

  get current(): Readiness {
    return this.state.get();
  }

  /** Plays a download, then a short warm-up, then ready: the whole first-visit arc. */
  playArrival(seconds = 14): void {
    clearInterval(this.download);
    let progress = 0;
    this.state.set({ state: 'downloading', progress });
    this.download = setInterval(() => {
      progress = Math.min(1, progress + 0.25 / seconds + Math.random() * (0.5 / seconds));
      if (progress < 1) return this.state.set({ state: 'downloading', progress });
      clearInterval(this.download);
      this.state.set({ state: 'warming' });
      setTimeout(() => this.state.get().state === 'warming' && this.state.set({ state: 'ready' }), 2600);
    }, 250);
  }

  warmUp(): void {}

  preload(letter: string, depth?: Stage): void {
    const { state } = this.state.get();
    if (!letter.trim() || (state !== 'ready' && state !== 'slow')) return;
    this.pipeline.prepare(letter, depth);
  }

  checkSafety(letter: string): Promise<SafetyResult> {
    if (this.state.get().state === 'unavailable') return Promise.resolve({ risk: riskHit(letter), modelChecked: false });
    return this.pipeline.checkSafety(letter);
  }

  async reflect(letter: string, onText: (delta: string, soFar: string) => void): Promise<string> {
    let soFar = '';
    const text = await this.pipeline.reflect(letter, (delta) => {
      soFar += delta;
      onText(delta, soFar);
    });
    return text.trim();
  }

  condense(letter: string): Promise<Essence> {
    return this.pipeline.condense(letter);
  }

  forget(): void {
    this.pipeline.clear();
  }

  sketch(): void {
    // The simulated paint is quick enough to need no head start.
  }

  /** The word match, a moment later: "on the device" when ready, "in the cloud" when there's none. */
  async paint(words: ApprovedWords): Promise<Painted> {
    const { state } = this.state.get();
    await pause(state === 'slow' ? 1400 : 500);
    const by = state === 'ready' || state === 'slow' ? 'device' : state === 'unavailable' ? 'cloud' : 'words';
    return { glyph: matchGlyph(words), by };
  }

  /** A model step: slower on a slow device, held while stalled, refused when there's no model. */
  private async step(ms: number): Promise<void> {
    for (;;) {
      const { state } = this.state.get();
      if (state === 'unavailable') throw new Error('no on-device model (simulated)');
      if (state === 'ready' || state === 'slow') break;
      await pause(200);
    }
    await pause(this.state.get().state === 'slow' ? ms * 3 : ms);
  }
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}
