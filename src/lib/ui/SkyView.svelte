<!--
  The shared sky (DESIGN.md §4.8, D42 step 2, D44). Strangers' lanterns drift over the town;
  tap one to read its few words on a paper tag. Nothing to like, count or reply to.

  The sky is wider than the screen: drag or swipe it (or use the wheel, or ← →) and it glides
  on, slowing, with far lanterns, mid and near moving at different speeds, and the stars
  slowest of all (Sky.svelte). Older lanterns come out as you reach the edge of what's here.
  Left alone for a moment, a faint wind carries the sky along.

  Yours sits low in the middle with its kindred gathered above it, joined by faint threads
  (D16): "others carry this too". Arriving straight from the rise, yours comes up from below.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { quintOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import type { SkyLantern } from '../sky/lantern';
  import {
    boundsOf,
    extendChunks,
    fillChunks,
    layoutChunk,
    perChunk,
    planSky,
    type Chunk,
    type Clearing,
    type Depth,
    type Placed,
    type Plan,
  } from '../sky/layout';
  import { loadSky, type More } from '../sky/sky';
  import { Camera } from './glide';
  import Lantern from './Lantern.svelte';
  import { calm } from './motion';
  import { setPan } from './pan';
  import { skyMusic } from '../sound/sound';
  import Wordmark from './Wordmark.svelte';

  let {
    focus,
    arriving = false,
    leaving = false,
    writeLabel = 'write a letter',
    onwrite,
    onready,
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
    /**
     * Whether the real lanterns are out. The painted ones behind the page stay until then, so
     * there's never an empty sky between the page and this one: they hand over in one movement.
     */
    onready?: (ready: boolean) => void;
    load?: typeof loadSky;
  } = $props();

  type View = { status: 'loading' } | { status: 'away' } | { status: 'ready'; mine: Set<string>; focus?: string };

  let view = $state.raw<View>({ status: 'loading' });
  /** Loading long enough to say something about it. */
  let slow = $state(false);
  let shown = $state(false);
  let selected = $state<string | null>(null);
  /** Where the tapped lantern was across the field when it was tapped; the sky holds still while it's read. */
  let tagX = $state(0);
  let plan = $state.raw<Plan>();
  let chunks = $state.raw<Chunk[]>([]);
  /**
   * The chunks whose lanterns are in the page. They join one per frame, nearest first, so
   * dozens of lanterns never arrive in a single frame (that was a visible hitch, D45); chunks
   * far off screen wait until the sky is dragged toward them.
   */
  let mounted = $state.raw<Set<number>>(new Set());
  let clear = $state.raw<Clearing[]>([]);
  let dragging = $state(false);
  /** More sky than one screen, so there's somewhere to wander. */
  let roomy = $state(false);
  const WANDERED = 'dear-sky:wandered';
  let wandered = $state(remembered());
  let heading = $state<HTMLElement>();
  let field = $state<HTMLElement>();
  let main = $state<HTMLElement>();
  const layers: Partial<Record<Depth, HTMLElement>> = {};

  /** Near first, so Tab meets the brightest lanterns (yours, your kindred) before the faint ones. */
  const ORDER: Depth[] = ['near', 'mid', 'far'];
  const SIZE = { far: 14, mid: 20, near: 27, focus: 40 } as const;
  const LOAD_MS = 15_000;
  /** How far a press can wander and still be a tap. */
  const SLOP = 6;
  /** Quiet this long, and the wind picks up. */
  const IDLE_MS = 2600;
  /** The wind, in px per ms along the near layer: a lantern's width every few seconds. */
  const WIND = 0.007;
  /** A desktop window resized by less than this keeps its layout; more, and the sky is dealt again. */
  const RESHAPE_PX = 80;

  const camera = new Camera();
  /** Every lantern fetched so far, in the order it came. */
  let loaded: SkyLantern[] = [];
  let more: More | undefined;
  let done = false;
  let fetching = false;
  /** After a page that didn't come, wait before asking again. */
  let restUntil = 0;
  let idleSince = 0;

  const placed = $derived.by(() => {
    if (view.status !== 'ready' || !plan) return [];
    const p = plan;
    const want = view.focus;
    return chunks.filter((c) => mounted.has(c.k)).flatMap((c) => laidOut(c, p, want, clear));
  });
  const byDepth = $derived({
    far: placed.filter((p) => p.depth === 'far'),
    mid: placed.filter((p) => p.depth === 'mid'),
    near: placed.filter((p) => p.depth === 'near'),
  });
  const mine = $derived(view.status === 'ready' ? view.mine : new Set<string>());
  const chosen = $derived(placed.find((p) => p.lantern.id === selected));
  const center = $derived(placed.find((p) => p.role === 'focus'));
  const threads = $derived(center ? placed.filter((p) => p.role === 'kindred').map((k) => thread(center, k)) : []);
  const empty = $derived(view.status === 'ready' && placed.length === 0);

  /** Each chunk's places, kept: a chunk joining the page lays out only itself, not the whole sky. */
  const laid = new WeakMap<Chunk, { plan: Plan; focus?: string; clear: Clearing[]; placed: Placed[] }>();

  function laidOut(chunk: Chunk, p: Plan, want: string | undefined, around: Clearing[]): Placed[] {
    const kept = laid.get(chunk);
    if (kept && kept.plan === p && kept.focus === want && kept.clear === around) return kept.placed;
    const placed = layoutChunk(chunk, p, { focus: want, clear: around });
    laid.set(chunk, { plan: p, focus: want, clear: around, placed });
    return placed;
  }

  /** A faint line from yours to a kindred lantern, stopping short of both so their sway never shows. */
  function thread(from: Placed, to: Placed) {
    const at = (t: number) => ({ x: from.x + (to.x - from.x) * t, y: (from.y + (to.y - from.y) * t) * 100 });
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

  function remembered(): boolean {
    try {
      return localStorage.getItem(WANDERED) === '1';
    } catch {
      return false;
    }
  }

  function wander() {
    if (wandered) return;
    wandered = true;
    try {
      localStorage.setItem(WANDERED, '1');
    } catch {
      // Private modes can refuse; the hint simply comes back next time.
    }
  }

  async function fetchSky() {
    view = { status: 'loading' };
    slow = false;
    const slowTimer = setTimeout(() => (slow = true), 900);
    let giveUp: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!navigator.onLine) throw new Error('offline');
      if (!plan) measure();
      const sky = await Promise.race([
        load(plan ? perChunk(plan) * 3 : undefined),
        new Promise<never>((_, reject) => (giveUp = setTimeout(() => reject(new Error('slow sky')), LOAD_MS))),
      ]);
      // Offline, Firestore can answer from an empty cache: that's not an empty sky. A real answer
      // from the server that is empty is one, whatever this device remembers.
      if (sky.lanterns.length === 0 && sky.fromCache) throw new Error('unreachable');
      const want = focus && sky.lanterns.some((l) => l.id === focus) ? focus : sky.latest;
      loaded = sky.lanterns;
      more = sky.more;
      done = false;
      view = { status: 'ready', mine: sky.mine, focus: want };
      deal();
    } catch {
      view = { status: 'away' };
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(giveUp);
    }
  }

  /** Lays every lantern out again from the middle (on arrival, and when a device turns). */
  function deal() {
    if (!plan || view.status !== 'ready') return;
    chunks = fillChunks(loaded, plan, view.focus);
    mounted = new Set([0]);
    camera.stop();
    camera.x = 0;
    fit();
    paint(0);
  }

  function fit() {
    if (!plan) return;
    const { min, max } = boundsOf(chunks, plan);
    camera.setBounds(min, max, plan.width * 0.3);
    roomy = max > min;
  }

  /** Brings the nearest chunk not yet in the page into it, if it's within reach of the screen. */
  function mountNext() {
    if (!plan) return;
    let next: number | undefined;
    let nearest = plan.width * 2.5;
    for (const c of chunks) {
      const d = Math.abs(c.k * plan.width - camera.x);
      if (!mounted.has(c.k) && d <= nearest) {
        nearest = d;
        next = c.k;
      }
    }
    if (next !== undefined) mounted = new Set([...mounted, next]);
  }

  /** Near an end of what's here, older lanterns are fetched for that side. */
  function explore() {
    if (!plan || !more || done || fetching || performance.now() < restUntil) return;
    const { min, max } = camera.bounds;
    const reach = plan.width * 1.5;
    if (camera.x > max - reach) void grow(1);
    else if (camera.x < min + reach) void grow(-1);
  }

  async function grow(side: 1 | -1) {
    if (!plan || !more) return;
    const p = plan;
    fetching = true;
    try {
      const page = await more(perChunk(p) * 2);
      done = page.done;
      const have = new Set(loaded.map((l) => l.id));
      const fresh = page.lanterns.filter((l) => !have.has(l.id));
      if (fresh.length === 0) return;
      loaded = [...loaded, ...fresh];
      // Laid out afresh meanwhile (a device turned): `deal` has placed them already.
      if (p !== plan) return deal();
      chunks = [...chunks, ...extendChunks(chunks, fresh, side, p)];
      fit();
    } catch {
      restUntil = performance.now() + 8_000;
    } finally {
      fetching = false;
    }
  }

  function pick(p: Placed, lamp: HTMLElement) {
    if (selected === p.lantern.id) {
      selected = null;
      return;
    }
    camera.stop();
    // Where it really is right now, sway and all; it holds still while its tag is open.
    const at = lamp.querySelector('.drift')?.getBoundingClientRect() ?? lamp.getBoundingClientRect();
    const box = field?.getBoundingClientRect();
    tagX = at.left + at.width / 2 - (box?.left ?? 0);
    selected = p.lantern.id;
  }

  /** A tap anywhere that isn't a lantern or its tag puts the tag away. */
  function away(e: MouseEvent) {
    if (!(e.target as Element).closest('.lamp, .tag')) selected = null;
  }

  // ---- Moving the sky ----

  let press: {
    id: number;
    x: number;
    y: number;
    last: number;
    moved: boolean;
    caught: boolean;
    trail: { t: number; x: number }[];
  } | null = null;
  /** The click that ends a drag (or catches a glide) isn't a tap on whatever it ends over. */
  let swallow = false;

  function onpointerdown(e: PointerEvent) {
    swallow = false;
    if (!e.isPrimary || e.button !== 0 || view.status !== 'ready' || !plan) return;
    if ((e.target as Element).closest('.masthead, .tag, .moment')) return;
    const caught = camera.grab();
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, last: e.clientX, moved: false, caught, trail: [{ t: e.timeStamp, x: e.clientX }] };
    idleSince = performance.now();
  }

  function onpointermove(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    if (!press.moved) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < SLOP) return;
      press.moved = true;
      dragging = true;
      selected = null;
      try {
        main?.setPointerCapture(e.pointerId);
      } catch {
        // Already lifted: the up event is on its way.
      }
    }
    camera.drag(e.clientX - press.last);
    press.last = e.clientX;
    press.trail.push({ t: e.timeStamp, x: e.clientX });
    while (press.trail.length > 2 && e.timeStamp - press.trail[0].t > 100) press.trail.shift();
    idleSince = performance.now();
  }

  function onpointerup(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    if (press.moved) {
      swallow = true;
      camera.release(calm() ? 0 : velocity(press.trail, e.timeStamp));
      wander();
    } else {
      camera.release(0);
      swallow = press.caught;
    }
    press = null;
    dragging = false;
    idleSince = performance.now();
  }

  function onpointercancel(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    camera.release(0);
    press = null;
    dragging = false;
  }

  /** The finger's speed over its last tenth of a second, px/ms; nothing if it stopped before lifting. */
  function velocity(trail: { t: number; x: number }[], now: number): number {
    const first = trail[0];
    const last = trail[trail.length - 1];
    if (now - last.t > 60 || last.t - first.t < 8) return 0;
    return (last.x - first.x) / (last.t - first.t);
  }

  function onclickcapture(e: MouseEvent) {
    if (!swallow) return;
    swallow = false;
    e.stopPropagation();
    e.preventDefault();
  }

  function onwheel(e: WheelEvent) {
    if (e.ctrlKey || view.status !== 'ready' || !plan) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? plan.width : 1;
    const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
    if (d === 0) return;
    e.preventDefault();
    selected = null;
    camera.push(d, 90);
    idleSince = performance.now();
    wander();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && selected) {
      const id = selected;
      selected = null;
      document.querySelector<HTMLElement>(`.lamp[data-id="${CSS.escape(id)}"]`)?.focus();
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey || view.status !== 'ready' || !plan) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      selected = null;
      camera.push((e.key === 'ArrowRight' ? 1 : -1) * plan.width * 0.4, 260);
      idleSince = performance.now();
      wander();
    } else if (e.key === 'Home') {
      e.preventDefault();
      selected = null;
      camera.easeTo(0, 320);
      idleSince = performance.now();
    }
  }

  /** Tabbing to a lantern off the edge of the screen brings the sky round to it. */
  function onfocusin(e: FocusEvent) {
    const lamp = (e.target as Element).closest<HTMLElement>('.lamp');
    if (!lamp || !plan || !lamp.matches(':focus-visible')) return;
    const p = placed.find((q) => q.lantern.id === lamp.dataset.id);
    if (!p) return;
    const speed = plan.speed[p.depth];
    const x = p.x - camera.x * speed;
    const margin = Math.min(120, plan.width * 0.15);
    if (x < margin || x > plan.width - margin) {
      selected = null;
      camera.easeTo(camera.x + (x - plan.width / 2) / speed, 260);
      idleSince = performance.now();
    }
  }

  // ---- Once a frame ----

  let wind = 0;
  let windWay: 1 | -1 = 1;
  let painted = NaN;

  /** Moves each layer along by its speed. Only `transform`: the rise and sink (CSS) own `translate`. */
  function paint(x: number) {
    painted = x;
    if (!plan) return;
    for (const d of ORDER) {
      const el = layers[d];
      if (el) el.style.transform = `translate3d(${(-x * plan.speed[d]).toFixed(2)}px, 0, 0)`;
    }
    setPan(x);
  }

  /** The wind: only when nobody's touching the sky or reading it, easing in, turning softly at the ends. */
  function blow(now: number, dt: number) {
    const { min, max } = camera.bounds;
    const still = !calm() && !selected && !press && !camera.moving && max > min && now - idleSince > IDLE_MS;
    if (!plan || !still) {
      wind = 0;
      return;
    }
    const turn = plan.width * 0.25;
    if (camera.x >= max - turn) windWay = -1;
    else if (camera.x <= min + turn) windWay = 1;
    wind += (windWay * WIND - wind) * (1 - Math.exp(-dt / 1800));
    camera.nudge(wind * dt);
  }

  /** Tracks the moon's place, so no lantern sits in front of it when the sky first comes out. */
  function measure() {
    if (!field) return;
    const box = field.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    plan = planSky(box.width, box.height, calm());
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

  $effect(() => onready?.(view.status === 'ready' && !leaving));

  // The music opens up on the sky: its pad joins, and leaves as the sky does (D47).
  $effect(() => skyMusic(!leaving));

  onMount(() => {
    measure();
    void fetchSky();
    requestAnimationFrame(() => (shown = true));
    heading?.focus({ preventScroll: true });
    // Straight from the rise: let it arrive before the wind takes the sky anywhere.
    idleSince = performance.now() + (arriving ? 4_000 : 0);

    let raf = 0;
    let last = 0;
    let beat = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(48, t - last) : 16.7;
      last = t;
      camera.step(dt);
      blow(t, dt);
      if (camera.x !== painted) paint(camera.x);
      if (view.status === 'ready') {
        // Every other frame: each chunk's lanterns get a frame to themselves to settle in.
        if (++beat % 2 === 0) mountNext();
        explore();
      }
    };
    raf = requestAnimationFrame(frame);

    main?.addEventListener('wheel', onwheel, { passive: false });
    // Turning a phone or tablet reshapes the sky; anything smaller keeps it as it is.
    const turn = matchMedia('(orientation: portrait)');
    const reshape = () => {
      measure();
      deal();
    };
    turn.addEventListener('change', reshape);
    // A desktop window resized to a different width does too. Debounced, and small changes are ignored.
    let settle: ReturnType<typeof setTimeout> | undefined;
    const resized = new ResizeObserver(() => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        const width = field?.getBoundingClientRect().width ?? 0;
        if (plan && width > 0 && Math.abs(width - plan.width) > RESHAPE_PX) reshape();
      }, 200);
    });
    if (field) resized.observe(field);
    return () => {
      clearTimeout(settle);
      resized.disconnect();
      skyMusic(false);
      cancelAnimationFrame(raf);
      main?.removeEventListener('wheel', onwheel);
      turn.removeEventListener('change', reshape);
    };
  });
</script>

<svelte:window {onkeydown} {onpointermove} {onpointerup} {onpointercancel} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<main
  class="sky-view"
  class:shown
  class:leaving
  class:dragging
  bind:this={main}
  onclick={away}
  {onclickcapture}
  {onpointerdown}
  {onfocusin}
>
  <h1 class="visually-hidden" tabindex="-1" bind:this={heading}>The shared sky</h1>

  <header class="masthead">
    <Wordmark />
    <button class="soft-button pill" type="button" onclick={onwrite}>
      <span class="ember" aria-hidden="true"></span>{writeLabel}
    </button>
  </header>

  <div class="field" class:reading={!!chosen} class:out={view.status === 'ready'} bind:this={field}>
    {#each ORDER as depth (depth)}
      <div class="layer {depth}" bind:this={layers[depth]}>
        {#if depth === 'near' && threads.length && plan}
          <svg
            class="threads"
            class:late={arriving}
            width={plan.width}
            viewBox="0 0 {plan.width} 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {#each threads as t (t.id)}
              <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} vector-effect="non-scaling-stroke" />
            {/each}
          </svg>
        {/if}

        {#each byDepth[depth] as p (p.lantern.id)}
          {@const size = sizeOf(p)}
          <button
            type="button"
            class="lamp {p.role}"
            class:chosen={selected === p.lantern.id}
            class:rising={arriving && p.role === 'focus'}
            data-id={p.lantern.id}
            style:left="{p.x}px"
            style:top="{p.y * 100}%"
            style:--w="{size}px"
            style:--sway="{p.sway}s"
            style:--phase="{p.phase}s"
            style:--delay="{arriving ? p.delay + 1.2 : p.delay}s"
            aria-label={label(p)}
            aria-expanded={selected === p.lantern.id}
            onclick={(e) => pick(p, e.currentTarget)}
          >
            <span class="arrive">
              <span class="drift">
                <span class="halo" aria-hidden="true"></span>
                <Lantern {...p.recipe} {size} />
              </span>
              {#if p.role === 'focus'}<span class="yours" aria-hidden="true">yours</span>{/if}
            </span>
          </button>
        {/each}
      </div>
    {/each}

    {#if chosen}
      {#key chosen.lantern.id}
        <div
          class="tag"
          class:left={tagX >= (plan?.width ?? 0) / 2}
          class:up={chosen.y >= 0.5}
          style:--sx="{tagX}px"
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

  <div class="caption" class:shown={view.status === 'ready' && !empty}>
    <p>every lantern here is a few words someone chose to let go</p>
    <p class="hint" class:gone={wandered || !roomy} aria-hidden="true">
      <span class="by-mouse">drag the sky to wander</span><span class="by-touch">swipe the sky to wander</span>
    </p>
  </div>

  <p class="visually-hidden" aria-live="polite">
    {#if chosen}{chosen.lantern.essence} ({chosen.lantern.feeling}){/if}
  </p>
</main>

<style>
  .sky-view {
    position: fixed;
    inset: 0;
    z-index: 1;
    /* clip, not hidden: a hidden box can still be scrolled by focus, which would fight the camera. */
    overflow: clip;
    opacity: 0;
    touch-action: none;
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

  /* The sky between the masthead and the rooftops: one chunk of it is exactly this wide. */
  .field {
    position: absolute;
    inset: 84px 16px calc(var(--horizon-h) * 0.75) 16px;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
  }

  .dragging,
  .dragging :global(*) {
    cursor: grabbing;
  }

  /* One layer per depth, moved as a whole (only `transform`, once a frame): far behind near. */
  .layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    will-change: transform;
  }

  /* How far each layer rises as the lanterns come out (D45): near more than far, the same depth
     as a drag. On the compositor (CSS `translate`), so it stays smooth while lanterns are added. */
  .layer.far {
    --lift: 58px;
    z-index: 1;
  }

  .layer.mid {
    --lift: 73px;
    z-index: 2;
  }

  .layer.near {
    --lift: 90px;
    z-index: 3;
  }

  /* Coming to the sky everything flows up: the lanterns rise into place as they come out. */
  .field.out .layer {
    animation: lift-in 1.5s var(--ease-out) backwards;
  }

  @keyframes lift-in {
    from {
      translate: 0 var(--lift);
    }
  }

  /* Back to the page everything settles down: the sky sinks a little as it fades. */
  .sky-view.leaving .layer {
    translate: 0 calc(var(--lift) * 0.5);
    transition: translate var(--t-panel) var(--ease-out);
  }

  .threads {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    overflow: visible;
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
    --sway-x: 16px;
    --bob-y: -9px;
    --glow: 0.6;
    --dim: 1;
    position: absolute;
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
    pointer-events: auto;
    translate: -50% -50%;
    -webkit-tap-highlight-color: transparent;
  }

  /* Far ones: smaller, fainter, and they wander less, as distant things seem to. */
  .far .lamp {
    --sway-x: 8px;
    --bob-y: -5px;
    --glow: 0.32;
    --dim: 0.72;
  }

  .mid .lamp {
    --sway-x: 12px;
    --bob-y: -7px;
    --glow: 0.48;
    --dim: 0.9;
  }

  .near .lamp {
    --sway-x: 20px;
    --bob-y: -12px;
    --glow: 0.75;
  }

  /* Yours stays close to home. */
  .lamp.focus {
    --sway-x: 6px;
    --glow: 1;
    z-index: 2;
  }

  .lamp.chosen {
    --glow: 1;
    z-index: 3;
  }

  .field.reading .lamp:not(.chosen) {
    --dim: 0.45;
  }

  .lamp:focus-visible {
    outline-offset: 2px;
  }

  /* Coming out one by one, scattered, a little below where they settle. Backwards fill only:
     once out, nothing holds the element on its own layer. */
  .arrive {
    position: relative;
    display: grid;
    place-items: center;
    animation: come-out 1.6s var(--ease-out) var(--delay) backwards;
  }

  @keyframes come-out {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
  }

  /* Yours, straight from the rise: up from the rooftops to its place, slowing as it arrives. */
  .lamp.rising .arrive {
    animation: rise-in 3.6s cubic-bezier(0.2, 0.7, 0.2, 1) 0.2s backwards;
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

  /* One slow wander on the air: a sideways sway with two gentle bobs in it, each lantern on its
     own clock. One animation per lantern, not two: starting dozens at once was most of the
     hitch when the sky came in (D45). */
  .drift {
    position: relative;
    display: grid;
    place-items: center;
    opacity: var(--dim);
    animation: wander var(--sway) ease-in-out var(--phase) infinite;
    transition:
      opacity 0.5s var(--ease-out),
      scale 0.5s var(--ease-out);
  }

  /* Held still while its tag is read. */
  .lamp.chosen .drift {
    animation-play-state: paused;
  }

  @keyframes wander {
    0%,
    100% {
      transform: translate(calc(var(--sway-x) * -1), 0) rotate(-2deg);
    }
    25% {
      transform: translate(calc(var(--sway-x) * -0.35), var(--bob-y)) rotate(1.5deg);
    }
    50% {
      transform: translate(var(--sway-x), calc(var(--bob-y) * 0.15)) rotate(-1deg);
    }
    75% {
      transform: translate(calc(var(--sway-x) * 0.35), var(--bob-y)) rotate(2deg);
    }
  }

  @media (hover: hover) {
    .lamp:hover .drift {
      scale: 1.12;
    }
  }

  .lamp.chosen .drift {
    scale: 1.12;
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
    cursor: auto;
    user-select: text;
    -webkit-user-select: text;
    rotate: -0.6deg;
    box-shadow:
      inset 0 0 40px var(--paper-edge),
      inset 0 1px 0 var(--paper-light),
      0 1px 2px oklch(0.1 0.03 275 / 0.3),
      0 14px 30px -10px oklch(0.08 0.04 275 / 0.55);
  }

  .tag:not(.left) {
    left: calc(var(--sx) + var(--reach));
  }

  .tag.left {
    right: calc(100% - var(--sx) + var(--reach));
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
    z-index: 5;
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
    cursor: auto;
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
    /* Room for the sound switch in the corner. */
    right: 64px;
    bottom: calc(14px + env(safe-area-inset-bottom));
    color: var(--ui-soft);
    font-size: 0.875rem;
    letter-spacing: 0.01em;
    opacity: 0;
    transition: opacity 1.2s var(--ease-out) 1.8s;
    pointer-events: none;
  }

  .caption p {
    margin: 0;
  }

  .caption.shown {
    opacity: 1;
  }

  /* Until the first wander, a quiet line says the sky goes on. It fades for good once it has. */
  .hint {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 0;
    color: var(--ui-soft);
    font-family: var(--font-hand);
    font-size: 0.95rem;
    opacity: 0.8;
    transition: opacity 0.9s var(--ease-out);
  }

  .hint.gone {
    opacity: 0;
  }

  .by-touch {
    display: none;
  }

  @media (pointer: coarse) {
    .by-mouse {
      display: none;
    }

    .by-touch {
      display: inline;
    }
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
    .lamp.focus .halo,
    .field.out .layer {
      animation: none;
    }

    .sky-view.leaving .layer {
      translate: none;
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
