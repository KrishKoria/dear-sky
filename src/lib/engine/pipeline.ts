/**
 * The per-letter background pipeline (PREP.md D24, D28).
 *
 * While the writer pauses, the engine works ahead on the newest text, one prompt at a time:
 * safety → reflection → essence. When they press "done", whatever is ready is used at once,
 * whatever is running is joined, and only the rest runs, at user priority.
 *
 * - **Latest wins.** At most one background prompt is in flight. After each step the pump
 *   looks at the newest text again, so a letter that changed mid-way never gets the rest of
 *   its old pipeline, and intermediate versions of the text are skipped entirely.
 * - **Safety first (D19).** Neither the reflection nor the essence is ever started in the
 *   background for a letter the safety check flagged.
 * - **Only good results are kept.** A safety check the model couldn't run, or a failed step,
 *   is forgotten, so the next caller runs it again.
 *
 * Pure logic: the model calls are injected, so this is testable without Chrome.
 * Results live in memory only, for the newest letter.
 */
import { writable, type Readable } from './store';
import type { Essence, SafetyResult } from './types';

export type Stage = 'safety' | 'reflection' | 'essence';
export const STAGES: readonly Stage[] = ['safety', 'reflection', 'essence'];
export type StageStatus = 'idle' | 'running' | 'done';
export type Progress = Record<Stage, StageStatus>;

export interface Steps {
  safety(letter: string, urgent: boolean): Promise<SafetyResult>;
  /** Streams deltas through `onDelta`; resolves with the full text. */
  reflection(letter: string, urgent: boolean, onDelta: (delta: string) => void): Promise<string>;
  essence(letter: string, urgent: boolean): Promise<Essence>;
}

const IDLE: Progress = { safety: 'idle', reflection: 'idle', essence: 'idle' };

/** A text stream that late subscribers can join: they get what was already written, then the rest. */
export class Replay {
  private readonly chunks: string[] = [];
  private readonly listeners = new Set<(delta: string) => void>();
  readonly done: Promise<string>;
  private settle!: { resolve: (text: string) => void; reject: (e: unknown) => void };

  constructor() {
    this.done = new Promise((resolve, reject) => (this.settle = { resolve, reject }));
    this.done.catch(() => {}); // a failure is handled by whoever subscribes
  }

  push(delta: string): void {
    this.chunks.push(delta);
    for (const l of this.listeners) l(delta);
  }

  end(text: string): void {
    this.listeners.clear();
    this.settle.resolve(text);
  }

  fail(e: unknown): void {
    this.listeners.clear();
    this.settle.reject(e);
  }

  /** Replays what exists so far, then follows live. Resolves with the full text. */
  subscribe(onDelta: (delta: string) => void): Promise<string> {
    for (const c of this.chunks) onDelta(c);
    this.listeners.add(onDelta);
    return this.done.finally(() => this.listeners.delete(onDelta));
  }
}

class LetterJob {
  safety?: Promise<SafetyResult>;
  /** Set once a kept safety result is in. */
  safetyResult?: SafetyResult;
  reflection?: Replay;
  essence?: Promise<Essence>;
  readonly status: Progress = { ...IDLE };
  constructor(
    readonly letter: string,
    public depth: Stage,
  ) {}
}

export class LetterPipeline {
  private job: LetterJob | undefined;
  private pumping = false;
  private readonly state = writable<Progress>({ ...IDLE });
  /** Step status for the newest letter, for subtle UI cues (nothing about the text itself). */
  readonly progress: Readable<Progress> = { subscribe: this.state.subscribe };

  constructor(
    private readonly steps: Steps,
    private readonly keepSafety: (r: SafetyResult) => boolean = (r) => r.modelChecked,
  ) {}

  /** The writer paused: work ahead on this text, up to and including `depth`. Never throws. */
  prepare(letter: string, depth: Stage = 'essence'): void {
    const job = this.jobFor(letter);
    if (STAGES.indexOf(depth) > STAGES.indexOf(job.depth)) job.depth = depth;
    void this.pump();
  }

  async checkSafety(letter: string): Promise<SafetyResult> {
    const job = this.jobFor(letter);
    const joined = job.safety !== undefined;
    const result = await this.startSafety(job, true).catch((e) => {
      if (!joined) throw e;
      return undefined;
    });
    if (result && (this.keepSafety(result) || !joined)) return result;
    // A background check failed or couldn't use the model, and someone is waiting: once more, now.
    return this.startSafety(this.jobFor(letter), true);
  }

  /** Replays a reflection written ahead of time, joins one being written, or writes it now. */
  reflect(letter: string, onDelta: (delta: string) => void): Promise<string> {
    return this.startReflection(this.jobFor(letter), true).subscribe(onDelta);
  }

  async condense(letter: string): Promise<Essence> {
    const job = this.jobFor(letter);
    const joined = job.essence !== undefined;
    try {
      return await this.startEssence(job, true);
    } catch (e) {
      if (!joined) throw e;
      return this.startEssence(this.jobFor(letter), true); // the background run failed: once more, now
    }
  }

  /**
   * The letter was burned: let go of its text and everything written from it. A prompt already
   * in Chrome still finishes (AI Logic can't cancel), but into a job nothing holds any more.
   */
  clear(): void {
    this.job = undefined;
    this.publish();
  }

  /** The newest letter's job; a different text replaces it (its in-flight prompt still finishes). */
  private jobFor(letter: string): LetterJob {
    if (this.job?.letter !== letter) {
      this.job = new LetterJob(letter, 'safety');
      this.publish();
    }
    return this.job;
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      for (;;) {
        const job = this.job;
        if (!job) return;
        const next = this.nextStage(job);
        if (!next) return;
        if (next === 'safety') await this.startSafety(job, false).catch(() => {});
        if (next === 'reflection') await this.startReflection(job, false).done.catch(() => {});
        if (next === 'essence') await this.startEssence(job, false).catch(() => {});
        if (job.status[next] !== 'done') return; // it failed: don't loop on it; the next pause retries
      }
    } finally {
      this.pumping = false;
    }
  }

  /** The first stage this job still needs, within its depth; undefined when there's nothing to do. */
  private nextStage(job: LetterJob): Stage | undefined {
    const limit = STAGES.indexOf(job.depth);
    if (job.status.safety !== 'done') return 'safety';
    if (!job.safetyResult || job.safetyResult.risk) return undefined; // D19: nothing more is generated for this letter
    if (limit >= 1 && job.status.reflection === 'idle') return 'reflection';
    if (limit >= 2 && job.status.essence === 'idle') return 'essence';
    return undefined;
  }

  private startSafety(job: LetterJob, urgent: boolean): Promise<SafetyResult> {
    if (!job.safety) {
      this.mark(job, 'safety', 'running');
      job.safety = this.steps.safety(job.letter, urgent).then(
        (result) => {
          if (this.keepSafety(result)) {
            job.safetyResult = result;
            this.mark(job, 'safety', 'done');
          }
          else this.forget(job, 'safety');
          return result;
        },
        (e) => {
          this.forget(job, 'safety');
          throw e;
        },
      );
    }
    return job.safety;
  }

  private startReflection(job: LetterJob, urgent: boolean): Replay {
    if (!job.reflection) {
      const replay = new Replay();
      job.reflection = replay;
      this.mark(job, 'reflection', 'running');
      this.steps.reflection(job.letter, urgent, (d) => replay.push(d)).then(
        (text) => {
          replay.end(text);
          this.mark(job, 'reflection', 'done');
        },
        (e) => {
          replay.fail(e);
          this.forget(job, 'reflection');
        },
      );
    }
    return job.reflection;
  }

  private startEssence(job: LetterJob, urgent: boolean): Promise<Essence> {
    if (!job.essence) {
      this.mark(job, 'essence', 'running');
      job.essence = this.steps.essence(job.letter, urgent).then(
        (essence) => {
          this.mark(job, 'essence', 'done');
          return essence;
        },
        (e) => {
          this.forget(job, 'essence');
          throw e;
        },
      );
    }
    return job.essence;
  }

  private forget(job: LetterJob, stage: Stage): void {
    job[stage] = undefined;
    this.mark(job, stage, 'idle');
  }

  private mark(job: LetterJob, stage: Stage, status: StageStatus): void {
    job.status[stage] = status;
    if (job === this.job) this.publish();
  }

  private publish(): void {
    this.state.set({ ...(this.job?.status ?? IDLE) });
  }
}
