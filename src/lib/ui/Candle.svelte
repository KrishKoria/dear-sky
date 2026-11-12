<!--
  The page-corner candle: the on-device model's readiness, told without words (DESIGN.md §4b,
  design/directions.md §4 rule 2). Words appear only on hover, focus or tap, in the slot beside
  it, which otherwise holds the "stays on this device" moon badge.

    downloading → unlit, a curl of smoke      warming → a small flame, catching
    ready       → a steady flame, warm glow   slow / stalled → a low, drowsy flame
    unavailable → no candle, just the moon badge

  `lean`: the flame leans toward the letter while the helper reads it in the background.
-->
<script lang="ts">
  import type { Readiness } from '../engine/readiness';

  let { readiness, lean = false }: { readiness: Readiness; lean?: boolean } = $props();

  const modelState = $derived(readiness.state);

  function journey(progress: number): string {
    if (progress < 0.15) return 'just setting out';
    if (progress < 0.4) return 'a little way along';
    if (progress < 0.65) return 'about halfway';
    if (progress < 0.9) return 'most of the way';
    return 'nearly here';
  }

  const line = $derived.by(() => {
    switch (readiness.state) {
      case 'downloading':
        return `your private helper is on its way, ${journey(readiness.progress)}`;
      case 'warming':
        return 'your private helper is waking up';
      case 'ready':
        return 'your private helper is awake';
      case 'slow':
        return 'your private helper is awake, and taking its time';
      case 'stalled':
        return 'your helper is taking its time tonight';
      case 'unavailable':
        return '';
    }
  });

  let explaining = $state(false);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  function show(autoHide = false) {
    explaining = true;
    clearTimeout(hideTimer);
    if (autoHide) hideTimer = setTimeout(() => (explaining = false), 5000);
  }

  function hide() {
    clearTimeout(hideTimer);
    explaining = false;
  }

  $effect(() => () => clearTimeout(hideTimer));
</script>

<div class="corner" data-state={modelState}>
  <!-- Both lines are always laid out; only their opacity changes, so nothing ever shifts. -->
  <p class="slot">
    <span class="badge" class:hidden={explaining && modelState !== 'unavailable'}>
      <svg class="moon-glyph" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10.6 1.8a6.4 6.4 0 1 0 3.6 10.9A5.6 5.6 0 0 1 10.6 1.8z" fill="currentColor" />
      </svg>
      Stays on this device
    </span>
    {#if modelState !== 'unavailable'}
      <span class="why" class:hidden={!explaining} aria-hidden={!explaining}>
        {line}
        <span class="privacy">It reads only on this device.</span>
      </span>
    {/if}
  </p>

  <button
    class="candle"
    class:gone={modelState === 'unavailable'}
    class:lean
    type="button"
    tabindex={modelState === 'unavailable' ? -1 : 0}
    aria-hidden={modelState === 'unavailable'}
    aria-label="{line}. It reads only on this device."
    onpointerenter={(e) => e.pointerType === 'mouse' && show()}
    onpointerleave={(e) => e.pointerType === 'mouse' && hide()}
    onfocus={() => show()}
    onblur={hide}
    onclick={() => (explaining ? hide() : show(true))}
  >
    <span class="glow"></span>
    <svg viewBox="0 0 40 64" width="44" height="70" aria-hidden="true">
      <defs>
        <linearGradient id="wax" x1="0" x2="1">
          <stop offset="0" stop-color="var(--wax)" />
          <stop offset="0.7" stop-color="var(--wax)" />
          <stop offset="1" stop-color="var(--wax-shade)" />
        </linearGradient>
        <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--flame)" />
          <stop offset="1" stop-color="var(--flame-edge)" />
        </linearGradient>
      </defs>

      <!-- saucer -->
      <ellipse cx="20" cy="58.5" rx="16" ry="3.6" fill="var(--brass-shade)" />
      <ellipse cx="20" cy="57.2" rx="15" ry="3" fill="var(--brass)" />
      <!-- wax, with a drip and a little melt pool -->
      <rect x="11" y="30" width="18" height="27" rx="4.5" fill="url(#wax)" />
      <path d="M13.2 31.5c0 5 .4 8.2 1.7 9.4 1.3 1.2 2.3.2 2.3-1.6v-7.6z" fill="var(--wax-shade)" opacity="0.55" />
      <ellipse cx="20" cy="31" rx="8.6" ry="2.1" fill="var(--wax-shade)" opacity="0.7" />
      <!-- wick -->
      <path d="M20 31c.5-1.8.1-3.4-.5-4.6" stroke="var(--wick)" stroke-width="1.5" stroke-linecap="round" fill="none" />

      <!-- smoke curl while unlit -->
      <g class="smoke" fill="none" stroke="var(--ink-faded)" stroke-width="1.2" stroke-linecap="round">
        <path class="curl" d="M19.6 24c-3-3 3-5 0-8.5s2.5-5 .5-8" />
      </g>

      <!-- flame: lean (toward the letter) → size (per state) → flicker -->
      <g class="lean-g">
        <g class="size-g">
          <g class="flicker-g">
            <path d="M20 5.5c3.9 6.8 7 11.4 7 16.1 0 4.2-3.1 6.9-7 6.9s-7-2.7-7-6.9c0-4.7 3.1-9.3 7-16.1z" fill="url(#flame)" />
            <path class="core" d="M20 14.5c2 3.6 3.5 6 3.5 8.4 0 2.1-1.6 3.5-3.5 3.5s-3.5-1.4-3.5-3.5c0-2.4 1.5-4.8 3.5-8.4z" fill="var(--flame-core)" />
          </g>
        </g>
      </g>
    </svg>
  </button>
</div>

<style>
  .corner {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }

  .slot {
    position: relative;
    margin: 0;
    width: min(230px, 52vw);
    min-height: 2.8em;
    font-family: var(--font-ui);
    font-size: 0.8125rem;
    line-height: 1.4;
    text-align: right;
  }

  .badge,
  .why {
    position: absolute;
    right: 0;
    bottom: 4px;
    transition: opacity var(--t-panel) var(--ease-out);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--moon-ink);
    white-space: nowrap;
  }

  .moon-glyph {
    width: 13px;
    height: 13px;
  }

  .why {
    left: 0;
    color: var(--ink-faded);
    text-wrap: balance;
  }

  .privacy {
    display: block;
    color: var(--moon-ink);
  }

  .hidden {
    opacity: 0;
  }

  .candle {
    position: relative;
    display: grid;
    place-items: center;
    width: 56px;
    height: 76px;
    padding: 0;
    border: 0;
    background: none;
    cursor: help;
    border-radius: 14px;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 700ms var(--ease-out);
  }

  .candle:active svg {
    transform: scale(0.95);
  }

  .candle svg {
    position: relative;
    overflow: visible;
    transition: transform var(--t-press) var(--ease-out);
  }

  .candle.gone {
    opacity: 0;
    pointer-events: none;
  }

  .glow {
    position: absolute;
    left: 50%;
    top: 22%;
    width: 200px;
    height: 200px;
    margin: -100px 0 0 -100px;
    border-radius: 50%;
    background: radial-gradient(closest-side, var(--candle-glow), transparent);
    opacity: 0;
    transition: opacity 1.4s var(--ease-out);
  }

  [data-state='warming'] .glow {
    opacity: 0.35;
  }
  [data-state='ready'] .glow {
    opacity: 1;
    animation: breathe 5s ease-in-out infinite;
  }
  [data-state='slow'] .glow {
    opacity: 0.65;
  }
  [data-state='stalled'] .glow {
    opacity: 0.45;
  }

  @keyframes breathe {
    50% {
      opacity: 0.8;
    }
  }

  /* Flame transforms happen in the SVG's own units, around the wick. */
  .lean-g,
  .size-g,
  .flicker-g {
    transform-box: view-box;
    transform-origin: 20px 28px;
  }

  .lean-g {
    transition: transform 1.1s var(--ease-out);
  }

  .candle.lean .lean-g {
    transform: rotate(-12deg);
  }

  .size-g {
    transform: scale(0);
    opacity: 0;
    transition:
      transform 1.2s var(--ease-out),
      opacity 0.8s var(--ease-out);
  }

  [data-state='warming'] .size-g {
    opacity: 1;
    animation: catching 3.2s ease-in-out infinite;
  }
  [data-state='ready'] .size-g {
    opacity: 1;
    transform: scale(1);
  }
  [data-state='slow'] .size-g {
    opacity: 1;
    transform: scale(0.78);
  }
  [data-state='stalled'] .size-g {
    opacity: 0.85;
    transform: scale(0.6);
  }

  @keyframes catching {
    0%,
    100% {
      transform: scale(0.3);
    }
    50% {
      transform: scale(0.52);
    }
  }

  .flicker-g {
    animation: flicker 3.1s ease-in-out infinite;
  }

  [data-state='slow'] .flicker-g,
  [data-state='stalled'] .flicker-g {
    animation-duration: 5.4s;
  }

  @keyframes flicker {
    0%,
    100% {
      transform: none;
    }
    22% {
      transform: scale(0.96, 1.05) skewX(1.5deg);
    }
    41% {
      transform: scale(1.03, 0.97) skewX(-1deg);
    }
    63% {
      transform: scale(0.98, 1.03) skewX(-2deg);
    }
    80% {
      transform: scale(1.01, 0.99) skewX(1deg);
    }
  }

  .core {
    animation: core 1.9s ease-in-out infinite;
  }

  @keyframes core {
    50% {
      opacity: 0.82;
    }
  }

  .smoke {
    opacity: 0;
    transition: opacity 0.8s var(--ease-out);
  }

  [data-state='downloading'] .smoke {
    opacity: 1;
  }

  .curl {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: curl 4.6s var(--ease-out) infinite;
  }

  @keyframes curl {
    0% {
      opacity: 0;
      transform: translateY(2px) scaleY(0.7);
    }
    30% {
      opacity: 0.6;
    }
    100% {
      opacity: 0;
      transform: translateY(-7px) scaleY(1.1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .flicker-g,
    .core,
    .glow,
    .curl {
      animation: none !important;
    }
    .curl {
      opacity: 0.45;
    }
    [data-state='warming'] .size-g {
      animation: none;
      transform: scale(0.45);
    }
    .lean-g {
      transition: none;
    }
  }
</style>
