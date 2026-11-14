/**
 * The sky's camera (D44): where it looks along the row of chunks (`x`, in pixels of the near
 * layer) and how it moves. A drag follows the finger, stretching softly past the edges; a flick
 * coasts and slows; past an edge it settles back. Wheel, keys and focus ease to a target.
 *
 * Pure (no DOM, no clock): SkyView calls `step(dt)` once a frame, so it can be tested in Bun.
 */

/** How quickly a coast slows: velocity falls by e every this many ms (iOS feels like ~325). */
const FRICTION_MS = 325;
/** How quickly an overscroll settles back to the edge. */
const SPRING_MS = 120;
/** How hard a coast is braked once it runs past an edge. */
const BRAKE_MS = 45;
const MAX_V = 3; // px per ms
const REST_V = 0.015;

type Mode = 'rest' | 'drag' | 'coast' | 'ease';

export class Camera {
  x = 0;
  private v = 0;
  private min = 0;
  private max = 0;
  private mode: Mode = 'rest';
  /** Where a drag would be with no edges: the stretch is worked out from it. */
  private raw = 0;
  private target = 0;
  private tau = 200;

  /** @param give how far past an edge the sky can ever be stretched, in px. */
  constructor(private give = 240) {}

  get moving(): boolean {
    return this.mode !== 'rest';
  }

  get bounds(): { min: number; max: number } {
    return { min: this.min, max: this.max };
  }

  setBounds(min: number, max: number, give = this.give) {
    this.min = min;
    this.max = Math.max(min, max);
    this.give = give;
    if (this.mode === 'ease') this.target = this.clamp(this.target);
    if (this.mode === 'rest' && this.outside()) this.mode = 'coast';
  }

  /** A finger or button comes down: the sky stops where it is. True if it caught a real glide. */
  grab(): boolean {
    const caught = (this.mode === 'coast' && Math.abs(this.v) > 0.2) || (this.mode === 'ease' && Math.abs(this.target - this.x) > 24);
    this.v = 0;
    this.mode = 'drag';
    this.raw = this.unstretch(this.x);
    return caught;
  }

  /** The finger moved `dx` px (right is positive): the sky follows it. */
  drag(dx: number) {
    if (this.mode !== 'drag') return;
    this.raw -= dx;
    this.x = this.stretch(this.raw);
  }

  /** The finger lifts, moving at `v` px/ms (right is positive): the sky coasts on. */
  release(v = 0) {
    if (this.mode !== 'drag') return;
    this.v = Math.max(-MAX_V, Math.min(MAX_V, -v));
    this.mode = 'coast';
  }

  /** Eases `dx` further along (wheel, keys); repeated pushes add up. */
  push(dx: number, tau = 200) {
    const from = this.mode === 'ease' ? this.target : this.x;
    this.easeTo(from + dx, tau);
  }

  easeTo(x: number, tau = 220) {
    if (this.mode === 'drag') return;
    this.v = 0;
    this.target = this.clamp(x);
    this.tau = tau;
    this.mode = 'ease';
  }

  /** Stops where it is, settling back inside the edges if it's past one. */
  stop() {
    this.v = 0;
    this.mode = this.outside() ? 'coast' : 'rest';
  }

  /** The wind's slow drift: only while nothing else is moving the sky, and never past an edge. */
  nudge(dx: number) {
    if (this.mode !== 'rest') return;
    this.x = this.clamp(this.x + dx);
  }

  /** Moves on by `dt` ms. Returns whether it's still moving. */
  step(dt: number): boolean {
    if (this.mode === 'ease') {
      this.x += (this.target - this.x) * (1 - Math.exp(-dt / this.tau));
      if (Math.abs(this.target - this.x) < 0.25) {
        this.x = this.target;
        this.mode = 'rest';
      }
    } else if (this.mode === 'coast') {
      const edge = this.x < this.min ? this.min : this.x > this.max ? this.max : undefined;
      if (edge === undefined) {
        this.x += this.v * dt;
        this.v *= Math.exp(-dt / FRICTION_MS);
        if (Math.abs(this.v) < REST_V && !this.outside()) {
          this.v = 0;
          this.mode = 'rest';
        }
      } else {
        // Past an edge: brake hard, and let the edge pull it back.
        this.x += this.v * dt;
        this.v *= Math.exp(-dt / BRAKE_MS);
        this.x += (edge - this.x) * (1 - Math.exp(-dt / SPRING_MS));
        if (Math.abs(this.v) < REST_V && Math.abs(edge - this.x) < 0.25) {
          this.x = edge;
          this.v = 0;
          this.mode = 'rest';
        }
      }
    }
    return this.mode !== 'rest';
  }

  private outside(): boolean {
    return this.x < this.min || this.x > this.max;
  }

  private clamp(x: number): number {
    return Math.min(this.max, Math.max(this.min, x));
  }

  /** Past an edge, the sky moves less and less for the same pull, never more than `give`. */
  private stretch(raw: number): number {
    if (raw > this.max) return this.max + rubber(raw - this.max, this.give);
    if (raw < this.min) return this.min - rubber(this.min - raw, this.give);
    return raw;
  }

  private unstretch(x: number): number {
    if (x > this.max) return this.max + unrubber(x - this.max, this.give);
    if (x < this.min) return this.min - unrubber(this.min - x, this.give);
    return x;
  }
}

const RUBBER = 0.55;

function rubber(d: number, give: number): number {
  return give * (1 - 1 / ((d * RUBBER) / give + 1));
}

function unrubber(r: number, give: number): number {
  const s = Math.min(r, give * 0.999) / give;
  return (give / RUBBER) * (1 / (1 - s) - 1);
}
