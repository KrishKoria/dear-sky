/**
 * The echo's stream (D50): what a stranger's lantern shares with the writer's letter, written on
 * this device. The model answers "nothing" when the two share nothing real, and that word must
 * never be handwritten on the tag, so the first few characters are held back until it's clear.
 */
import { NO_ECHO } from './prompts';

/** Enough to tell "nothing" from the start of a real line ("You both", "Like you,"). */
const HOLD = NO_ECHO.length + 2;

export const isNoEcho = (text: string) => {
  const t = text.trim();
  return t.length <= NO_ECHO.length + 3 && /^\W*nothing\b/i.test(t);
};

export function echoStream(onText: (delta: string) => void) {
  let held = '';
  let open = false;
  const release = () => {
    open = true;
    const start = held.trimStart();
    if (start) onText(start);
  };
  return {
    push(delta: string): void {
      if (open) return onText(delta);
      held += delta;
      if (held.trimStart().length >= HOLD && !isNoEcho(held)) release();
    },
    /** The whole reply, once it has ended: `NO_ECHO`, or the line (anything still held is let out). */
    end(full: string): string {
      if (isNoEcho(full)) return NO_ECHO;
      if (!open) release();
      return full.trim();
    },
  };
}
