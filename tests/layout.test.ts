import { expect, test } from 'bun:test';
import { FOCUS, layoutSky } from '../src/lib/sky/layout';
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

test('the same sky on every visit', () => {
  expect(layoutSky(withMine, { focus: 'mine', aspect: 1.6 })).toEqual(layoutSky(withMine, { focus: 'mine', aspect: 1.6 }));
});

test('yours sits low in the middle, its kindred gathered above it', () => {
  const placed = layoutSky(withMine, { focus: 'mine', aspect: 1.6 });
  const focus = placed.find((p) => p.role === 'focus')!;
  expect(focus.lantern.id).toBe('mine');
  expect([focus.x, focus.y]).toEqual([FOCUS.x, FOCUS.y]);

  const kindred = placed.filter((p) => p.role === 'kindred');
  expect(kindred.map((p) => p.lantern.id).sort()).toEqual(['l17', 'l3', 'l42']);
  for (const k of kindred) {
    expect(k.y).toBeLessThan(focus.y);
    const d = Math.hypot((k.x - focus.x) * 1.6, k.y - focus.y);
    expect(d).toBeGreaterThan(0.2);
    expect(d).toBeLessThan(0.34);
  }
});

test('every lantern stays in the field, and none sits on another', () => {
  for (const aspect of [0.6, 1, 1.8]) {
    const placed = layoutSky(withMine, { focus: 'mine', aspect });
    expect(placed).toHaveLength(61);
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
    let closest = Infinity;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        closest = Math.min(closest, Math.hypot((a.x - b.x) * aspect, a.y - b.y));
      }
    }
    expect(closest).toBeGreaterThan(0.045);
  }
});

test('a cap keeps yours and your kindred first', () => {
  const placed = layoutSky([...sky, mine], { focus: 'mine', aspect: 0.6, max: 10 });
  expect(placed).toHaveLength(10);
  expect(placed.map((p) => p.lantern.id).slice(0, 4).sort()).toEqual(['l17', 'l3', 'l42', 'mine']);
});

test('with no lantern of yours, the sky is simply scattered', () => {
  const placed = layoutSky(sky, { aspect: 1.6 });
  expect(placed.every((p) => p.role === 'other')).toBe(true);
  expect(layoutSky(sky, { focus: 'gone', aspect: 1.6 }).every((p) => p.role === 'other')).toBe(true);
});

test('no lantern drifts in front of the moon', () => {
  const moon = { x: 0.15, y: 0.15, r: 0.12 };
  const placed = layoutSky(withMine, { focus: 'mine', aspect: 1.8, clear: [moon] });
  for (const p of placed) {
    expect(Math.hypot((p.x - moon.x) * 1.8, p.y - moon.y)).toBeGreaterThanOrEqual(moon.r - 1e-9);
  }
});
