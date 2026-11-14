<!--
  The night behind everything: a soft moon with a pale wisp,
  sparse twinkling stars, a few far lanterns and the rooftop town. Fixed, behind the page.

  Stars double as real download progress (DESIGN.md §4b): `lit` (0..1) is how many have come
  out. They appear one by one, and once out a star never goes back in.

  When the shared sky is dragged (D44) the stars turn with it, slowest of all; the moon and the
  town stay where they are. The star field is drawn twice side by side, so it wraps without a seam.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Horizon from './Horizon.svelte';
  import Lantern from './Lantern.svelte';
  import { onPan } from './pan';
  import { seeded } from './random';

  /** `quiet`: the shared sky has real lanterns, so the painted far ones step aside. */
  let { lit = 1, quiet = false }: { lit?: number; quiet?: boolean } = $props();

  interface Star {
    x: number;
    y: number;
    size: number;
    bright: boolean;
    twinkle: number;
    delay: number;
  }

  const COUNT = 72;
  /** Always out, so the sky is never blank, even before a download begins. */
  const BASELINE = 9;

  const rand = seeded(2026);
  // Generated in lighting order: progress brings them out scattered, not row by row.
  const stars: Star[] = Array.from({ length: COUNT }, () => {
    const bright = rand() < 0.16;
    return {
      x: rand() * 100,
      y: Math.pow(rand(), 1.35) * 82,
      size: bright ? 2 + rand() * 0.8 : 1 + rand() * 0.9,
      bright,
      twinkle: rand() < 0.3 ? 0 : 5 + rand() * 9,
      delay: -rand() * 12,
    };
  });

  let shown = $state(0);
  const target = $derived(Math.max(BASELINE, Math.round(Math.min(1, Math.max(0, lit)) * COUNT)));

  $effect(() => {
    if (shown >= target) return;
    // One star at a time: quick on arrival, unhurried after that.
    const id = setTimeout(() => shown++, shown < BASELINE ? 90 : 160);
    return () => clearTimeout(id);
  });

  /** How far the stars move for each pixel the sky is dragged: far slower than any lantern. */
  const STAR_SPEED = 0.08;
  let starField = $state<HTMLElement>();
  let track = $state<HTMLElement>();

  onMount(() => {
    let width = starField?.clientWidth ?? 0;
    let pan = 0;
    const place = () => {
      if (!track || width === 0) return;
      const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const shift = calm ? 0 : (((pan * STAR_SPEED) % width) + width) % width;
      track.style.transform = `translate3d(${-shift.toFixed(2)}px, 0, 0)`;
    };
    const resize = new ResizeObserver(() => {
      width = starField?.clientWidth ?? 0;
      place();
    });
    if (starField) resize.observe(starField);
    const stop = onPan((x) => {
      pan = x;
      place();
    });
    return () => {
      stop();
      resize.disconnect();
    };
  });
</script>

<div class="sky" aria-hidden="true">
  <div class="stars" class:lifted={quiet} bind:this={starField}>
    <div class="track" bind:this={track}>
      {#each [0, 1] as tile (tile)}
        <div class="tile" style:left="{tile * 100}%">
          {#each stars as star, i (i)}
            <span
              class="star"
              class:out={i < shown}
              class:bright={star.bright}
              style:left="{star.x}%"
              style:top="{star.y}%"
              style:--size="{star.size}px"
            >
              <span
                class="glint"
                class:steady={star.twinkle === 0}
                style:animation-duration="{star.twinkle}s"
                style:animation-delay="{star.delay}s"
              ></span>
            </span>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <div class="moon">
    <div class="moon-face"></div>
    <svg class="wisp" viewBox="0 0 220 40">
      <filter id="wisp-soft" x="-10%" y="-40%" width="120%" height="180%">
        <feGaussianBlur stdDeviation="1.8" />
      </filter>
      <path
        filter="url(#wisp-soft)"
        d="M14 30c-8 0-10-8-2-10 4-9 18-11 26-5 7-8 24-9 32-1 9-5 24-3 28 5 12-3 30-1 34 6 10 0 14 5 4 6-26 2-96 1-122-1z"
        fill="var(--wisp)"
      />
    </svg>
  </div>

  <div class="far-lanterns" class:quiet>
    <div class="far l1"><span class="halo"></span><Lantern tone="honey" size={30} /></div>
    <div class="far l2"><span class="halo"></span><Lantern tone="apricot" size={19} /></div>
    <div class="far l3"><span class="halo"></span><Lantern tone="rose" size={24} /></div>
  </div>

  <Horizon />
</div>

<style>
  .sky {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    background:
      radial-gradient(90% 26% at 50% 100%, var(--sky-ember) 0%, transparent 100%),
      radial-gradient(120% 60% at 50% 105%, var(--sky-low) 0%, transparent 70%),
      linear-gradient(to bottom, var(--sky-top) 0%, var(--sky-mid) 55%, var(--sky-low) 100%);
  }

  .stars {
    position: absolute;
    inset: 0 0 var(--horizon-h) 0;
    transition: translate 1.4s var(--ease-out);
  }

  /* Going to the shared sky everything flows up (D45): the stars, being furthest, only a little. */
  .stars.lifted {
    translate: 0 -8px;
  }

  .track,
  .tile {
    position: absolute;
    inset: 0;
  }

  .track {
    will-change: transform;
  }

  .tile {
    width: 100%;
  }

  .star {
    position: absolute;
    width: var(--size);
    height: var(--size);
    opacity: 0;
    transform: scale(0.3);
    transition:
      opacity 1.6s var(--ease-out),
      transform 1.6s var(--ease-out);
  }

  .star.out {
    opacity: 0.78;
    transform: none;
  }

  .star.bright.out {
    opacity: 1;
  }

  .glint {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--star);
    animation: twinkle 8s ease-in-out infinite;
  }

  .bright .glint {
    box-shadow: 0 0 6px 1px var(--star-glow);
  }

  .glint.steady {
    animation: none;
  }

  @keyframes twinkle {
    0%,
    100% {
      opacity: 1;
    }
    42% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
    58% {
      opacity: 0.95;
    }
  }

  /* The moon sits in the gutter beside the sheet on wide screens, and tucks into the header
     corner on narrow ones so it never crowds the wordmark or the page. */
  .moon {
    position: absolute;
    top: 20px;
    right: 22px;
    width: 46px;
    height: 46px;
  }

  .moon-face {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    /* Soft, uneven maria rather than crisp craters: two round spots side by side read as eyes. */
    background:
      radial-gradient(ellipse 30% 22% at 66% 64%, var(--moon-mare) 0%, transparent 100%),
      radial-gradient(ellipse 18% 14% at 44% 76%, var(--moon-mare) 0%, transparent 100%),
      radial-gradient(ellipse 14% 18% at 70% 30%, var(--moon-mare) 0%, transparent 100%),
      radial-gradient(circle at 36% 32%, var(--moon-light) 0%, var(--moon) 58%, var(--moon-shade) 100%);
    box-shadow:
      0 0 40px 8px var(--moon-halo),
      0 0 120px 40px var(--moon-halo);
  }

  /* A pale wisp drifting across the moon's lower half, in front of it. */
  .wisp {
    position: absolute;
    left: -16%;
    bottom: 14%;
    width: 112%;
    overflow: visible;
    animation: drift 46s ease-in-out infinite alternate;
  }

  @keyframes drift {
    from {
      transform: translateX(-6%);
    }
    to {
      transform: translateX(10%);
    }
  }

  @media (min-width: 1180px) {
    .moon {
      top: 132px;
      right: auto;
      left: max(28px, calc((100vw - var(--sheet-w)) / 2 - 168px));
      width: 108px;
      height: 108px;
    }
  }

  /* The same box as the sky: while it drifts (a `translate`), it becomes the far lanterns' frame
     of reference, and an empty box there made them jump across the sky (D45). */
  .far-lanterns {
    position: absolute;
    inset: 0;
    transition:
      opacity 0.9s var(--ease-out),
      translate 1.2s var(--ease-out);
  }

  /* They drift up and away as the real lanterns rise in, and settle back down on return. */
  .far-lanterns.quiet {
    opacity: 0;
    translate: 0 -36px;
  }

  .far {
    position: absolute;
    animation: float 22s ease-in-out infinite;
  }

  .halo {
    position: absolute;
    inset: -70% -95%;
    border-radius: 50%;
    background: radial-gradient(closest-side, var(--lantern-glow), transparent 85%);
    animation: glow 6s ease-in-out infinite;
  }

  .far :global(.lantern) {
    position: relative;
  }

  .l1 {
    top: 14px;
    left: 58%;
    scale: 0.6;
  }

  .l2,
  .l3 {
    display: none;
  }

  @media (min-width: 1180px) {
    .l1 {
      top: 18%;
      left: auto;
      scale: 1;
      right: max(40px, calc((100vw - var(--sheet-w)) / 2 - 120px));
    }
    .l2 {
      display: block;
      top: 41%;
      right: max(110px, calc((100vw - var(--sheet-w)) / 2 - 64px));
      animation-duration: 28s;
      animation-delay: -9s;
    }
    .l3 {
      display: block;
      top: 58%;
      left: max(60px, calc((100vw - var(--sheet-w)) / 2 - 110px));
      animation-duration: 25s;
      animation-delay: -15s;
    }
  }

  @keyframes glow {
    50% {
      opacity: 0.7;
    }
  }

  @keyframes float {
    0%,
    100% {
      transform: translate(0, 0) rotate(-2deg);
    }
    50% {
      transform: translate(5px, -16px) rotate(2deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stars.lifted,
    .far-lanterns.quiet {
      translate: none;
    }

    .glint,
    .wisp,
    .halo,
    .far {
      animation: none;
    }
  }
</style>
