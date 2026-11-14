/**
 * Where each lantern sits in the wide sky (D42 step 2, D44). The sky is a row of chunks, each one
 * screen wide: chunk 0 is in the middle, with yours low in it and its kindred gathered above; the
 * newest others fill chunks outward (1, -1, 2, -2…), and older ones extend the row as you explore.
 *
 * Depth is three layers that move at different speeds as the sky is dragged (`Plan.speed`). A
 * slow layer shows more of itself at once, so each chunk holds fewer far lanterns than near ones,
 * and on screen every depth looks evenly filled.
 *
 * Places come from each lantern's id, so a sky with the same lanterns is the same on every visit,
 * and no position is stored anywhere (the cloud never learns which lantern is yours, D32).
 *
 * `x` is in pixels along its depth's layer; at rest (the sky not yet moved) a layer's pixels are
 * the field's pixels. `y` is a fraction of the field's height, so it survives small resizes.
 */
import { seeded } from '../ui/random';
import type { SkyLantern } from './lantern';
import { hash, recipeOf, type Recipe } from './recipe';

export type Depth = 'far' | 'mid' | 'near';
export type Role = 'focus' | 'kindred' | 'other';

export const DEPTHS: readonly Depth[] = ['far', 'mid', 'near'];

export interface Plan {
  /** The field's size: one chunk is one field wide. */
  width: number;
  height: number;
  /** How far each layer moves for every pixel the sky is dragged. */
  speed: Record<Depth, number>;
  /** Lanterns per chunk at each depth. */
  quota: Record<Depth, number>;
}

export interface Chunk {
  k: number;
  lanterns: SkyLantern[];
}

export interface Placed {
  lantern: SkyLantern;
  role: Role;
  depth: Depth;
  /** Pixels along its layer. */
  x: number;
  /** Fraction of the field's height. */
  y: number;
  /** How it's drawn: its glyph, tone, shape and ribs (D13). */
  recipe: Recipe;
  /** Seconds for one slow wander: a sideways sway with two bobs in it. */
  sway: number;
  /** How far into its wander it starts (negative seconds). */
  phase: number;
  /** Seconds before it comes out, so the sky fills in scattered, not all at once. */
  delay: number;
}

/** A place to keep clear at rest, like the moon: centre in field fractions, radius in field heights. */
export interface Clearing {
  x: number;
  y: number;
  r: number;
}

/** Yours: low in the middle of chunk 0, where the rise left it. */
export const FOCUS = { x: 0.5, y: 0.72 } as const;
export const SPEED: Record<Depth, number> = { far: 0.42, mid: 0.68, near: 1 };
/** Of the lanterns on screen at once, how many are far, mid and near. Most are far: it reads as deep. */
const SHARE: Record<Depth, number> = { far: 0.45, mid: 0.33, near: 0.22 };
const LEFT = 0.05;
const RIGHT = 0.95;
const TOP = 0.05;
const BOTTOM = 0.93;
/** How far kindred sit from yours, in heights of the field. */
const RING = 0.27;

/**
 * How the sky is laid out for a field this size. A phone shows about 9 lanterns at once, a wide
 * desktop about 24. `calm` (reduced motion): no parallax, every layer moves with the finger.
 */
export function planSky(width: number, height: number, calm = false): Plan {
  const speed = calm ? { far: 1, mid: 1, near: 1 } : SPEED;
  const onScreen = clamp(Math.round((width * height) / 30_000), 9, 24);
  const quota = { far: 0, mid: 0, near: 0 };
  for (const d of DEPTHS) quota[d] = Math.max(1, Math.round(onScreen * SHARE[d] * speed[d]));
  return { width, height, speed, quota };
}

export function perChunk(plan: Plan): number {
  return plan.quota.far + plan.quota.mid + plan.quota.near;
}

/**
 * Deals the first lanterns into chunks: yours and all your kindred into chunk 0, then the rest
 * in the order given, a chunk at a time, outward from the middle (1, -1, 2, -2…).
 */
export function fillChunks(lanterns: SkyLantern[], plan: Plan, focus?: string): Chunk[] {
  const center = focus ? lanterns.find((l) => l.id === focus) : undefined;
  const kin = new Set(center?.kindred ?? []);
  const first = [...(center ? [center] : []), ...lanterns.filter((l) => kin.has(l.id) && l !== center)];
  const rest = lanterns.filter((l) => l !== center && !kin.has(l.id));
  const per = perChunk(plan);
  const chunks: Chunk[] = [{ k: 0, lanterns: [...first, ...rest.splice(0, Math.max(0, per - first.length))] }];
  for (let i = 1; rest.length > 0; i++) {
    chunks.push({ k: i % 2 ? (i + 1) / 2 : -i / 2, lanterns: rest.splice(0, per) });
  }
  return chunks;
}

/** Older lanterns, found while exploring: new chunks past the edge on that side. */
export function extendChunks(chunks: Chunk[], lanterns: SkyLantern[], side: 1 | -1, plan: Plan): Chunk[] {
  const per = perChunk(plan);
  const ks = chunks.map((c) => c.k);
  let edge = ks.length === 0 ? -side : side > 0 ? Math.max(...ks) : Math.min(...ks);
  const out: Chunk[] = [];
  for (let i = 0; i < lanterns.length; i += per) {
    edge += side;
    out.push({ k: edge, lanterns: lanterns.slice(i, i + per) });
  }
  return out;
}

/** How far the sky can be dragged: from centring the first chunk to centring the last. */
export function boundsOf(chunks: Chunk[], plan: Plan): { min: number; max: number } {
  if (chunks.length === 0) return { min: 0, max: 0 };
  const ks = chunks.map((c) => c.k);
  return { min: Math.min(...ks) * plan.width, max: Math.max(...ks) * plan.width };
}

type Point = Placed & { fixed: boolean; fx: number };

/**
 * Places one chunk's lanterns.
 * @param focus the lantern to gather the sky around (yours), if it's in this chunk.
 * @param clear places kept clear in the sky at rest (the moon), in field fractions.
 */
export function layoutChunk(
  chunk: Chunk,
  plan: Plan,
  { focus, clear = [] }: { focus?: string; clear?: Clearing[] } = {},
): Placed[] {
  const { width, height } = plan;
  const center = focus ? chunk.lanterns.find((l) => l.id === focus) : undefined;
  const kin = new Set(center?.kindred ?? []);
  const depthOf = deal(chunk.lanterns, plan, center, kin);

  const points: Point[] = chunk.lanterns.map((lantern) => {
    const rand = seeded(hash(lantern.id));
    const depth = depthOf.get(lantern.id)!;
    const base = {
      lantern,
      depth,
      recipe: recipeOf(lantern),
      sway: 14 + rand() * 10,
      phase: -rand() * 24,
      delay: 0.2 + rand() * 1.4,
      x: 0,
    };
    // Lanterns rise, so more of them are high in the sky than low.
    const fx = LEFT + rand() * (RIGHT - LEFT);
    const y = TOP + Math.pow(rand(), 1.25) * (BOTTOM - TOP);
    if (lantern === center) return { ...base, fx: FOCUS.x, y: FOCUS.y, role: 'focus', depth: 'near', delay: 0, fixed: true };
    if (kin.has(lantern.id) && center) return { ...base, fx, y, role: 'kindred', depth: 'near', fixed: true };
    return { ...base, fx, y, role: 'other', fixed: false };
  });

  // Kindred on an arc above yours, evenly spread, each a little off the line so it looks found.
  const ring = points.filter((p) => p.role === 'kindred');
  const aspect = width / height;
  ring.forEach((p, i) => {
    const rand = seeded(hash(p.lantern.id) ^ 0x9e3779b9);
    const angle = ((-160 + ((i + 0.5) * 140) / ring.length + (rand() - 0.5) * 16) * Math.PI) / 180;
    const radius = RING * (0.9 + rand() * 0.2);
    p.fx = clamp(FOCUS.x + (radius * Math.cos(angle)) / aspect, LEFT, RIGHT);
    p.y = clamp(FOCUS.y + radius * Math.sin(angle), TOP, BOTTOM);
  });

  // Where yours and its kindred are, so no stranger at any depth sits on them or the "yours" label.
  const left = (d: Depth) => width / 2 + chunk.k * width * plan.speed[d] - (width * plan.speed[d]) / 2;
  const kept: Clearing[] = [...clear];
  for (const p of points) {
    if (p.role === 'focus') kept.push({ x: (left('near') + p.fx * width) / width, y: p.y + 0.05, r: 0.12 });
    if (p.role === 'kindred') kept.push({ x: (left('near') + p.fx * width) / width, y: p.y, r: 0.06 });
  }

  for (const d of DEPTHS) {
    const group = points.filter((p) => p.depth === d);
    if (group.length === 0) continue;
    const w = width * plan.speed[d];
    const x0 = left(d);
    // The clearings, in this layer's own fractions.
    const local = kept.map((c) => ({ x: (c.x * width - x0) / w, y: c.y, r: c.r }));
    spread(group, w / height, local);
    for (const p of group) p.x = x0 + p.fx * w;
  }
  return points.map(({ fixed: _f, fx: _x, ...p }) => p);
}

/**
 * Which depth each lantern takes: yours and your kindred are near; the others, in an order made
 * from their ids, go wherever their chunk is furthest below its share of the plan.
 */
function deal(lanterns: SkyLantern[], plan: Plan, center: SkyLantern | undefined, kin: Set<string>): Map<string, Depth> {
  const out = new Map<string, Depth>();
  const count = { far: 0, mid: 0, near: 0 };
  const total = perChunk(plan);
  for (const l of lanterns) {
    if (l === center || (center && kin.has(l.id))) {
      out.set(l.id, 'near');
      count.near++;
    }
  }
  const others = lanterns.filter((l) => !out.has(l.id)).sort((a, b) => hash(a.id) - hash(b.id) || (a.id < b.id ? -1 : 1));
  for (const l of others) {
    const n = count.far + count.mid + count.near + 1;
    let best: Depth = 'far';
    let most = -Infinity;
    for (const d of DEPTHS) {
      const want = (plan.quota[d] / total) * n - count[d];
      if (want > most + 1e-9) {
        most = want;
        best = d;
      }
    }
    out.set(l.id, best);
    count[best]++;
  }
  return out;
}

/** Nudges lanterns apart until none sits on another. Fixed ones (yours, kindred) stay put. */
function spread(points: { fx: number; y: number; fixed: boolean; lantern: SkyLantern }[], aspect: number, clear: Clearing[]) {
  const n = points.length;
  const area = aspect * (BOTTOM - TOP) * (RIGHT - LEFT);
  const gap = Math.min(0.32, 0.7 * Math.sqrt(area / n));

  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = points[i];
        const b = points[j];
        if (a.fixed && b.fixed) continue;
        let dx = (b.fx - a.fx) * aspect;
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
          a.fx -= (dx * push * share) / aspect;
          a.y -= dy * push * share;
        }
        if (!b.fixed) {
          b.fx += (dx * push * share) / aspect;
          b.y += dy * push * share;
        }
        moved = true;
      }
    }
    for (const p of points) {
      if (p.fixed) continue;
      p.fx = clamp(p.fx, LEFT, RIGHT);
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
function escape(p: { fx: number; y: number }, c: Clearing, aspect: number): boolean {
  const dx = (p.fx - c.x) * aspect;
  const dy = p.y - c.y;
  const d = Math.hypot(dx, dy);
  if (d >= c.r) return false;
  const [ux, uy] = d < 1e-6 ? [0, 1] : [dx / d, dy / d];
  const ways = [
    [ux, uy],
    [ux, Math.abs(uy)],
    [0, 1],
    [Math.sign(ux) || 1, 0],
    [-(Math.sign(ux) || 1), 0],
  ];
  for (const [vx, vy] of ways) {
    const x = clamp(c.x + (vx * c.r) / aspect, LEFT, RIGHT);
    const y = clamp(c.y + vy * c.r, TOP, BOTTOM);
    if (Math.hypot((x - c.x) * aspect, y - c.y) >= c.r - 1e-9) {
      p.fx = x;
      p.y = y;
      return true;
    }
  }
  return false;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
