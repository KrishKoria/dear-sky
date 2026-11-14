import { expect, test } from 'bun:test';
import {
  boundsOf,
  DEPTHS,
  extendChunks,
  fillChunks,
  FOCUS,
  layoutChunk,
  perChunk,
  planSky,
  type Placed,
} from '../src/lib/sky/layout';
import type { SkyLantern } from '../src/lib/sky/lantern';

const lantern = (id: string, kindred: string[] = []): SkyLantern => ({
  id,
  feeling: 'longing',
  essence: `words for ${id}`,
  motif: 'a shawl',
  kindred,
  seed: false,
});

const sky = Array.from({ length: 60 }, (_, i) => lantern(`l${i}`));
const mine = lantern('mine', ['l3', 'l17', 'l42']);
const withMine = [mine, ...sky];

const desktop = planSky(1400, 700);
const phone = planSky(360, 620);

const layout = (lanterns: SkyLantern[], plan = desktop, focus?: string, clear = []) =>
  fillChunks(lanterns, plan, focus).flatMap((c) => layoutChunk(c, plan, { focus, clear }));

test('the same sky on every visit', () => {
  expect(layout(withMine, desktop, 'mine')).toEqual(layout(withMine, desktop, 'mine'));
});

test('a phone holds fewer lanterns per screen than a desktop, and slow layers fewer per chunk', () => {
  expect(perChunk(phone)).toBeLessThan(perChunk(desktop));
  // A far layer shows ~2.4 chunks at once, so it gets fewer per chunk than its on-screen share.
  expect(desktop.quota.far / desktop.speed.far).toBeGreaterThan(desktop.quota.near / desktop.speed.near);
  expect(planSky(1400, 700, true).speed).toEqual({ far: 1, mid: 1, near: 1 });
});

test('yours and all your kindred are dealt into chunk 0; the rest fan out 1, -1, 2, -2', () => {
  const chunks = fillChunks(withMine, desktop, 'mine');
  expect(chunks[0].k).toBe(0);
  expect(chunks[0].lanterns.slice(0, 4).map((l) => l.id)).toEqual(['mine', 'l3', 'l17', 'l42']);
  expect(chunks.map((c) => c.k).slice(0, 5)).toEqual([0, 1, -1, 2, -2]);
  expect(chunks.flatMap((c) => c.lanterns)).toHaveLength(61);
  for (const c of chunks.slice(0, -1)) expect(c.lanterns).toHaveLength(perChunk(desktop));
});

test('lanterns found while exploring extend the sky on that side', () => {
  const chunks = fillChunks(sky.slice(0, 20), desktop);
  const right = extendChunks(chunks, sky.slice(20, 50), 1, desktop);
  const max = Math.max(...chunks.map((c) => c.k));
  expect(right.map((c) => c.k)).toEqual(right.map((_, i) => max + 1 + i));
  const left = extendChunks([...chunks, ...right], sky.slice(50), -1, desktop);
  expect(left[0].k).toBe(Math.min(...chunks.map((c) => c.k)) - 1);
  expect(boundsOf([...chunks, ...right], desktop).max).toBe(right.at(-1)!.k * desktop.width);
});

test('yours sits low in the middle, its kindred gathered above it, all near', () => {
  const placed = layout(withMine, desktop, 'mine');
  const aspect = desktop.width / desktop.height;
  const focus = placed.find((p) => p.role === 'focus')!;
  expect(focus.lantern.id).toBe('mine');
  expect(focus.depth).toBe('near');
  expect([focus.x / desktop.width, focus.y]).toEqual([FOCUS.x, FOCUS.y]);

  const kindred = placed.filter((p) => p.role === 'kindred');
  expect(kindred.map((p) => p.lantern.id).sort()).toEqual(['l17', 'l3', 'l42']);
  for (const k of kindred) {
    expect(k.depth).toBe('near');
    expect(k.y).toBeLessThan(focus.y);
    const d = Math.hypot(((k.x - focus.x) / desktop.width) * aspect, k.y - focus.y);
    expect(d).toBeGreaterThan(0.2);
    expect(d).toBeLessThan(0.34);
  }
});

test('every depth is used, mostly far', () => {
  const placed = layout(sky);
  const count = (d: string) => placed.filter((p) => p.depth === d).length;
  for (const d of DEPTHS) expect(count(d)).toBeGreaterThan(0);
  // On screen, far ones outnumber near ones once their slower speed is counted.
  expect(count('far') / desktop.speed.far).toBeGreaterThan(count('near'));
});

/** Where a lantern is on screen with the sky at rest, as field fractions. */
const atRest = (p: Placed, plan = desktop) => ({ x: p.x / plan.width, y: p.y });

test('each lantern stays in its own chunk of its layer, and none sits on another', () => {
  for (const plan of [desktop, phone]) {
    const chunks = fillChunks(withMine, plan, 'mine');
    for (const chunk of chunks) {
      const placed = layoutChunk(chunk, plan, { focus: 'mine' });
      for (const p of placed) {
        const w = plan.width * plan.speed[p.depth];
        const left = plan.width / 2 + chunk.k * w - w / 2;
        expect(p.x).toBeGreaterThanOrEqual(left);
        expect(p.x).toBeLessThanOrEqual(left + w);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
      for (const d of DEPTHS) {
        const same = placed.filter((p) => p.depth === d);
        for (let i = 0; i < same.length; i++) {
          for (let j = i + 1; j < same.length; j++) {
            const gap = Math.hypot((same[i].x - same[j].x) / plan.height, same[i].y - same[j].y);
            expect(gap).toBeGreaterThan(0.06);
          }
        }
      }
    }
  }
});

test('with no lantern of yours, the sky is simply scattered', () => {
  expect(layout(sky).every((p) => p.role === 'other')).toBe(true);
  expect(layout(sky, desktop, 'gone').every((p) => p.role === 'other')).toBe(true);
});

test('at rest, no lantern at any depth drifts in front of the moon or onto yours', () => {
  const moon = { x: 0.12, y: 0.15, r: 0.12 };
  const placed = fillChunks(withMine, desktop, 'mine').flatMap((c) =>
    layoutChunk(c, desktop, { focus: 'mine', clear: [moon] }),
  );
  const aspect = desktop.width / desktop.height;
  const focus = placed.find((p) => p.role === 'focus')!;
  for (const p of placed) {
    const at = atRest(p);
    expect(Math.hypot((at.x - moon.x) * aspect, at.y - moon.y)).toBeGreaterThanOrEqual(moon.r - 1e-9);
    if (p.role === 'other') {
      const f = atRest(focus);
      expect(Math.hypot((at.x - f.x) * aspect, at.y - (f.y + 0.05))).toBeGreaterThanOrEqual(0.12 - 1e-9);
    }
  }
});
