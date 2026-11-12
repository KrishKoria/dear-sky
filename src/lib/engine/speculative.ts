/**
 * Runs one piece of work ahead of time for the newest text (PREP.md D24).
 *
 * While the writer pauses, `prime()` computes the result in the background. At most one
 * run is in flight; a newer text waits for it and then replaces it ("latest wins").
 * When the writer is done, `get()` returns the remembered result if the text is unchanged,
 * joins the run if it is still in flight, and only otherwise starts a fresh run.
 *
 * Only the newest result is kept, in memory. Nothing is persisted.
 */
export class Speculative<T> {
  private inFlight: { key: string; promise: Promise<T> } | undefined;
  private done: { key: string; value: T } | undefined;
  private next: string | undefined;

  /**
   * @param work computes the result; `urgent` is true when someone is waiting on it.
   * @param keep false for results that must not be reused (e.g. the model couldn't run).
   */
  constructor(
    private readonly work: (key: string, urgent: boolean) => Promise<T>,
    private readonly keep: (value: T) => boolean = () => true,
  ) {}

  /** Start computing `key` in the background. Never throws. */
  prime(key: string): void {
    if (this.done?.key === key || this.inFlight?.key === key) return;
    if (this.inFlight) {
      this.next = key;
      return;
    }
    this.start(key, false).catch(() => {});
  }

  /** The result for `key`: remembered, joined in flight, or computed now. */
  async get(key: string): Promise<T> {
    this.next = undefined; // the writer is done: a queued background run is stale
    if (this.done?.key === key) return this.done.value;
    if (this.inFlight?.key === key) {
      const value = await this.inFlight.promise.catch(() => undefined);
      if (value !== undefined && this.keep(value)) return value;
    }
    return this.start(key, true);
  }

  private start(key: string, urgent: boolean): Promise<T> {
    const promise = this.work(key, urgent).then((value) => {
      if (this.keep(value)) this.done = { key, value };
      return value;
    });
    if (!urgent) {
      this.inFlight = { key, promise };
      const settle = () => {
        if (this.inFlight?.promise === promise) this.inFlight = undefined;
        const next = this.next;
        this.next = undefined;
        if (next !== undefined) this.prime(next);
      };
      promise.then(settle, settle);
    }
    return promise;
  }
}
