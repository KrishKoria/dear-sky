/**
 * Where each lantern sits in the sky view. Its place comes from its id alone, so it's the same on
 * every visit and for everyone, and no position is stored anywhere (the cloud never learns which
 * lantern is yours, D32). Yours sits low in the middle with its kindred gathered above it; the
 * rest scatter across the sky and are nudged apart so none hides another.
 *
 * Coordinates are fractions of the sky field (0..1). The page places lanterns with percentages,
 * so nothing is measured and nothing moves after the first frame.
 */
import { seeded } from '../ui/random';
import type { SkyLantern } from './lantern';
import { hash, recipeOf, type Recipe } from './recipe';

export type Depth = 'far' | 'mid' | 'near';
export type Role = 'focus' | 'kindred' | 'other';

export interface Placed {
  lantern: SkyLantern;
  x: number;
  y: number;
  role: Role;
  depth: Depth;
  /** How it's drawn: its glyph, tone, shape and ribs (D13). */
  recipe: Recipe;
  /** Seconds for one slow drift, and how far into it this lantern starts (negative). */
  drift: number;
  phase: number;
  /** Seconds before it comes out on arrival, so the sky fills in scattered, not all at once. */
  delay: number;
}

/** Yours: low in the middle, where the rise left it. */
export const FOCUS = { x: 0.5, y: 0.72 } as const;
const LEFT = 0.05;
const RIGHT = 0.95;
const TOP = 0.05;
const BOTTOM = 0.93;
/** How far kindred sit from yours, in heights of the field. */
const RING = 0.27;

/** A place to keep clear, like the moon: centre in field fractions, radius in field heights. */
export interface Clearing {
  x: number;
  y: number;
  r: number;
}

/**
 * @param focus the lantern to gather the sky around (yours), if it's in the sky.
 * @param aspect the field's width / height; distances are kept even in both directions.
 * @param max at most this many: yours and your kindred first, then the rest in the given order.
 * @param clear places no lantern drifts in front of (the moon).
 */
export function layoutSky(
  lanterns: SkyLantern[],
  {
    focus,
    aspect,
    max = lanterns.length,
    clear = [],
  }: { focus?: string; aspect: number; max?: number; clear?: Clearing[] },
): Placed[] {
  const center = focus ? lanterns.find((l) => l.id === focus) : undefined;
  const kindredIds = new Set(center?.kindred ?? []);
  const kindred = lanterns.filter((l) => kindredIds.has(l.id) && l !== center);
  const rest = lanterns.filter((l) => l !== center && !kindredIds.has(l.id));
  const chosen = [...(center ? [center] : []), ...kindred, ...rest].slice(0, Math.max(0, max));

  const placed = chosen.map((lantern): Placed & { fixed: boolean } => {
    const rand = seeded(hash(lantern.id));
    const r = rand();
    const base = {
      lantern,
      depth: (r < 0.45 ? 'far' : r < 0.83 ? 'mid' : 'near') as Depth,
      recipe: recipeOf(lantern),
      drift: 18 + rand() * 12,
      phase: -rand() * 30,
      delay: 0.2 + rand() * 1.4,
    };
    // Lanterns rise, so more of them are high in the sky than low.
    const x = LEFT + rand() * (RIGHT - LEFT);
    const y = TOP + Math.pow(rand(), 1.25) * (BOTTOM - TOP);
    if (lantern === center) {
      return { ...base, ...FOCUS, role: 'focus', depth: 'near', delay: 0, fixed: true };
    }
    if (kindredIds.has(lantern.id) && center) return { ...base, x, y, role: 'kindred', depth: 'near', fixed: true };
    return { ...base, x, y, role: 'other', fixed: false };
  });

  // Kindred on an arc above yours, evenly spread, each a little off the line so it looks found.
  const ring = placed.filter((p) => p.role === 'kindred');
  ring.forEach((p, i) => {
    const rand = seeded(hash(p.lantern.id) ^ 0x9e3779b9);
    const angle = ((-160 + ((i + 0.5) * 140) / ring.length + (rand() - 0.5) * 16) * Math.PI) / 180;
    const radius = RING * (0.9 + rand() * 0.2);
    p.x = clamp(FOCUS.x + (radius * Math.cos(angle)) / aspect, LEFT, RIGHT);
    p.y = clamp(FOCUS.y + radius * Math.sin(angle), TOP, BOTTOM);
  });

  // Room around yours for its "yours" label, so no stranger's lantern sits on it.
  const room = center ? [{ x: FOCUS.x, y: FOCUS.y + 0.05, r: 0.12 }] : [];
  spread(placed, aspect, [...clear, ...room]);
  return placed.map(({ fixed: _, ...p }) => p);
}

/** Nudges lanterns apart until none sits on another. Fixed ones (yours, kindred) stay put. */
function spread(
  points: { x: number; y: number; fixed: boolean; lantern: SkyLantern }[],
  aspect: number,
  clear: Clearing[],
) {
  const n = points.length;
  if (n === 0) return;
  const area = aspect * (BOTTOM - TOP) * (RIGHT - LEFT);
  const gap = 0.85 * Math.sqrt(area / n);

  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = points[i];
        const b = points[j];
        if (a.fixed && b.fixed) continue;
        let dx = (b.x - a.x) * aspect;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= gap) continue;
        if (d < 1e-6) {
          // Exactly on top of each other: part them in a direction of their own.
          const angle = ((hash(b.lantern.id) % 360) * Math.PI) / 180;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          d = 1;
        }
        const push = (gap - Math.min(d, gap)) / d;
        const share = a.fixed || b.fixed ? 1 : 0.5;
        if (!a.fixed) {
          a.x -= (dx * push * share) / aspect;
          a.y -= dy * push * share;
        }
        if (!b.fixed) {
          b.x += (dx * push * share) / aspect;
          b.y += dy * push * share;
        }
        moved = true;
      }
    }
    for (const p of points) {
      if (p.fixed) continue;
      p.x = clamp(p.x, LEFT, RIGHT);
      p.y = clamp(p.y, TOP, BOTTOM);
      for (const c of clear) if (escape(p, c, aspect)) moved = true;
    }
    if (!moved) break;
  }
}

/**
 * Moves a lantern out of a clearing: the way it was already leaning, unless the edge of the sky
 * would push it straight back in (a moon near the top), then downward, then sideways.
 */
function escape(p: { x: number; y: number }, c: Clearing, aspect: number): boolean {
  const dx = (p.x - c.x) * aspect;
  const dy = p.y - c.y;
  const d = Math.hypot(dx, dy);
  if (d >= c.r) return false;
  const [ux, uy] = d < 1e-6 ? [0, 1] : [dx / d, dy / d];
  const ways = [[ux, uy], [ux, Math.abs(uy)], [0, 1], [Math.sign(ux) || 1, 0]];
  for (const [vx, vy] of ways) {
    const x = clamp(c.x + (vx * c.r) / aspect, LEFT, RIGHT);
    const y = clamp(c.y + vy * c.r, TOP, BOTTOM);
    if (Math.hypot((x - c.x) * aspect, y - c.y) >= c.r - 1e-9) {
      p.x = x;
      p.y = y;
      return true;
    }
  }
  return false;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
