<!--
  Consent (DESIGN.md §4.6), a hanging lantern. A paper tag
  hangs from the lantern by a thread, holding exactly the words that would leave the device, and
  nothing else. The writer can change them; the leak check (D25) runs on every change and gently
  underlines anything that might point back to someone. "light my lantern" is gate 3 (D2): the
  exact words on the tag go through `approveRelease`, then the cloud check (D30). Then they're
  released to the shared sky (D32): the lantern lets go of its thread and hovers while the server
  moderates them again and finds kindred lanterns, then rises, or settles back if it's held.
  While the flame catches, the lantern is painted from those same words (D13): the plain paper
  lantern softens into its own tone, shape and glyph.

  With no essence (no model, or the writer chose to), the same tag starts empty: the writer
  writes the lantern's words themselves (DESIGN.md §4b), with the same checks.
-->
<script lang="ts">
  import { play } from '../sound/sound';
  import { onDestroy, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { Moderation } from '../cloud/moderation';
  import type { LanternStatus } from '../sky/sky';
  import { FEELINGS, type Feeling } from '../engine/prompts';
  import type { Essence, Painted } from '../engine/types';
  import type { LeakKind, LeakProblem } from '../privacy/leakcheck';
  import { approveRelease, type ApprovedWords } from '../privacy/release';
  import type { LanternWords } from '../sky/lantern';
  import { recipeOf, type Glyph, type Recipe } from '../sky/recipe';
  import Lantern from './Lantern.svelte';
  import Wordmark from './Wordmark.svelte';
  import { markSegments } from './marks';

  let {
    letter,
    initial,
    check,
    sketch,
    paint,
    sky,
    leaving = false,
    up = false,
    onkeep,
    onback,
    onsky,
  }: {
    /** Stays on this device: only the leak check reads it, here, in code. */
    letter: string;
    /** Nano's essence, or null when the writer writes the words themselves. */
    initial: Essence | null;
    /** The cloud check on the approved words (D30). */
    check: (words: ApprovedWords) => Promise<Moderation>;
    /** Paints the glyph ahead from the tag's words, on this device only, while the writer reads. */
    sketch?: (words: LanternWords) => void;
    /** Picks the lantern's glyph from the approved words, on the device when it can (D13). */
    paint: (words: ApprovedWords) => Promise<Painted>;
    /** The shared sky (D32): send the approved words, then follow them until moderated. */
    sky: {
      release: (words: ApprovedWords, glyph: Glyph) => Promise<string>;
      watch: (id: string, onStatus: (status: LanternStatus, kindred: string[]) => void) => () => void;
    };
    /** True while the app fades this screen out. */
    leaving?: boolean;
    /** Leaving for the sky: lift away as it fades, the start of one upward flow (D45). */
    up?: boolean;
    /** "keep it to myself": back to the letter, nothing sent. */
    onkeep: () => void;
    /** After the lantern has gone up. */
    onback: () => void;
    /** After it has risen: go and find it in the shared sky. */
    onsky?: (id: string) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const own = initial === null;
  // svelte-ignore state_referenced_locally
  let feeling = $state<Feeling | null>(initial?.feeling ?? null);
  // svelte-ignore state_referenced_locally
  let essence = $state(initial?.essence ?? '');
  // svelte-ignore state_referenced_locally
  let motif = $state(initial?.motif ?? '');

  /**
   * Order: tag, lighting (client check), hovering (server check), rising.
   * `held`: a check declined the words. `still`: they couldn't be sent. Both return to the tag.
   */
  type Phase = 'tag' | 'lighting' | 'hovering' | 'held' | 'still' | 'rising';
  let phase = $state<Phase>('tag');
  let shown = $state(false);
  let risen = $state(false);
  /** Has let go of its thread at least once; keeps the bob alive while it settles back. */
  let aloft = $state(false);
  /** Hovering long enough that it's waiting for the wind (offline, or a slow sky). */
  let windy = $state(false);
  let kindredCount = $state(0);
  /** The risen lantern's id, to find it again in the sky. */
  let risenId = $state<string | null>(null);
  /** How this lantern is drawn, once it's been painted from the approved words. */
  let painted = $state<Recipe | null>(null);

  const WIND_MS = 12_000;
  let alive = true;
  let stopWatching: (() => void) | undefined;
  let windTimer: ReturnType<typeof setTimeout> | undefined;

  const COUNT = ['', 'one', 'two', 'three'];
  const risenLine = $derived(
    kindredCount === 0
      ? "it's on its way up."
      : kindredCount === 1
        ? "it's on its way up, beside one that carries something close."
        : `it's on its way up, beside ${COUNT[kindredCount] ?? 'a few'} that carry something close.`,
  );

  const MAX_WORDS = 15;
  const wordCount = $derived(essence.trim() ? essence.trim().split(/\s+/).length : 0);
  const verdict = $derived(approveRelease(letter, { feeling: feeling ?? 'love', essence, motif }));
  const problems = $derived<LeakProblem[]>(!verdict.ok && verdict.reason === 'leak' ? verdict.problems : []);
  const ready = $derived(verdict.ok && feeling !== null && wordCount <= MAX_WORDS);
  const locked = $derived(phase === 'lighting' || phase === 'hovering' || phase === 'rising');
  /** The tag and its buttons are out, editable, waiting for the writer. */
  const atTag = $derived(phase === 'tag' || phase === 'held' || phase === 'still');

  const essenceProblem = $derived(problems.find((p) => p.field === 'essence'));
  const motifProblem = $derived(problems.find((p) => p.field === 'motif'));
  const essenceMarks = $derived(markSegments(essence, problems.filter((p) => p.field === 'essence').map((p) => p.match)));
  const motifMarks = $derived(markSegments(motif, problems.filter((p) => p.field === 'motif').map((p) => p.match)));

  // While the writer reads or edits the tag, paint its glyph ahead on this device, so lighting
  // doesn't wait for a model (D13). A short pause first, so each keystroke doesn't queue one.
  $effect(() => {
    if (phase !== 'tag' || !ready || !verdict.ok || !sketch) return;
    const words = verdict.words;
    const timer = setTimeout(() => sketch(words), 600);
    return () => clearTimeout(timer);
  });

  function nudge(kind: LeakKind): string {
    if (kind === 'copied') return 'these words are straight from your letter. want to say it in new ones?';
    if (kind === 'script') return 'lanterns can only carry english words for now. want to change these?';
    return 'this might point back to someone. want to change it?';
  }

  /** Any change after a held or unsent lantern means a fresh try. */
  function edited() {
    if (phase === 'held' || phase === 'still') {
      phase = 'tag';
      aloft = false;
      painted = null; // new words, a new painting
    }
  }

  function choose(f: Feeling) {
    if (locked) return;
    feeling = f;
    edited();
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function light() {
    if (!feeling || !ready || locked) return;
    // Gate 3: these exact words, as they are on the tag right now (D2).
    const v = approveRelease(letter, { feeling, essence, motif });
    if (!v.ok) return;
    phase = 'lighting';
    void play('light');
    // On a short screen the lantern may be scrolled away: bring it back to watch it catch.
    window.scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' });
    // The lantern is painted while the flame catches, and shows the moment it's ready (D13).
    const painting = paint(v.words).then((p) => {
      if (alive) painted = recipeOf({ ...v.words, glyph: p.glyph });
      return p.glyph;
    });
    // The flame takes a moment to catch, however fast the cloud answers.
    const [result, glyph] = await Promise.all([check(v.words), painting, sleep(calm() ? 600 : 1800)]);
    if (!alive) return;
    if (result === 'held') {
      phase = 'held';
      return;
    }

    // Clear or unchecked: the server moderates again either way (D32), so it can't be skipped.
    phase = 'hovering';
    aloft = true;
    // Long enough to see it hover, even when the sky answers at once.
    const hovered = sleep(calm() ? 400 : 2600);
    windTimer = setTimeout(() => (windy = true), WIND_MS);

    let id: string;
    try {
      // Kept on this device first, then sent; offline, it hovers here, waiting for the wind (D34).
      id = await sky.release(v.words, glyph);
    } catch {
      await hovered;
      settle('still');
      return;
    }
    if (!alive) return;

    stopWatching = sky.watch(id, async (status, kindred) => {
      if (status === 'waiting') return;
      stopWatching?.();
      stopWatching = undefined;
      await hovered;
      if (!alive) return;
      if (status === 'held' || status === 'refused') {
        settle(status === 'held' ? 'held' : 'still');
        return;
      }
      clearTimeout(windTimer);
      windy = false;
      kindredCount = kindred.length;
      risenId = id;
      phase = 'rising';
      void play('rise');
      setTimeout(() => (risen = true), calm() ? 600 : 3200);
    });
  }

  /** The lantern comes back down to its thread, and the tag returns. */
  function settle(to: 'held' | 'still') {
    clearTimeout(windTimer);
    windy = false;
    phase = to;
  }

  onMount(() => {
    requestAnimationFrame(() => (shown = true));
  });

  // Leaving while it hovers is fine: the server still lights it, and this device remembers it.
  onDestroy(() => {
    alive = false;
    stopWatching?.();
    clearTimeout(windTimer);
  });
</script>

{#snippet arrow()}
  <!-- A little hand-drawn hook pointing up at the words, in the margin ink. -->
  <svg class="hook" viewBox="0 0 14 14" width="13" height="13" aria-hidden="true">
    <path d="M3 2c-.6 4 .4 7.4 4.2 8.6M6.4 7.8l1.1 2.9-2.9 1.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
{/snippet}

<main class="consent" class:shown class:leaving class:up>
  <header class="masthead">
    <Wordmark />
  </header>

  <div class="swing" class:still={locked}>
    <div
      class="hang"
      class:lighting={phase === 'lighting'}
      class:hovering={phase === 'hovering'}
      class:rising={phase === 'rising'}
      class:aloft
    >
      <span class="thread" aria-hidden="true"></span>
      <div class="lamp" aria-hidden="true">
        <span class="halo"></span>
        <span class="paper" class:painted>
          <Lantern tone="honey" size={64} />
        </span>
        {#if painted}
          <span class="paper" in:fade={{ duration: 1400 }} out:fade={{ duration: 400 }}>
            <Lantern {...painted} size={64} />
          </span>
        {/if}
      </div>
    </div>

    <!-- The tag, and in its place once it's gone, the lantern's last words: one cell, held. -->
    <div class="stage">
      <section class="tag" class:away={phase === 'hovering' || phase === 'rising'} aria-labelledby="tag-title">
        <span class="tie" aria-hidden="true"></span>
        <span class="hole" aria-hidden="true"></span>
        <h1 id="tag-title">This is all that leaves your device.</h1>

        <div class="field">
          <span class="label" id="feeling-label">feeling</span>
          <div class="feelings" role="radiogroup" aria-labelledby="feeling-label">
            {#each FEELINGS as f (f)}
              <button
                type="button"
                role="radio"
                aria-checked={feeling === f}
                class:on={feeling === f}
                disabled={locked}
                onclick={() => choose(f)}
              >
                {f}
              </button>
            {/each}
          </div>
        </div>

        <div class="field">
          <label class="label" for="essence">the words</label>
          <div class="write words" class:own>
            <div class="backdrop" aria-hidden="true">{#each essenceMarks as s, i (i)}{#if s.mark}<mark>{s.text}</mark>{:else}{s.text}{/if}{/each}&#8203;</div>
            <textarea
              id="essence"
              rows="1"
              bind:value={essence}
              oninput={edited}
              readonly={locked}
              maxlength="140"
              placeholder={own ? 'what would your lantern say?' : ''}
              aria-describedby="essence-nudge"
              spellcheck="false"
              autocomplete="off"
              data-gramm="false"
              data-enable-grammarly="false"
            ></textarea>
          </div>
          {#if own}
            <div class="dots" role="img" aria-label="{wordCount} of {MAX_WORDS} words">
              {#each { length: MAX_WORDS } as _, i (i)}
                <span class:filled={i < wordCount}></span>
              {/each}
              {#if wordCount > MAX_WORDS}<span class="over">a little shorter?</span>{/if}
            </div>
          {/if}
          <p class="nudge" id="essence-nudge" class:shown={!!essenceProblem}>
            {#if essenceProblem}{@render arrow()}{nudge(essenceProblem.kind)}{/if}
          </p>
        </div>

        <div class="field">
          <label class="label" for="motif">the object</label>
          <div class="write object">
            <div class="backdrop" aria-hidden="true">{#each motifMarks as s, i (i)}{#if s.mark}<mark>{s.text}</mark>{:else}{s.text}{/if}{/each}&#8203;</div>
            <textarea
              id="motif"
              rows="1"
              bind:value={motif}
              oninput={edited}
              readonly={locked}
              maxlength="60"
              placeholder="one small thing: a shawl, a door, a song"
              aria-describedby="motif-nudge"
              spellcheck="false"
              autocomplete="off"
              data-gramm="false"
              data-enable-grammarly="false"
            ></textarea>
          </div>
          <p class="nudge" id="motif-nudge" class:shown={!!motifProblem}>
            {#if motifProblem}{@render arrow()}{nudge(motifProblem.kind)}{/if}
          </p>
        </div>
      </section>

      <div class="after">
        <div class="moment" class:shown={phase === 'hovering' && !windy} inert={!(phase === 'hovering' && !windy)}>
          <p class="hand" aria-live="polite">{phase === 'hovering' && !windy ? 'the sky is making room' : ''}</p>
        </div>

        <div class="moment" class:shown={phase === 'hovering' && windy} inert={!(phase === 'hovering' && windy)}>
          <p class="hand" aria-live="polite">{phase === 'hovering' && windy ? 'waiting for the wind' : ''}</p>
          <p class="kind">
            it's kept safe on this device, and it will rise on its own once the sky can be reached, now or the next
            time you visit.
          </p>
          <button class="soft-button" type="button" onclick={onback}>back to my letter</button>
        </div>

        <div class="moment" class:shown={risen} inert={!risen}>
          <p class="hand" aria-live="polite">{risen ? risenLine : ''}</p>
          <div class="buttons">
            {#if onsky && risenId}
              <button class="soft-button primary" type="button" onclick={() => risenId && onsky(risenId)}>
                find it in the sky
              </button>
            {/if}
            <button class="soft-button" type="button" onclick={onback}>back to my letter</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- One cell, several moments: the space is held so nothing below the tag ever moves. -->
  <div class="below">
    <div class="moment" class:shown={atTag} inert={!atTag}>
      {#if phase === 'held'}
        <p class="kind">
          the sky has a few gentle rules, and these words don't quite fit them. you can change them, or keep this
          lantern for yourself.
        </p>
      {:else if phase === 'still'}
        <p class="kind">
          the lantern couldn't reach the sky just now. nothing was shared, and your letter is safe here. try again
          whenever you like.
        </p>
      {:else}
        <p class="privacy">
          Your letter stays on this device. In the shared sky, anyone can read these words, but no one can see
          they're yours.
        </p>
      {/if}
      <div class="buttons">
        <button class="soft-button primary" type="button" disabled={!ready} onclick={light}>light my lantern</button>
        <button class="soft-button" type="button" onclick={onkeep}>keep it to myself</button>
      </div>
    </div>

    <div class="moment" class:shown={phase === 'lighting'} inert={phase !== 'lighting'}>
      <p class="hand" aria-live="polite">{phase === 'lighting' ? 'lighting your lantern' : ''}</p>
    </div>
  </div>
</main>

<style>
  .consent {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100dvh;
    /* Like the writing page: the buttons rest just above the rooftops, on the first screen. */
    padding: 0 16px calc(var(--horizon-h) * 0.6 + env(safe-area-inset-bottom));
    overflow-x: clip;
    opacity: 0;
    transition:
      opacity var(--t-panel) var(--ease-out),
      translate 0.7s var(--ease-out);
  }

  .consent.shown {
    opacity: 1;
  }

  .consent.leaving {
    opacity: 0;
    pointer-events: none;
  }

  .consent.leaving.up {
    translate: 0 -28px;
  }

  @media (prefers-reduced-motion: reduce) {
    .consent.leaving.up {
      translate: none;
    }
  }

  /* The wordmark sits in the corner; the lantern hangs from the top of the sky beside it. */
  .masthead {
    position: absolute;
    top: 0;
    left: 50%;
    display: flex;
    align-items: center;
    width: min(100% - 32px, var(--sheet-w));
    height: 68px;
    padding: 4px 4px 0;
    translate: -50% 0;
  }

  /* The lantern and its tag sway together, very gently, from the thread's top. */
  .swing {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 560px;
    transform-origin: 50% -40px;
    animation: sway 9s ease-in-out infinite alternate;
  }

  .swing.still {
    animation-play-state: paused;
  }

  @keyframes sway {
    from {
      rotate: -0.6deg;
    }
    to {
      rotate: 0.6deg;
    }
  }

  .hang {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    transform: translateY(-14px);
    opacity: 0;
    transition:
      transform 1.2s var(--ease-out),
      opacity 0.9s var(--ease-out);
  }

  .consent.shown .hang {
    transform: none;
    opacity: 1;
  }

  .thread {
    display: block;
    width: 1px;
    height: 44px;
    background: linear-gradient(to bottom, transparent, oklch(0.75 0.05 70 / 0.5));
    transition: opacity 0.8s var(--ease-out);
  }

  .lamp {
    position: relative;
    display: grid;
    place-items: center;
  }

  /* The plain lantern and its painted self share one cell, so one can soften into the other. */
  .paper {
    grid-area: 1 / 1;
    transition: opacity 1.4s var(--ease-out);
  }

  .paper.painted {
    opacity: 0;
  }

  .halo {
    position: absolute;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--lantern-glow), transparent 68%);
    opacity: 0.55;
    animation: breathe 3.4s ease-in-out infinite alternate;
    transition:
      opacity 1.2s var(--ease-out),
      scale 1.2s var(--ease-out);
    pointer-events: none;
  }

  @keyframes breathe {
    from {
      transform: scale(1);
    }
    to {
      transform: scale(1.06);
    }
  }

  .hang.lighting .halo,
  .hang.hovering .halo,
  .hang.rising .halo {
    opacity: 1;
    scale: 1.3;
  }

  /* While the sky decides, the lantern lets go of its thread and floats a little above it. */
  .consent.shown .hang.hovering {
    transform: translateY(-38px);
    transition: transform 2.4s cubic-bezier(0.3, 0, 0.2, 1);
  }

  /* Then it rises out of sight, picking up from wherever the hover left it. */
  .consent.shown .hang.rising {
    transform: translateY(-110vh);
    transition: transform 6.5s cubic-bezier(0.45, 0, 0.25, 1);
  }

  .hang.hovering .thread,
  .hang.rising .thread {
    opacity: 0;
  }

  /*
    A slow bob once it's aloft. Its height eases in and out through --lift, so if the lantern is
    held and settles back onto its thread, the bob fades away instead of snapping off.
  */
  @property --lift {
    syntax: '<length>';
    inherits: false;
    initial-value: 0px;
  }

  .lamp {
    transition: --lift 1.4s var(--ease-out);
  }

  .hang.aloft .lamp {
    animation: bob 3.2s ease-in-out infinite alternate;
  }

  .hang.hovering .lamp,
  .hang.rising .lamp {
    --lift: -6px;
  }

  @keyframes bob {
    from {
      translate: 0 0;
    }
    to {
      translate: 0 var(--lift);
    }
  }

  .stage {
    display: grid;
    width: 100%;
    margin-top: 12px;
  }

  .stage > * {
    grid-area: 1 / 1;
  }

  /* Where the tag was: the lantern's last words, over the sky. Clicks pass through to the tag. */
  .after {
    display: grid;
    align-content: center;
    justify-items: center;
    pointer-events: none;
  }

  .after .moment.shown {
    pointer-events: auto;
  }

  .tag {
    position: relative;
    width: 100%;
    padding: 40px 40px 22px;
    border-radius: 18px;
    background-color: var(--paper);
    background-image: var(--grain, none), linear-gradient(172deg, var(--paper) 55%, var(--paper-shade));
    color: var(--ink);
    rotate: 0.5deg;
    box-shadow:
      inset 0 0 50px var(--paper-edge),
      inset 0 1px 0 var(--paper-light),
      0 1px 2px oklch(0.1 0.03 275 / 0.3),
      0 14px 30px -10px oklch(0.08 0.04 275 / 0.55),
      0 40px 80px -24px oklch(0.06 0.04 275 / 0.6);
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity 0.9s var(--ease-out) 0.25s,
      transform 1.1s var(--ease-out) 0.25s;
  }

  .consent.shown .tag {
    opacity: 1;
    transform: none;
  }

  .consent.shown .tag.away {
    opacity: 0;
    transform: translateY(16px);
    transition-delay: 0s;
  }

  /* The thread from the lantern to the hole in the tag. */
  .tie {
    position: absolute;
    top: -22px;
    left: 50%;
    width: 1px;
    height: 40px;
    background: oklch(0.75 0.05 70 / 0.55);
  }

  .hole {
    position: absolute;
    top: 14px;
    left: calc(50% - 6px);
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--sky-top);
    box-shadow:
      inset 0 1px 2px oklch(0 0 0 / 0.5),
      0 0 0 3px oklch(0.88 0.03 80);
  }

  h1 {
    margin: 0 0 18px;
    font-family: var(--font-letter);
    font-size: 1.375rem;
    font-weight: 450;
    text-align: center;
    text-wrap: balance;
  }

  .field + .field {
    margin-top: 10px;
  }

  .label {
    display: block;
    margin-bottom: 8px;
    color: var(--ink-faded);
    font-family: var(--font-ui);
    font-size: 0.82rem;
    letter-spacing: 0.04em;
  }

  .feelings {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 8px;
    margin-bottom: 14px;
  }

  .feelings button {
    padding: 4px 12px;
    border: 1px solid oklch(0.6 0.04 70 / 0.25);
    border-radius: 999px;
    background: transparent;
    color: var(--ink-faded);
    font-family: var(--font-letter);
    font-size: 0.95rem;
    font-style: italic;
    cursor: pointer;
    transition:
      background-color var(--t-ui) var(--ease-out),
      color var(--t-ui) var(--ease-out),
      border-color var(--t-ui) var(--ease-out),
      transform var(--t-ui) var(--ease-out);
  }

  .feelings button:hover:not(:disabled) {
    border-color: oklch(0.6 0.08 60 / 0.5);
    color: var(--ink);
  }

  .feelings button:active:not(:disabled) {
    transform: scale(0.95);
    transition-duration: var(--t-press);
  }

  .feelings button.on {
    border-color: oklch(0.7 0.12 62 / 0.7);
    background: oklch(0.86 0.09 72 / 0.45);
    color: var(--ink);
  }

  .feelings button:disabled {
    cursor: default;
  }

  /* An editable line with a twin underneath that draws the soft underlines in the same place. */
  .write {
    display: grid;
  }

  .write > * {
    grid-area: 1 / 1;
    margin: 0;
    padding: 2px 0;
    border: 0;
    font-family: var(--font-letter);
    font-style: italic;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  .words > * {
    font-size: 1.5rem;
    line-height: 1.45;
  }

  .object > * {
    font-size: 1.125rem;
    line-height: 1.5;
  }

  .backdrop {
    color: transparent;
  }

  .backdrop mark {
    color: transparent;
    background: linear-gradient(transparent 80%, var(--leak-mark) 80%, var(--leak-mark) 92%, transparent 92%);
    border-radius: 2px;
  }

  /* Words the writer types themselves: two lines held from the start (15 words fit), so the
     card never grows under their hand on the way to "light my lantern". */
  .write.own .backdrop {
    min-height: calc(2lh + 4px);
  }

  .write textarea {
    width: 100%;
    height: 100%;
    background: transparent;
    color: var(--ink);
    caret-color: var(--hand);
    resize: none;
    overflow: hidden;
    border-bottom: 1px dashed transparent;
    transition: border-color var(--t-ui) var(--ease-out);
  }

  .write textarea:hover:not([readonly]),
  .write textarea:focus {
    border-bottom-color: var(--paper-rule);
  }

  .write textarea:focus-visible {
    outline: none;
  }

  .write textarea::placeholder {
    color: var(--ink-faded);
    opacity: 0.8;
  }

  .dots {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 8px;
  }

  .dots span:not(.over) {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: oklch(0.6 0.04 70 / 0.22);
    transition: background-color 0.4s var(--ease-out);
  }

  .dots span.filled {
    background: var(--ink-glow);
  }

  .dots .over {
    margin-left: 8px;
    color: var(--hand);
    font-family: var(--font-hand);
    font-size: 0.85rem;
  }

  /* The leak check's note, written by hand in the margin of the tag. Its line is always held. */
  .nudge {
    min-height: 1.6em;
    margin: 6px 0 4px;
    padding-left: 18px;
    color: var(--hand);
    font-family: var(--font-hand);
    font-size: 0.92rem;
    line-height: 1.5;
    opacity: 0;
    transform: translateY(-3px);
    transition:
      opacity 0.5s var(--ease-out),
      transform 0.5s var(--ease-out);
  }

  .nudge.shown {
    opacity: 1;
    transform: none;
  }

  .hook {
    margin-left: -18px;
    margin-right: 5px;
    vertical-align: -1px;
  }

  /* One cell for every moment under the tag; it is as tall as the tallest, so nothing jumps. */
  .below {
    display: grid;
    justify-items: center;
    width: 100%;
    max-width: 600px;
    margin-top: 14px;
  }

  .moment {
    grid-area: 1 / 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    opacity: 0;
    transition: opacity 0.7s var(--ease-out);
  }

  .moment.shown {
    opacity: 1;
    transition-delay: 0.2s;
  }

  .privacy,
  .kind {
    max-width: 62ch;
    margin: 0;
    color: var(--ui-soft);
    font-size: 0.95rem;
    line-height: 1.6;
    text-align: center;
    text-wrap: pretty;
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

  .hand + .kind {
    margin-top: -10px;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
  }

  @media (max-width: 600px) {
    /* Too narrow to share the top: the wordmark gets its own row, the lantern hangs below it. */
    .masthead {
      position: static;
      width: 100%;
      height: 60px;
      translate: none;
    }

    .tag {
      padding: 38px 22px 20px;
    }

    .words > * {
      font-size: 1.3rem;
    }

    .nudge {
      min-height: 3em;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .swing,
    .halo,
    .hang.aloft .lamp {
      animation: none;
    }

    .hang,
    .consent.shown .hang,
    .consent.shown .hang.hovering,
    .tag,
    .consent.shown .tag.away {
      transform: none;
    }

    /* No flight: the lantern simply fades into the sky. */
    .consent.shown .hang.rising {
      transform: none;
      opacity: 0;
      transition: opacity 1.2s var(--ease-out);
    }
  }
</style>
