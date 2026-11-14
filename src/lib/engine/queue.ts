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
 *
 * A job that runs past `timeoutMs` is given up on: its caller gets a `JobTimeoutError` and the
 * queue moves on, so one prompt that never settles can't hold every later one forever. Chrome
 * may still be running it, and whatever it produces later is dropped.
 */

/** Lower number runs first. */
export const Priority = {
  /** The writer is waiting on this (safety check, reflection). */
  user: 0,
  /** Precomputed so a later step feels instant (essence). */
  background: 1,
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

/** The longest a prompt may take unless its job says otherwise. Generous: a slow device can take a minute. */
export const DEFAULT_TIMEOUT_MS = 2 * 60_000;

export class JobTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label}: no answer after ${Math.round(ms / 1000)} s`);
    this.name = 'JobTimeoutError';
  }
}

export interface Job<T> {
  label: string;
  priority: Priority;
  stallAfterMs: number;
  timeoutMs?: number;
  run: () => Promise<T>;
}

export interface QueueHooks {
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

  enqueue<T>(job: Job<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        label: job.label,
        priority: job.priority,
        stallAfterMs: job.stallAfterMs,
        seq: this.seq++,
        start: () =>
          withTimeout(Promise.resolve().then(job.run), job.label, job.timeoutMs ?? DEFAULT_TIMEOUT_MS).then(resolve, (e) => {
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
    // A job that never stalls gets no timer: timers overflow past ~24.8 days and fire at once.
    const stallTimer = Number.isFinite(next.stallAfterMs)
      ? setTimeout(() => this.hooks.onStall?.(next.label), next.stallAfterMs)
      : undefined;
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

function withTimeout<T>(work: Promise<T>, label: string, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new JobTimeoutError(label, ms)), ms)));
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
