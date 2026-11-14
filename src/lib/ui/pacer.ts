/**
 * Paces the margin handwriting (DESIGN.md §4.2). The engine may hand over a whole reflection at
 * once (written ahead, D28) or a few characters at a time (live). Either way the margin should
 * read like someone writing beside you, a word at a time, with a pause after each sentence.
 *
 * Words are only released once they're complete (followed by whitespace), unless the stream has
 * ended, so a half-streamed word never flashes and then changes.
 */

export interface PacerOptions {
  /** Milliseconds per word; read on every word so a "slow" device can change it mid-note. */
  msPerWord: () => number;
  onWord: (word: string) => void;
  onDone?: () => void;
  /** Injected for tests. */
  schedule?: (fn: () => void, ms: number) => unknown;
  cancelSchedule?: (handle: unknown) => void;
}

/** Splits text into words that keep their trailing whitespace: "a b  c" → ["a ", "b  ", "c"]. */
export function splitWords(text: string): string[] {
  return text.match(/\s*\S+\s*/g) ?? [];
}

/** Extra pause after a word, longer at sentence ends. */
export function pauseAfter(word: string): number {
  const end = word.trimEnd();
  if (/[.!?…]["'”’)]?$/.test(end)) return 2.6;
  if (/[,;:]["'”’)]?$/.test(end)) return 1.4;
  return 1;
}

export class Pacer {
  private buffer = '';
  private ended = false;
  private timer: unknown;
  private busy = false;
  private stopped = false;
  private readonly schedule: (fn: () => void, ms: number) => unknown;
  private readonly cancelSchedule: (handle: unknown) => void;

  constructor(private readonly options: PacerOptions) {
    this.schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.cancelSchedule = options.cancelSchedule ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  push(delta: string): void {
    if (this.stopped) return;
    this.buffer += delta;
    this.pump();
  }

  /** The stream is complete: release the last word too. */
  end(): void {
    if (this.stopped) return;
    this.ended = true;
    this.pump();
  }

  stop(): void {
    this.stopped = true;
    this.cancelSchedule(this.timer);
  }

  private nextWord(): string | undefined {
    const match = /^\s*\S+\s+/.exec(this.buffer);
    if (match) return match[0];
    if (this.ended && this.buffer.trim()) return this.buffer;
    return undefined;
  }

  private pump(): void {
    if (this.busy || this.stopped) return;
    const word = this.nextWord();
    if (word === undefined) {
      if (this.ended) {
        this.stopped = true;
        this.options.onDone?.();
      }
      return;
    }
    this.buffer = this.buffer.slice(word.length);
    this.options.onWord(word);
    this.busy = true;
    this.timer = this.schedule(() => {
      this.busy = false;
      this.pump();
    }, this.options.msPerWord() * pauseAfter(word));
  }
}
