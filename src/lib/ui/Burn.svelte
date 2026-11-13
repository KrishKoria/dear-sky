<!--
  The burn (DESIGN.md §4.4): sad but soft, never violent. Laid over the sheet while it burns.

  The paper warms at the candle's corner, then a glowing edge climbs the page from the bottom
  right, leaving soft char behind it, and embers lift off where it passes. The sheet itself
  curls and fades (WritingScreen); this layer only draws on top of it.

  Only transform and opacity move (DESIGN.md §3): the char is one tall picture that slides up,
  and every ember is a dot that drifts and fades. Reduced motion: the char simply fades in.
-->
<script module lang="ts">
  /** When the sheet is gone and a fresh one may come. Inside the 2–6 s of a ritual (§3). */
  export const BURN_MS = 5500;
  export const CALM_BURN_MS = 1900;
</script>

<script lang="ts">
  let { calm = false }: { calm?: boolean } = $props();

  /**
   * The burning edge: small uneven scallops, as paper really burns (viewBox units, 0–100 wide;
   * one unit tall is about 1% of the sheet). Smooth curves through the points, never corners.
   */
  const phase = Math.random() * 6;
  const wave = Array.from({ length: 41 }, (_, i) => {
    const y = 100 + Math.sin(i * 0.55 + phase) * 0.8 + Math.sin(i * 1.9) * 0.9 + (Math.random() - 0.5) * 1.6;
    return [i * 2.5, y] as const;
  });
  /** Catmull-Rom through the points, as cubic Béziers. `dy` lifts the whole line. */
  function curve(points: readonly (readonly [number, number])[], dy = 0, move = true): string {
    const p = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
    let d = `${move ? 'M' : 'L'}${p(0)[0]},${(p(0)[1] + dy).toFixed(2)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const [a, b, c, e] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
      const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6 + dy];
      const c2 = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6 + dy];
      d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${c[0]},${(c[1] + dy).toFixed(2)}`;
    }
    return d;
  }
  const line = curve(wave);
  const below = `${line} L100,300 L0,300 Z`;
  // The scorch runs ahead of the edge: the same line a little higher, then back along the edge.
  const scorch = `${curve(wave, -12)} ${curve([...wave].reverse(), 0, false)} Z`;

  /**
   * Embers lift off where the edge passes: from the bottom right first, the top left last.
   * The edge's timing below follows the sweep's keyframes closely enough for the eye.
   */
  const SWEEP_START = 0.3;
  const SWEEP_S = 3.6;
  // A burn is drawn once, as it begins.
  // svelte-ignore state_referenced_locally
  const embers = calm
    ? []
    : Array.from({ length: 52 }, () => {
        const x = 0.04 + Math.random() * 0.92;
        const y = 0.06 + Math.random() * 0.9;
        const reached = (1 - y + 0.14 * (1 - x)) / 1.14;
        const ash = Math.random() < 0.18;
        const dx = (Math.random() - 0.5) * 48;
        return {
          ash,
          x: x * 100,
          y: y * 100,
          delay: SWEEP_START + reached * (SWEEP_S - 0.6) + Math.random() * 0.2,
          duration: (ash ? 1.5 : 1.25) + Math.random() * 0.45,
          size: ash ? 4 + Math.random() * 3 : 3.2 + Math.random() * 3.2,
          dx,
          mx: dx * 0.35 + (Math.random() - 0.5) * 18,
          dy: -(ash ? 40 + Math.random() * 60 : 80 + Math.random() * 150),
          spin: (Math.random() - 0.5) * 220,
        };
      });
</script>

<div class="burn" class:calm aria-hidden="true">
  <span class="warmth"></span>
  <svg class="char" viewBox="0 0 100 300" preserveAspectRatio="none">
    <defs>
      <!-- Behind the edge: a thin warm band, then char, then almost the night itself. -->
      <linearGradient id="burn-char" gradientUnits="userSpaceOnUse" x1="0" y1="98" x2="0" y2="150">
        <stop offset="0" style="stop-color: var(--burn-glow)" />
        <stop offset="0.07" style="stop-color: var(--char-warm)" />
        <stop offset="0.24" style="stop-color: var(--char)" />
        <stop offset="0.75" style="stop-color: var(--char-night)" />
      </linearGradient>
      <linearGradient id="burn-scorch" gradientUnits="userSpaceOnUse" x1="0" y1="86" x2="0" y2="101">
        <stop offset="0" style="stop-color: var(--scorch); stop-opacity: 0" />
        <stop offset="1" style="stop-color: var(--scorch)" />
      </linearGradient>
    </defs>
    <path d={scorch} fill="url(#burn-scorch)" />
    <path d={below} fill="url(#burn-char)" />
    <path class="glow" d={line} />
    <path class="edge" d={line} />
  </svg>
</div>

{#if embers.length}
  <div class="embers" aria-hidden="true">
    {#each embers as e, i (i)}
      <span
        class:ash={e.ash}
        style:left="{e.x}%"
        style:top="{e.y}%"
        style:--s="{e.size}px"
        style:--d="{e.delay}s"
        style:--t="{e.duration}s"
        style:--dx="{e.dx}px"
        style:--mx="{e.mx}px"
        style:--dy="{e.dy}px"
        style:--spin="{e.spin}deg"
      ></span>
    {/each}
  </div>
{/if}

<style>
  /* Shaped like the paper: the same rounded corners, the same folded corner cut away. */
  .burn {
    --ear: 38px;
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: 20px;
    rotate: -0.4deg;
    clip-path: polygon(0 0, calc(100% - var(--ear)) 0, 100% var(--ear), 100% 100%, 0 100%);
    pointer-events: none;
  }

  /* The candle's corner warms first. */
  .warmth {
    position: absolute;
    inset: 0;
    background: radial-gradient(70% 55% at 92% 100%, var(--burn-glow), transparent 70%);
    opacity: 0;
    animation: warm 1.6s var(--ease-out) forwards;
  }

  @keyframes warm {
    to {
      opacity: 0.55;
    }
  }

  /*
    Three sheets tall: the scorch and the edge sit one sheet down, the char fills the rest.
    Tilted so the burn climbs from the candle's corner. Slides up past the top of the page.
  */
  .char {
    position: absolute;
    top: 0;
    left: -18%;
    width: 136%;
    height: 300%;
    transform: translateY(4%) rotate(-7deg);
    animation: sweep 3.6s cubic-bezier(0.3, 0.12, 0.7, 0.9) 0.3s forwards;
    will-change: transform;
  }

  @keyframes sweep {
    to {
      transform: translateY(-42%) rotate(-7deg);
    }
  }

  .edge,
  .glow {
    fill: none;
    vector-effect: non-scaling-stroke;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .edge {
    stroke: var(--burn-edge);
    stroke-width: 2px;
  }

  .glow {
    stroke: var(--burn-glow);
    stroke-width: 14px;
    filter: blur(6px);
  }

  .embers {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .embers span {
    position: absolute;
    width: var(--s);
    height: var(--s);
    margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2);
    border-radius: 50%;
    background: radial-gradient(circle, var(--ember-core) 0 28%, var(--ember) 58%, transparent 72%);
    box-shadow: 0 0 9px 2px var(--burn-glow);
    opacity: 0;
    animation: drift var(--t) var(--ease-out) var(--d) both;
  }

  .embers span.ash {
    border-radius: 35% 60% 45% 55%;
    background: var(--ash);
    box-shadow: none;
  }

  @keyframes drift {
    0% {
      opacity: 0;
      transform: translate(0, 0) rotate(0) scale(1);
    }
    14% {
      opacity: 1;
    }
    55% {
      transform: translate(var(--mx), calc(var(--dy) * 0.55)) rotate(calc(var(--spin) * 0.5)) scale(0.85);
    }
    100% {
      opacity: 0;
      transform: translate(var(--dx), var(--dy)) rotate(var(--spin)) scale(0.35);
    }
  }

  /* Reduced motion: no climbing edge, no drifting embers. The page darkens softly in place. */
  .burn.calm .char {
    transform: translateY(-42%) rotate(-7deg);
    opacity: 0;
    animation: char-in 0.9s var(--ease-out) forwards;
  }

  @keyframes char-in {
    to {
      opacity: 1;
    }
  }

  @media (max-width: 760px) {
    .burn {
      --ear: 28px;
    }
  }
</style>
