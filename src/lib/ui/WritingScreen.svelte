<!--
  The writing screen (DESIGN.md §4.1–4.2, design/directions.md §2 decision): one tall sheet of
  paper, the letter in a book serif, a reserved margin where the helper writes back, and the
  candle in the corner.

  Work ahead (PREP.md D28): every pause hands the letter to `engine.preload()`. The page only
  ever reads `engine.progress` (step status, never text) to show its cues:
    - the flame leans toward the letter while the helper reads in the background,
    - nib dots sit in the margin while a note is being written,
    - a folded note appears when one is waiting. It never opens by itself: the writer opens it,
      or says they're done, so a note never interrupts a sentence.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { riskHit } from '../engine/riskcheck';
  import type { OnDeviceEngine } from '../engine/types';
  import Candle from './Candle.svelte';
  import Lantern from './Lantern.svelte';
  import MarginNote from './MarginNote.svelte';
  import { Pacer } from './pacer';

  let {
    engine,
    letter = $bindable(''),
    entered = true,
    ondone,
  }: {
    engine: OnDeviceEngine;
    letter?: string;
    /** False until fonts and the saved draft are in, so the page never reflows on arrival. */
    entered?: boolean;
    /** The next step (choose: keep, burn or release). Not built yet. */
    ondone?: (letter: string) => void;
  } = $props();

  // The engine never changes for the life of this component (the app remounts it on a swap).
  // svelte-ignore state_referenced_locally
  const { readiness, progress } = engine;

  /** How long the writer must stop typing before it counts as a pause. */
  const PAUSE_MS = 1400;
  const HAND_FONT = '400 16px "Shantell Sans Variable"';

  let field: HTMLTextAreaElement;
  let pauseTimer: ReturnType<typeof setTimeout> | undefined;
  let typing = $state(false);
  /** The newest text handed to the engine; `$progress` describes this text. */
  let preparedFor = $state('');

  let noteFor = $state<string | null>(null);
  let words = $state<string[]>([]);
  let waitingForWords = $state(false);
  let inkRanDry = $state(false);
  let stallDismissed = $state(false);
  let pacer: Pacer | undefined;

  let careFor = $state<string | null>(null);
  let careClosed = $state(false);

  const modelState = $derived($readiness.state);
  const canWorkAhead = $derived(modelState === 'ready' || modelState === 'slow');
  const hasWords = $derived(letter.trim().length > 0);
  /** The engine's progress is about exactly what's on the page. */
  const progressIsCurrent = $derived(hasWords && letter === preparedFor);
  const noteIsCurrent = $derived(noteFor !== null && noteFor === letter);
  const care = $derived(careFor !== null && !careClosed);

  const cue = $derived.by(() => {
    if (waitingForWords) return 'writing';
    if (!progressIsCurrent || noteIsCurrent) return 'none';
    if ($progress.reflection === 'done') return 'waiting';
    if ($progress.reflection === 'running') return 'writing';
    return 'none';
  });

  const reading = $derived(
    waitingForWords || (progressIsCurrent && Object.values($progress).some((s) => s === 'running')),
  );
  const stalled = $derived(waitingForWords && modelState === 'stalled' && !stallDismissed);
  const canFinish = $derived(
    hasWords && (!!ondone || (modelState !== 'unavailable' && !care && !noteIsCurrent && !waitingForWords)),
  );

  function onInput() {
    typing = true;
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(paused, PAUSE_MS);
  }

  function paused() {
    clearTimeout(pauseTimer);
    typing = false;
    const text = letter;
    if (!text.trim()) return;
    // The deterministic part of the safety check needs no model (D19), so it runs everywhere.
    if (riskHit(text)) showCare(text, false);
    if (!canWorkAhead || text === preparedFor) return;
    preparedFor = text;
    engine.preload(text);
  }

  /** `insist`: the writer just asked for their note, so the care card shows even if closed before. */
  function showCare(text: string, insist: boolean) {
    if (careClosed && !insist) return;
    careFor = text;
    careClosed = false;
  }

  /** The care card belongs to the letter that raised it. A clean check of new text retires it. */
  function clearCare(text: string) {
    if (careFor === null || careFor === text) return;
    careFor = null;
    careClosed = false;
  }

  // The model became ready while the writer was resting: start working ahead now.
  $effect(() => {
    if (canWorkAhead) untrack(() => !typing && paused());
  });

  // The model's own safety check finished for this text (the code check ran on the pause).
  $effect(() => {
    if (!progressIsCurrent || $progress.safety !== 'done') return;
    const text = letter;
    void engine.checkSafety(text).then((r) => {
      if (letter !== text) return;
      if (r.risk) showCare(text, false);
      else if (r.modelChecked) clearCare(text);
    });
  });

  async function finish() {
    engine.warmUp();
    const text = letter;
    if (!text.trim()) return;
    paused();
    if (modelState === 'unavailable') {
      if (riskHit(text)) showCare(text, true);
      ondone?.(text);
      return;
    }
    waitingForWords = true;
    inkRanDry = false;
    stallDismissed = false;
    const safety = await engine.checkSafety(text);
    if (safety.risk) {
      waitingForWords = false;
      showCare(text, true);
      return;
    }
    clearCare(text);
    await openNote(text);
    ondone?.(text);
  }

  async function openNote(text: string) {
    pacer?.stop();
    noteFor = text;
    words = [];
    waitingForWords = true;
    inkRanDry = false;
    stallDismissed = false;
    // The margin face loads lazily; make sure it's here before the first word is written.
    await Promise.race([document.fonts.load(HAND_FONT), new Promise((r) => setTimeout(r, 1500))]);

    const p = new Pacer({
      msPerWord: () => (modelState === 'slow' ? 230 : 135),
      onWord: (word) => {
        waitingForWords = false;
        words.push(word);
      },
      onDone: () => {
        if (pacer === p && words.length === 0) dryInk();
      },
    });
    pacer = p;
    try {
      await engine.reflect(text, (delta) => p.push(delta));
      p.end();
    } catch {
      if (pacer !== p) return;
      p.stop();
      if (words.length === 0) dryInk();
      else waitingForWords = false;
    }
  }

  function dryInk() {
    waitingForWords = false;
    inkRanDry = true;
    noteFor = null;
  }

  onMount(() => {
    // Chrome only downloads or loads the model inside a user gesture: the first one will do.
    const warm = () => engine.warmUp();
    window.addEventListener('pointerdown', warm, { once: true });
    window.addEventListener('keydown', warm, { once: true });

    // `field-sizing: content` grows the sheet with the letter; older engines get a fallback.
    const grow = () => {
      field.style.height = 'auto';
      field.style.height = `${field.scrollHeight}px`;
    };
    const needsFallback = !CSS.supports('field-sizing', 'content');
    if (needsFallback) {
      field.addEventListener('input', grow);
      grow();
    }

    return () => {
      clearTimeout(pauseTimer);
      pacer?.stop();
      window.removeEventListener('pointerdown', warm);
      window.removeEventListener('keydown', warm);
      if (needsFallback) field.removeEventListener('input', grow);
    };
  });
</script>

<main class="page" class:entered>
  <header class="masthead">
    <span class="wordmark"><Lantern tone="honey" size={17} />dear sky</span>
  </header>

  <article class="sheet" class:entered data-state={modelState}>
    <div class="paper" aria-hidden="true">
      <span class="creases"></span>
      <span class="ear"><span></span></span>
    </div>

    <div class="letter">
      <label class="visually-hidden" for="letter">your letter</label>
      <!-- Spellcheck is off on purpose: Chrome's enhanced spell check sends text to Google,
           and grammar extensions read the page. The letter must stay on this device. -->
      <textarea
        id="letter"
        bind:this={field}
        bind:value={letter}
        oninput={onInput}
        onblur={() => typing && paused()}
        placeholder="who are you writing to tonight?"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="sentences"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
      ></textarea>
    </div>

    <aside class="margin" aria-label="the margin">
      <svg class="squiggle" viewBox="0 0 120 12" aria-hidden="true">
        <path
          d="M2 6c6-5 10 5 16 0s10 5 16 0 10 5 16 0 10 5 16 0 10 5 16 0 10 5 16 0 10 5 16 0"
          fill="none"
          stroke="var(--hand-faint)"
          stroke-width="1.4"
          stroke-linecap="round"
        />
      </svg>
      <MarginNote
        {words}
        stale={noteFor !== null && !noteIsCurrent}
        {cue}
        {care}
        {stalled}
        {inkRanDry}
        onopen={() => openNote(letter)}
        onkeepwaiting={() => (stallDismissed = true)}
        onretry={finish}
        oncareclose={() => (careClosed = true)}
      />
    </aside>

    <div class="corner">
      <Candle readiness={$readiness} lean={reading} />
    </div>
  </article>

  <div class="actions">
    <button class="done" class:shown={canFinish} type="button" inert={!canFinish} onclick={finish}>
      i'm done for now
    </button>
  </div>
</main>

<style>
  .page {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100dvh;
    padding: 0 16px calc(var(--horizon-h) * 0.62 + env(safe-area-inset-bottom));
    /* The candle's glow may spill past the paper, never past the screen. */
    overflow-x: clip;
  }

  .masthead {
    width: 100%;
    max-width: var(--sheet-w);
    padding: 26px 4px 24px;
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
  }

  .sheet {
    position: relative;
    width: 100%;
    max-width: var(--sheet-w);
    /* Tall enough for a whole margin note, short enough that "done" fits on a laptop screen. */
    min-height: max(600px, calc(100dvh - 190px));
    display: grid;
    grid-template-columns: minmax(0, 1fr) 184px;
    column-gap: 44px;
    padding: 72px 40px 132px 64px;
    opacity: 0;
    transform: translateY(14px);
    transition:
      opacity 0.9s var(--ease-out),
      transform 1.2s var(--ease-out);
  }

  .sheet.entered {
    opacity: 1;
    transform: none;
  }

  /* The paper is its own layer, tilted a touch; the text above it stays perfectly level,
     so the caret and the letters stay crisp. */
  .paper {
    /* The dog-eared corner: how far the fold runs along each edge. */
    --ear: 38px;
    position: absolute;
    inset: 0;
    border-radius: 20px;
    /* The top-right corner is folded over, so it is cut away along the fold line. The
       polygon reaches far past the sheet so the outer shadows survive the clip. */
    clip-path: polygon(
      -200px -200px,
      calc(100% - var(--ear) - 200px) -200px,
      calc(100% + 200px) calc(var(--ear) + 200px),
      calc(100% + 200px) calc(100% + 200px),
      -200px calc(100% + 200px)
    );
    background-color: var(--paper);
    background-image: var(--grain, none), linear-gradient(172deg, var(--paper) 55%, var(--paper-shade));
    rotate: -0.4deg;
    box-shadow:
      inset 0 0 70px var(--paper-edge),
      inset 0 1px 0 var(--paper-light),
      0 1px 2px oklch(0.1 0.03 275 / 0.3),
      0 14px 30px -10px oklch(0.08 0.04 275 / 0.55),
      0 46px 90px -24px oklch(0.06 0.04 275 / 0.6);
  }

  /* Focus: a warm halo instead of a ring. */
  .paper::before,
  .paper::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    opacity: 0;
    pointer-events: none;
    transition: opacity 1.4s var(--ease-out);
  }

  .paper::before {
    box-shadow:
      0 0 0 1px oklch(0.85 0.1 75 / 0.35),
      0 0 52px 2px oklch(0.8 0.12 70 / 0.14);
    transition-duration: 0.45s;
  }

  .sheet:focus-within .paper::before {
    opacity: 1;
  }

  /* The candle's warmth on the page corner. */
  .paper::after {
    background: radial-gradient(55% 40% at 100% 100%, var(--candle-glow), transparent 75%);
  }

  [data-state='warming'] .paper::after {
    opacity: 0.25;
  }
  [data-state='ready'] .paper::after {
    opacity: 1;
  }
  [data-state='slow'] .paper::after {
    opacity: 0.6;
  }
  [data-state='stalled'] .paper::after {
    opacity: 0.4;
  }

  /* Folded in thirds once, to fit an envelope, then smoothed flat again: each crease is a
     faint valley with a thin catch of light along its ridge. */
  .creases {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background:
      linear-gradient(
        to bottom,
        transparent calc(33.3% - 22px),
        var(--paper-crease) calc(33.3% - 1px),
        var(--paper-light) 33.3%,
        transparent calc(33.3% + 12px)
      ),
      linear-gradient(
        to bottom,
        transparent calc(66.6% - 12px),
        var(--paper-light) 66.6%,
        var(--paper-crease) calc(66.6% + 1px),
        transparent calc(66.6% + 22px)
      );
  }

  /* The turned-down corner: the back of the paper, lying on the front, casting a soft shadow. */
  .ear {
    position: absolute;
    top: 0;
    right: 0;
    width: var(--ear);
    height: var(--ear);
    filter: drop-shadow(-2px 3px 3px oklch(0.35 0.05 60 / 0.22));
    pointer-events: none;
  }

  .ear > span {
    position: absolute;
    inset: 0;
    border-bottom-left-radius: 7px;
    background: linear-gradient(to bottom left, var(--paper-fold) 30%, var(--paper-shade));
    clip-path: polygon(0 0, 100% 100%, 0 100%);
  }

  .letter,
  .margin,
  .corner {
    position: relative;
  }

  textarea {
    display: block;
    width: 100%;
    min-height: calc(1.8em * 14);
    padding: 0;
    border: 0;
    background: transparent;
    resize: none;
    overflow: hidden;
    field-sizing: content;
    font-family: var(--font-letter);
    font-size: 1.1875rem;
    line-height: 1.8;
    color: var(--ink);
    caret-color: var(--hand);
  }

  textarea:focus,
  textarea:focus-visible {
    outline: none;
  }

  textarea::placeholder {
    color: var(--ink-faded);
    opacity: 1;
  }

  .margin {
    padding-top: 0.3rem;
  }

  /* The ruled margin line, fading out at both ends. */
  .margin::before {
    content: '';
    position: absolute;
    top: -30px;
    bottom: -60px;
    left: -24px;
    width: 1px;
    background: linear-gradient(to bottom, transparent, var(--paper-rule) 10%, var(--paper-rule) 85%, transparent);
  }

  .squiggle {
    display: none;
  }

  .corner {
    position: absolute;
    right: 24px;
    bottom: 20px;
  }

  /* Arrival: the paper settles first, then the margin line and the candle come in. */
  .masthead,
  .corner,
  .margin::before {
    opacity: 0;
    transition: opacity 1.2s var(--ease-out);
  }

  .page.entered .masthead {
    opacity: 1;
  }

  .sheet.entered .margin::before {
    opacity: 1;
    transition-delay: 0.5s;
  }

  .sheet.entered .corner {
    opacity: 1;
    transition-delay: 0.9s;
  }

  .actions {
    margin-top: 30px;
  }

  .done {
    position: relative;
    padding: 12px 28px;
    border: 1px solid var(--ui-line);
    border-radius: 999px;
    background: var(--button-bg);
    color: var(--ui);
    font-family: var(--font-ui);
    font-size: 0.975rem;
    letter-spacing: 0.01em;
    cursor: pointer;
    opacity: 0;
    transform: translateY(6px);
    transition:
      opacity 0.6s var(--ease-out),
      transform 0.6s var(--ease-out);
  }

  .done::after {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    box-shadow: 0 0 24px 2px oklch(0.8 0.13 70 / 0.22);
    opacity: 0;
    transition: opacity var(--t-ui) var(--ease-out);
  }

  .done:hover::after,
  .done:focus-visible::after {
    opacity: 1;
  }

  .done.shown {
    opacity: 1;
    transform: none;
  }

  .done.shown:active {
    transform: scale(0.96);
    transition-duration: var(--t-press);
  }

  /* Phones: the margin moves under the letter, after a pencil squiggle, with its height held. */
  @media (max-width: 760px) {
    .masthead {
      padding: 20px 4px 18px;
    }

    .sheet {
      grid-template-columns: minmax(0, 1fr);
      min-height: 0;
      padding: 40px 24px 100px;
    }

    .paper {
      --ear: 28px;
    }

    textarea {
      min-height: calc(1.75em * 10);
      font-size: 1.125rem;
      line-height: 1.75;
    }

    .margin {
      min-height: 15rem;
      margin-top: 22px;
      padding-top: 0;
    }

    .margin::before {
      display: none;
    }

    .squiggle {
      display: block;
      width: 92px;
      height: 10px;
      margin-bottom: 14px;
    }

    .corner {
      right: 14px;
      bottom: 14px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet {
      transform: none;
    }
  }
</style>
