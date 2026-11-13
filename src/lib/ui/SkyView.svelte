<!--
  The shared sky (DESIGN.md §4.8, design/stitch/final-08-sky.png). Strangers' lanterns drift over
  the town; tap one to read its few words on a paper tag. Nothing to like, count or reply to.

  Yours sits low in the middle with its kindred gathered above it, joined by faint threads
  (D16): "others carry this too". Arriving straight from the rise, yours comes up from below.
  Places come from each lantern's id (`layoutSky`), so the sky is the same on every visit.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { quintOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import type { SkyLantern } from '../sky/lantern';
  import { layoutSky, type Clearing, type Placed } from '../sky/layout';
  import { loadSky, SKY_MAX } from '../sky/sky';
  import Lantern from './Lantern.svelte';

  let {
    focus,
    arriving = false,
    leaving = false,
    writeLabel = 'write a letter',
    onwrite,
    load = loadSky,
  }: {
    /** The lantern to gather the sky around: the one just released. Else your newest. */
    focus?: string;
    /** Came straight from the rise: yours comes up from below to its place. */
    arriving?: boolean;
    /** True while the app fades this screen out. */
    leaving?: boolean;
    writeLabel?: string;
    onwrite: () => void;
    load?: typeof loadSky;
  } = $props();

  type View =
    | { status: 'loading' }
    | { status: 'away' }
    | { status: 'ready'; lanterns: SkyLantern[]; mine: Set<string>; focus?: string };

  let view = $state.raw<View>({ status: 'loading' });
  /** Loading long enough to say something about it. */
  let slow = $state(false);
  let shown = $state(false);
  let selected = $state<string | null>(null);
  let aspect = $state(1.7);
  let narrow = $state(false);
  let clear = $state.raw<Clearing[]>([]);
  let heading = $state<HTMLElement>();
  let field = $state<HTMLElement>();

  const SIZE = { far: 13, mid: 19, near: 26, focus: 40 } as const;
  const LOAD_MS = 15_000;
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const placed = $derived(
    view.status === 'ready'
      ? layoutSky(view.lanterns, { focus: view.focus, aspect, clear, max: narrow ? 36 : SKY_MAX })
      : [],
  );
  const mine = $derived(view.status === 'ready' ? view.mine : new Set<string>());
  const chosen = $derived(placed.find((p) => p.lantern.id === selected));
  const center = $derived(placed.find((p) => p.role === 'focus'));
  const threads = $derived(center ? placed.filter((p) => p.role === 'kindred').map((k) => thread(center, k)) : []);
  const empty = $derived(view.status === 'ready' && placed.length === 0);

  /** A faint line from yours to a kindred lantern, stopping short of both so their drift never shows. */
  function thread(from: Placed, to: Placed) {
    const at = (t: number) => ({ x: (from.x + (to.x - from.x) * t) * 100, y: (from.y + (to.y - from.y) * t) * 100 });
    const a = at(0.26);
    const b = at(0.8);
    return { id: to.lantern.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }

  function sizeOf(p: Placed): number {
    return p.role === 'focus' ? SIZE.focus : SIZE[p.depth];
  }

  function label(p: Placed): string {
    return mine.has(p.lantern.id) ? 'your lantern' : `a lantern of ${p.lantern.feeling}`;
  }

  async function fetchSky() {
    view = { status: 'loading' };
    slow = false;
    const slowTimer = setTimeout(() => (slow = true), 900);
    try {
      if (!navigator.onLine) throw new Error('offline');
      const sky = await Promise.race([
        load(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('slow sky')), LOAD_MS)),
      ]);
      // Offline, Firestore can answer from an empty cache: that's not an empty sky.
      if (sky.lanterns.length === 0 && sky.mine.size > 0) throw new Error('unreachable');
      const want = focus && sky.lanterns.some((l) => l.id === focus) ? focus : sky.latest;
      view = { status: 'ready', lanterns: sky.lanterns, mine: sky.mine, focus: want };
    } catch {
      view = { status: 'away' };
    } finally {
      clearTimeout(slowTimer);
    }
  }

  function pick(id: string) {
    selected = selected === id ? null : id;
  }

  /** A tap anywhere that isn't a lantern or its tag puts the tag away. */
  function away(e: MouseEvent) {
    if (!(e.target as Element).closest('.lamp, .tag')) selected = null;
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !selected) return;
    const id = selected;
    selected = null;
    document.querySelector<HTMLElement>(`.lamp[data-id="${CSS.escape(id)}"]`)?.focus();
  }

  /** The field's shape and where the moon is, once: lanterns keep their places through small resizes. */
  function measure() {
    if (!field) return;
    const box = field.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    aspect = Math.max(0.4, box.width / box.height);
    narrow = innerWidth < 600;
    const moon = document.querySelector('.sky .moon')?.getBoundingClientRect();
    clear = moon
      ? [
          {
            x: (moon.left + moon.width / 2 - box.left) / box.width,
            y: (moon.top + moon.height / 2 - box.top) / box.height,
            // The moon, its halo and the wisp of cloud across it.
            r: (moon.width * 0.7 + 24) / box.height,
          },
        ]
      : [];
  }

  onMount(() => {
    measure();
    void fetchSky();
    requestAnimationFrame(() => (shown = true));
    heading?.focus({ preventScroll: true });
    // Turning a phone or tablet reshapes the sky; anything smaller keeps it as it is.
    const turn = matchMedia('(orientation: portrait)');
    const reshape = () => measure();
    turn.addEventListener('change', reshape);
    return () => turn.removeEventListener('change', reshape);
  });
</script>

<svelte:window {onkeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<main class="sky-view" class:shown class:leaving onclick={away}>
  <h1 class="visually-hidden" tabindex="-1" bind:this={heading}>The shared sky</h1>

  <header class="masthead">
    <span class="wordmark"><Lantern tone="honey" size={17} />dear sky</span>
    <button class="soft-button pill" type="button" onclick={onwrite}>
      <span class="ember" aria-hidden="true"></span>{writeLabel}
    </button>
  </header>

  <div class="field" class:reading={!!chosen} bind:this={field}>
    {#if threads.length}
      <svg class="threads" class:late={arriving} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {#each threads as t (t.id)}
          <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} vector-effect="non-scaling-stroke" />
        {/each}
      </svg>
    {/if}

    {#each placed as p (p.lantern.id)}
      {@const size = sizeOf(p)}
      <button
        type="button"
        class="lamp {p.depth} {p.role}"
        class:chosen={selected === p.lantern.id}
        class:rising={arriving && p.role === 'focus'}
        data-id={p.lantern.id}
        style:left="{p.x * 100}%"
        style:top="{p.y * 100}%"
        style:--w="{size}px"
        style:--drift="{p.drift}s"
        style:--phase="{p.phase}s"
        style:--delay="{arriving ? p.delay + 1.2 : p.delay}s"
        aria-label={label(p)}
        aria-expanded={selected === p.lantern.id}
        onclick={() => pick(p.lantern.id)}
      >
        <span class="arrive">
          <span class="drift">
            <span class="halo" aria-hidden="true"></span>
            <Lantern tone={p.tone} {size} />
          </span>
          {#if p.role === 'focus'}<span class="yours" aria-hidden="true">yours</span>{/if}
        </span>
      </button>
    {/each}

    {#if chosen}
      {#key chosen.lantern.id}
        <div
          class="tag"
          class:left={chosen.x >= 0.5}
          class:up={chosen.y >= 0.5}
          style:--x={chosen.x}
          style:--y={chosen.y}
          style:--reach="{sizeOf(chosen) / 2 + 16}px"
          in:fly={{ y: calm() ? 0 : 6, duration: 380, easing: quintOut }}
          out:fade={{ duration: 160 }}
        >
          <span class="hole" aria-hidden="true"></span>
          <p class="essence">{chosen.lantern.essence}</p>
          <p class="meta">
            <span>{chosen.lantern.feeling}</span>
            {#if chosen.lantern.motif}<span aria-hidden="true">·</span><span>{chosen.lantern.motif}</span>{/if}
            {#if mine.has(chosen.lantern.id)}<span class="mine">yours</span>{/if}
          </p>
        </div>
      {/key}
    {/if}

    <!-- One cell for every note, held in the middle of the sky. -->
    <div class="notes">
      <div class="moment" class:shown={view.status === 'loading' && slow}>
        <p class="hand">the lanterns are coming out</p>
      </div>
      <div class="moment" class:shown={view.status === 'away'} inert={view.status !== 'away'}>
        <p class="hand">the sky is hard to reach tonight.</p>
        <p class="kind">your letter and your lanterns are safe on this device.</p>
        <button class="soft-button" type="button" onclick={fetchSky}>try again</button>
      </div>
      <div class="moment" class:shown={empty}>
        <p class="hand">the sky is quiet tonight. yours could be the first.</p>
      </div>
    </div>
  </div>

  <p class="caption" class:shown={view.status === 'ready' && !empty}>
    every lantern here is a few words someone chose to let go
  </p>

  <p class="visually-hidden" aria-live="polite">
    {#if chosen}{chosen.lantern.essence} ({chosen.lantern.feeling}){/if}
  </p>
</main>

<style>
  .sky-view {
    position: fixed;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    opacity: 0;
    transition: opacity var(--t-panel) var(--ease-out);
  }

  .sky-view.shown {
    opacity: 1;
  }

  .sky-view.leaving {
    opacity: 0;
    pointer-events: none;
  }

  /* The same place as the writing page's masthead, so the wordmark never moves between screens. */
  .masthead {
    position: relative;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: min(100% - 32px, var(--sheet-w));
    height: 68px;
    margin: 0 auto;
    padding: 4px 4px 0;
  }

  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-family: var(--font-letter);
    font-size: 1.3125rem;
    font-weight: 430;
    letter-spacing: 0.01em;
    color: var(--ui);
    white-space: nowrap;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 8px 18px;
    font-size: 0.92rem;
    white-space: nowrap;
  }

  .ember {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--flame);
    box-shadow: 0 0 8px 1px var(--lantern-glow);
  }

  /* The sky between the masthead and the rooftops. Lanterns are placed in it by percentage. */
  .field {
    position: absolute;
    inset: 84px 16px calc(var(--horizon-h) * 0.75) 16px;
  }

  .threads {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
    stroke: var(--thread);
    stroke-width: 1.2;
    stroke-dasharray: 1 7;
    stroke-linecap: round;
    animation: appear 2s var(--ease-out) 1.4s both;
  }

  .threads.late {
    animation-delay: 3.6s;
  }

  .lamp {
    --amp-x: 4px;
    --amp-y: -10px;
    --glow: 0.6;
    --dim: 1;
    position: absolute;
    z-index: 2;
    display: grid;
    place-items: center;
    width: max(40px, var(--w));
    height: max(44px, calc(var(--w) * 1.4));
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    cursor: pointer;
    translate: -50% -50%;
    -webkit-tap-highlight-color: transparent;
  }

  .lamp.far {
    --amp-x: 3px;
    --amp-y: -6px;
    --glow: 0.35;
    --dim: 0.78;
    z-index: 1;
  }

  .lamp.near,
  .lamp.kindred {
    --amp-x: 5px;
    --amp-y: -14px;
    --glow: 0.75;
    z-index: 3;
  }

  .lamp.focus {
    --glow: 1;
    z-index: 4;
  }

  .lamp.chosen {
    --glow: 1;
    z-index: 5;
  }

  .field.reading .lamp:not(.chosen) {
    --dim: 0.45;
  }

  .lamp:focus-visible {
    outline-offset: 2px;
  }

  /* Coming out one by one, scattered, a little below where they settle. */
  .arrive {
    position: relative;
    display: grid;
    place-items: center;
    animation: come-out 1.6s var(--ease-out) var(--delay) both;
  }

  @keyframes come-out {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
  }

  /* Yours, straight from the rise: up from the rooftops to its place, slowing as it arrives. */
  .lamp.rising .arrive {
    animation: rise-in 3.6s cubic-bezier(0.2, 0.7, 0.2, 1) 0.2s both;
  }

  @keyframes rise-in {
    from {
      opacity: 0;
      transform: translateY(48vh) scale(0.86);
    }
    25% {
      opacity: 1;
    }
  }

  .drift {
    position: relative;
    display: grid;
    place-items: center;
    opacity: var(--dim);
    animation: drift var(--drift) ease-in-out var(--phase) infinite alternate;
    transition:
      opacity 0.5s var(--ease-out),
      scale 0.5s var(--ease-out);
  }

  .lamp:hover .drift,
  .lamp.chosen .drift {
    scale: 1.12;
  }

  @keyframes drift {
    from {
      translate: 0 0;
      rotate: -2deg;
    }
    to {
      translate: var(--amp-x) var(--amp-y);
      rotate: 2deg;
    }
  }

  .halo {
    position: absolute;
    inset: -75% -95%;
    border-radius: 50%;
    background: radial-gradient(closest-side, var(--lantern-glow), transparent 85%);
    opacity: var(--glow);
    pointer-events: none;
    transition:
      opacity 0.5s var(--ease-out),
      scale 0.5s var(--ease-out);
  }

  .lamp.focus .halo {
    animation: breathe 3.4s ease-in-out infinite alternate;
  }

  .lamp.chosen .halo {
    scale: 1.25;
  }

  @keyframes breathe {
    to {
      transform: scale(1.08);
    }
  }

  .drift :global(.lantern) {
    position: relative;
  }

  .yours {
    position: absolute;
    top: calc(100% + 8px);
    color: var(--ui-soft);
    font-family: var(--font-hand);
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    pointer-events: none;
  }

  /* The paper tag beside a tapped lantern: on the side with room, above it when it's low. */
  .tag {
    position: absolute;
    z-index: 10;
    width: min(300px, 100%);
    padding: 22px 22px 14px 30px;
    border-radius: 14px;
    background-color: var(--paper);
    background-image: var(--grain, none), linear-gradient(172deg, var(--paper) 55%, var(--paper-shade));
    color: var(--ink);
    rotate: -0.6deg;
    box-shadow:
      inset 0 0 40px var(--paper-edge),
      inset 0 1px 0 var(--paper-light),
      0 1px 2px oklch(0.1 0.03 275 / 0.3),
      0 14px 30px -10px oklch(0.08 0.04 275 / 0.55);
  }

  .tag:not(.left) {
    left: calc(var(--x) * 100% + var(--reach));
  }

  .tag.left {
    right: calc((1 - var(--x)) * 100% + var(--reach));
    rotate: 0.6deg;
  }

  .tag:not(.up) {
    top: calc(var(--y) * 100% - 26px);
  }

  .tag.up {
    bottom: calc((1 - var(--y)) * 100% - 26px);
  }

  .hole {
    position: absolute;
    top: 14px;
    left: 12px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--sky-top);
    box-shadow:
      inset 0 1px 2px oklch(0 0 0 / 0.5),
      0 0 0 2.5px oklch(0.88 0.03 80);
  }

  .essence {
    margin: 0;
    font-family: var(--font-letter);
    font-size: 1.1rem;
    font-style: italic;
    line-height: 1.5;
    text-wrap: pretty;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 2px 7px;
    margin: 10px 0 0;
    color: var(--hand);
    font-family: var(--font-hand);
    font-size: 0.85rem;
  }

  .meta .mine {
    margin-left: 6px;
    color: var(--ink-faded);
  }

  .notes {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
  }

  .moment {
    grid-area: 1 / 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 0 16px;
    opacity: 0;
    transition: opacity 0.7s var(--ease-out);
  }

  .moment.shown {
    opacity: 1;
    pointer-events: auto;
  }

  .hand {
    max-width: 34ch;
    margin: 0;
    color: var(--essence-on-sky);
    font-family: var(--font-hand);
    font-size: 1.1rem;
    text-align: center;
    text-wrap: balance;
  }

  .kind {
    max-width: 44ch;
    margin: -6px 0 0;
    color: var(--ui-soft);
    font-size: 0.95rem;
    text-align: center;
    text-wrap: pretty;
  }

  /* Bottom left, under the wordmark: the lit window is always right of centre, so they never meet. */
  .caption {
    position: absolute;
    left: max(20px, calc((100% - var(--sheet-w)) / 2 + 4px));
    right: 16px;
    bottom: calc(14px + env(safe-area-inset-bottom));
    margin: 0;
    color: var(--ui-soft);
    font-size: 0.875rem;
    letter-spacing: 0.01em;
    opacity: 0;
    transition: opacity 1.2s var(--ease-out) 1.8s;
    pointer-events: none;
  }

  .caption.shown {
    opacity: 1;
  }

  @keyframes appear {
    from {
      opacity: 0;
    }
  }

  /* The moon sits in the header's corner until 1180px: leave it room. */
  @media (max-width: 939px) {
    .masthead {
      padding-right: 64px;
    }
  }

  /* Phones: the tag reads across the sky, just above or below its lantern. */
  @media (max-width: 599px) {
    .masthead {
      height: 62px;
    }

    .field {
      top: 76px;
    }

    .caption {
      font-size: 0.8rem;
    }

    .tag,
    .tag.left,
    .tag:not(.left) {
      left: 0;
      right: 0;
      width: auto;
      max-width: 340px;
      margin-inline: auto;
    }

    .tag:not(.up) {
      top: calc(var(--y) * 100% + var(--reach) + 4px);
    }

    .tag.up {
      bottom: calc((1 - var(--y)) * 100% + var(--reach) + 4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .drift,
    .lamp.focus .halo {
      animation: none;
    }

    @keyframes come-out {
      from {
        opacity: 0;
      }
    }

    @keyframes rise-in {
      from {
        opacity: 0;
      }
    }
  }
</style>
