/**
 * The lantern glyphs (PREP.md D13), drawn on a 12 × 12 grid. Each is a soft silhouette (`fill`),
 * a line drawing (`line`), or both, like a paper cut-out shadow on the lantern's inside.
 * Simple enough to read at a few pixels, and every corner is rounded by the renderer.
 */
import type { Glyph } from '../sky/recipe';

export interface GlyphArt {
  fill?: string;
  line?: string;
}

/** A circle as a path, so a glyph stays one or two elements. */
const dot = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

export const GLYPH_ART: Record<Glyph, GlyphArt> = {
  heart: {
    fill: 'M6 10.6C2.6 8.2 1.2 6.2 1.2 4.4c0-1.7 1.2-2.9 2.6-2.9 1 0 1.8.6 2.2 1.4.4-.8 1.2-1.4 2.2-1.4 1.4 0 2.6 1.2 2.6 2.9 0 1.8-1.4 3.8-4.8 6.2z',
  },
  star: {
    fill: 'M6 1.4l1.3 3.1 3.4.3-2.6 2.2.8 3.3L6 8.5l-2.9 1.8.8-3.3-2.6-2.2 3.4-.3z',
  },
  moon: {
    fill: 'M7.6 1.5a4.8 4.8 0 1 0 3.2 7.7A4 4 0 0 1 7.6 1.5z',
  },
  bird: {
    line: 'M1.4 6.2c1.6-1.9 3.3-1.9 4.6.4 1.3-2.3 3-2.3 4.6-.4',
  },
  leaf: {
    fill: 'M2 10.2C1.6 5.4 4.6 2 10.4 1.6c.4 5.8-3 8.8-8.4 8.6z',
    line: 'M2.2 10L6.8 5.4',
  },
  flower: {
    fill: [dot(6, 3.4, 2), dot(8.5, 5.2, 2), dot(7.5, 8.2, 2), dot(4.5, 8.2, 2), dot(3.5, 5.2, 2)].join(''),
  },
  key: {
    line: `${dot(3.6, 6, 2.1)}M5.7 6h5M9 6v2M10.6 6v1.5`,
  },
  house: {
    fill: 'M1.8 6.4L6 2.3l4.2 4.1v3.9c0 .3-.2.5-.5.5H2.3c-.3 0-.5-.2-.5-.5z',
  },
  cup: {
    fill: 'M1.8 4.6h7.4v2.6c0 1.9-1.6 3.3-3.7 3.3S1.8 9.1 1.8 7.2z',
    line: 'M9.1 5.5c1.6-.2 1.9 2.3.1 2.5M4.4 1.4c-.5.6.5 1.2 0 1.8M6.6 1.4c-.5.6.5 1.2 0 1.8',
  },
  letter: {
    line: 'M2 3.2h8a.5.5 0 0 1 .5.5v5.4a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V3.7a.5.5 0 0 1 .5-.5zM1.8 3.6L6 6.9l4.2-3.3',
  },
  boat: {
    fill: 'M1.2 6.8h9.6L9 9.8H3zM6 1.6l2.8 4.6H3.2z',
  },
  wave: {
    line: 'M1.2 4.8c1.4-1.4 2.8-1.4 4.2 0s2.8 1.4 4.2 0M2.4 8.4c1.4-1.4 2.8-1.4 4.2 0s2.8 1.4 4.2 0',
  },
  note: {
    fill: dot(4.2, 9, 1.8),
    line: 'M5.9 9V1.8c1.4.6 3.2 1.4 3.4 3.4',
  },
  umbrella: {
    fill: 'M1.2 6.6C1.2 3.6 3.4 1.6 6 1.6s4.8 2 4.8 5c-.7-.6-1.7-.6-2.4 0-.7-.6-1.7-.6-2.4 0-.7-.6-1.7-.6-2.4 0-.7-.6-1.7-.6-2.4 0z',
    line: 'M6 6.6v3c0 1.1-1.5 1.1-1.5 0',
  },
  flame: {
    fill: 'M6 1.2c1.8 2.3 3.6 3.9 3.6 6.3 0 2-1.6 3.4-3.6 3.4S2.4 9.5 2.4 7.5c0-1.5.9-2.6 1.8-3.4.2 1.3.8 1.9 1.4 2.1-.4-1.8-.2-3.4.4-5z',
  },
  paw: {
    fill: `M3.4 9c0-1.5 1.2-2.6 2.6-2.6S8.6 7.5 8.6 9c0 1.2-1.1 1.7-2.6 1.4C4.5 10.7 3.4 10.2 3.4 9z${dot(2.6, 5.4, 1.05)}${dot(4.6, 3.4, 1.15)}${dot(7.4, 3.4, 1.15)}${dot(9.4, 5.4, 1.05)}`,
  },
};
