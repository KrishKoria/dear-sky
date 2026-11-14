<!--
  A paper lantern, drawn from its recipe (PREP.md D13): a bell,
  round or tall body with 3–5 ribs, a dark cap and base, an inner glow, one warm tone, and one
  tiny glyph showing through the paper like a cut-out shadow. Without a recipe it's the plain
  honey bell (the wordmark, the far lanterns of the painted sky).
-->
<script lang="ts">
  import type { Glyph, Ribs, Shape, Tone } from '../sky/recipe';
  import { GLYPH_ART } from './glyphs';

  let {
    tone = 'honey',
    size = 18,
    shape = 'bell',
    ribs = 3,
    glyph,
  }: { tone?: Tone; size?: number; shape?: Shape; ribs?: Ribs; glyph?: Glyph } = $props();
  const id = $props.id();

  /** Each body hangs from the same neck (y 9.5) and rests on the same base (y 48). */
  const BODY: Record<Shape, { d: string; belly: number; foot: number }> = {
    bell: { d: 'M14.5 9.5C6 14.5 4.5 30 8 40c2.2 5.6 6.4 8 12 8s9.8-2.4 12-8c3.5-10 2-25.5-6.5-30.5z', belly: 13.7, foot: 7 },
    round: { d: 'M14.5 9.5C4.5 12.5 3 23 3.6 30.5 4.4 40.5 11 48 20 48s15.6-7.5 16.4-17.5C37 23 35.5 12.5 25.5 9.5z', belly: 16, foot: 8 },
    tall: { d: 'M15.2 9.5C9.6 14.5 8.2 27 9.8 37.5 11 44.5 15 48 20 48s9-3.5 10.2-10.5C31.8 27 30.4 14.5 24.8 9.5z', belly: 10.6, foot: 6.4 },
  };

  /** Ribs curve out with the body, evenly spaced across it. */
  function ribPaths(shape: Shape, count: number): string {
    const { belly, foot } = BODY[shape];
    const r = (n: number) => Math.round(n * 100) / 100;
    return Array.from({ length: count }, (_, i) => {
      const u = (2 * (i + 1)) / (count + 1) - 1;
      const top = r(20 + u * 5);
      const out = r(20 + u * belly);
      return `M${top} 10C${out} 20 ${out} 36 ${r(20 + u * foot)} 47.5`;
    }).join('');
  }

  const body = $derived(BODY[shape]);
  const ribLines = $derived(ribPaths(shape, ribs));
  // Below ~15px a glyph is only a smudge: the far lanterns go without.
  const art = $derived(glyph && size >= 15 ? GLYPH_ART[glyph] : undefined);
</script>

<svg
  class="lantern"
  width={size}
  height={size * 1.4}
  viewBox="0 0 40 56"
  aria-hidden="true"
  style:--tone="var(--lantern-{tone})"
>
  <defs>
    <radialGradient id="{id}-glow" cx="50%" cy="58%" r="55%">
      <stop offset="0" stop-color="var(--flame-core)" stop-opacity="0.95" />
      <stop offset="0.55" stop-color="var(--tone)" stop-opacity="0.2" />
      <stop offset="1" stop-color="var(--tone)" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect x="14" y="4" width="12" height="5.5" rx="2.2" fill="var(--lantern-cap)" />
  <path d={body.d} fill="var(--tone)" />
  <path d={body.d} fill="url(#{id}-glow)" />
  <path d={ribLines} fill="none" stroke="var(--lantern-cap)" stroke-opacity="0.22" stroke-width="1.1" stroke-linecap="round" />
  {#if art}
    <!-- One group opacity, so where the outline meets the fill it isn't darker. -->
    <g
      opacity="0.4"
      transform="translate(14.3 24.6) scale(0.95)"
      fill="var(--lantern-cap)"
      stroke="var(--lantern-cap)"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {#if art.fill}<path d={art.fill} stroke-width="0.7" />{/if}
      {#if art.line}<path d={art.line} fill="none" stroke-width="1.2" />{/if}
    </g>
  {/if}
  <rect x="15" y="47" width="10" height="4.5" rx="1.8" fill="var(--lantern-cap)" />
</svg>

<style>
  .lantern {
    display: block;
    overflow: visible;
  }
</style>
