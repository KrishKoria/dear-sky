import type { ApprovedWords } from '../privacy/release';
import type { LanternWords } from '../sky/lantern';
import type { Glyph } from '../sky/recipe';
import type { Progress, Stage } from './pipeline';
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

/** A lantern's picture, and who chose it: the device, the cloud, or the word match (D13). */
export interface Painted {
  glyph: Glyph;
  by: 'device' | 'cloud' | 'words';
}

/**
 * Everything that touches letter text on the device goes through this interface
 * (PREP.md D21). Implementations must only ever run the letter on the device:
 * no implementation may send letter text to the cloud, under any condition.
 *
 * The one call that may reach the cloud is `paint`, and it only takes `ApprovedWords`.
 */
export interface OnDeviceEngine {
  readonly readiness: Readable<Readiness>;

  /** Call from a user gesture (click or keypress). Starts the download or the cold load. */
  warmUp(): void;

  /**
   * The writer paused (call it on every pause; it is cheap when nothing changed). Works ahead
   * on this text, one background prompt at a time, newest text first: safety → reflection →
   * essence, up to `depth` (default: all). Nothing past safety for a flagged letter (D19).
   * Only on a ready or slow model (D24, D28).
   */
  preload(letter: string, depth?: Stage): void;

  /** Which steps are done or running for the newest letter, for subtle UI cues. */
  readonly progress: Readable<Progress>;

  /** Instant when `preload` already checked this exact text. */
  checkSafety(letter: string): Promise<SafetyResult>;

  /**
   * Streams the margin note. If it was written ahead of time, it replays at once (the UI
   * paces the handwriting); if it is being written, earlier words replay, then it follows live. Render by appending `delta` (Chrome's guidance: never re-set the
   * whole text per chunk). `soFar` is there for state, not for re-rendering.
   */
  reflect(letter: string, onText: (delta: string, soFar: string) => void): Promise<string>;

  /** Retries once when the leak check refuses the first essence. The caller must still run the leak check. */
  condense(letter: string): Promise<Essence>;

  /**
   * Paints the glyph ahead, on this device only, from the words on the consent tag before they're
   * approved, so `paint` is instant when they're lit as they are. Does nothing without a warm model.
   */
  sketch(words: LanternWords): void;

  /**
   * Picks the lantern's glyph from words the writer already approved to leave (D13):
   * `PREFER_ON_DEVICE`, so on this device when the model is there, in the cloud otherwise.
   * Never rejects and never waits long: without an answer in time, the word match decides.
   */
  paint(words: ApprovedWords): Promise<Painted>;

  /** The writer burned the letter: drop its text and every note or essence written from it. */
  forget(): void;
}
