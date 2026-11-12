import type { Feeling } from './prompts';
import type { Readiness } from './readiness';
import type { Readable } from './store';

export interface SafetyResult {
  /** Show the care card instead of the reflection, and don't offer release (PREP.md D19). */
  risk: boolean;
  /** False when the model couldn't run, so only the code check decided. */
  modelChecked: boolean;
}

export interface Essence {
  feeling: Feeling;
  essence: string;
  motif: string;
}

/**
 * Everything that touches letter text on the device goes through this interface
 * (PREP.md D21). Implementations must only ever run the letter on the device:
 * no implementation may send letter text to the cloud, under any condition.
 */
export interface OnDeviceEngine {
  readonly readiness: Readable<Readiness>;

  /** Call from a user gesture (click or keypress). Starts the download or the cold load. */
  warmUp(): void;

  /** The writer paused. Session-based engines can pre-load the letter here; others ignore it. */
  preload(letter: string): void;

  checkSafety(letter: string): Promise<SafetyResult>;

  /**
   * Streams the margin note. Render by appending `delta` (Chrome's guidance: never re-set the
   * whole text per chunk). `soFar` is there for state, not for re-rendering.
   */
  reflect(letter: string, onText: (delta: string, soFar: string) => void): Promise<string>;

  condense(letter: string): Promise<Essence>;
}
