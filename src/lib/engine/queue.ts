/**
 * One serial queue for every on-device prompt (CLAUDE.md "Nano engine rules").
 *
 * Chrome runs prompts one at a time across the whole browser, so running ours in
 * parallel only hides the order. This queue makes the order explicit: highest
 * priority first, then first come, first served.
 *
 * A job that runs past `stallAfterMs` is reported as stalled but is NOT cancelled.
 * Firebase AI Logic does not pass an abort signal to the on-device prompt, so the
 * prompt keeps running inside Chrome either way. Its result is still delivered if it
 * arrives, and the queue waits for it before starting the next job (Chrome would
 * make the next job wait anyway).
 */

/** Lower number runs first. */
export const Priority = {
  /** The writer is waiting on this (safety check, reflection). */
  user: 0,
  /** Precomputed so a later step feels instant (essence). */
  background: 1,
  /** Warm-up and keep-alive prompts. */
  idle: 2,
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export interface Job<T> {
  label: string;
  priority: Priority;
  stallAfterMs: number;
  run: () => Promise<T>;
}

export interface QueueHooks {
  onStart?(label: string): void;
  onStall?(label: string): void;
  onSettle?(label: string, ms: number, ok: boolean): void;
}

interface Entry {
  label: string;
  priority: Priority;
  stallAfterMs: number;
  seq: number;
  start: () => Promise<void>;
}

export class SerialQueue {
  private pending: Entry[] = [];
  private running = false;
  private seq = 0;

  constructor(
    private hooks: QueueHooks = {},
    private now: () => number = () => performance.now(),
  ) {}

  get size(): number {
    return this.pending.length + (this.running ? 1 : 0);
  }

  enqueue<T>(job: Job<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        label: job.label,
        priority: job.priority,
        stallAfterMs: job.stallAfterMs,
        seq: this.seq++,
        start: () => Promise.resolve().then(job.run).then(resolve, (e) => {
          reject(e);
          throw e;
        }),
      });
      this.pending.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    const next = this.pending.shift();
    if (!next) return;
    this.running = true;

    const started = this.now();
    this.hooks.onStart?.(next.label);
    const stallTimer = setTimeout(() => this.hooks.onStall?.(next.label), next.stallAfterMs);
    let ok = true;
    try {
      await next.start();
    } catch {
      ok = false; // already delivered to the caller's promise
    } finally {
      clearTimeout(stallTimer);
      this.hooks.onSettle?.(next.label, this.now() - started, ok);
      this.running = false;
      void this.drain();
    }
  }
}
