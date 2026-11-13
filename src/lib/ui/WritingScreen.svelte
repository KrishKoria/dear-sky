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

  When the writer is done and the note is written, the choices appear under the sheet (DESIGN.md
  §4.3). Releasing condenses the letter right here on the paper (§4.5): the words fade in place,
  a few glow and drift up, and the lantern's line appears below. Then `onrelease` hands over.
-->
<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { riskHit } from '../engine/riskcheck';
  import type { Essence, OnDeviceEngine, SafetyResult } from '../engine/types';
  import { releaseLanguage } from '../privacy/language';
  import Burn, { BURN_MS, CALM_BURN_MS } from './Burn.svelte';
  import Candle from './Candle.svelte';
  import Lantern from './Lantern.svelte';
  import MarginNote from './MarginNote.svelte';
  import { Pacer } from './pacer';

  let {
    engine,
    letter = $bindable(''),
    entered = true,
    onrelease,
    onburn,
    onsky,
  }: {
    engine: OnDeviceEngine;
    letter?: string;
    /** False until fonts and the saved draft are in, so the page never reflows on arrival. */
    entered?: boolean;
    /** The writer chose to release. `essence` is null when they'll write the lantern's words themselves. */
    onrelease?: (letter: string, essence: Essence | null) => void;
    /** The writer chose to burn the letter: delete it from this device's storage now. */
    onburn?: () => void;
    /** A quiet way up to the shared sky. The letter stays exactly where it is. */
    onsky?: () => void;
  } = $props();

  // The engine never changes for the life of this component (the app remounts it on a swap).
  // svelte-ignore state_referenced_locally
  const { readiness, progress } = engine;

  /** How long the writer must stop typing before it counts as a pause. */
  const PAUSE_MS = 1400;
  /**
   * How long a writer waits for the first word of their note before they're offered a way on
   * (DESIGN.md §4b "stalled"). Whatever the reason: a stalled prompt, or a cold load or download
   * the queue is still waiting behind, which never reports a stall of its own.
   */
  const PATIENCE_MS = 20_000;
  const HAND_FONT = '400 16px "Shantell Sans Variable"';

  let field = $state<HTMLTextAreaElement>(null!);
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
  let waitedLong = $state(false);
  $effect(() => {
    if (!waitingForWords) return void (waitedLong = false);
    const id = setTimeout(() => (waitedLong = true), PATIENCE_MS);
    return () => clearTimeout(id);
  });
  const stalled = $derived(waitingForWords && (modelState === 'stalled' || waitedLong) && !stallDismissed);
  /** No model on this device yet: the note comes later, on its own, once the model arrives. */
  const noModelYet = $derived(modelState === 'unavailable' || modelState === 'downloading');

  /** The choices belong to exactly the text the writer finished; any edit brings "done" back. */
  let finishedFor = $state<string | null>(null);
  let keptFor = $state<string | null>(null);
  const finished = $derived(finishedFor !== null && finishedFor === letter);
  /** Release is never offered for a letter that raised the care card (D19), nor outside English (D26). */
  const flagged = $derived(careFor !== null && careFor === letter);
  const english = $derived(releaseLanguage(letter).ok);

  type Condensing = { phase: 'fading' | 'slow' | 'found'; essence?: Essence };
  let condensing = $state<Condensing | null>(null);
  /** Identifies the current release, so a late essence never lands on a newer one. */
  let releaseRun: object | undefined;

  /**
   * Burning (DESIGN.md §4.4): it can't be undone, so it asks once, kindly. Then the sheet burns,
   * a fresh one comes, and a quiet line stays until the writer starts again.
   */
  let burn = $state<'asking' | 'burning' | 'gone' | null>(null);
  /** The fresh sheet hasn't come in yet. */
  let sheetAway = $state(false);
  /** For one frame, nothing transitions: the burnt sheet must not fade back in before it leaves. */
  let instant = $state(false);
  let skipBurn: (() => void) | undefined;
  let notYet = $state<HTMLButtonElement>();
  let letGo = $state<HTMLButtonElement>();

  const actions = $derived(
    burn ?? (condensing ? 'condensing' : finished ? (keptFor === letter ? 'kept' : 'choose') : 'done'),
  );
  const canFinish = $derived(hasWords && !finished && !waitingForWords && !condensing);

  // `field-sizing: content` grows the sheet with the letter; older engines get a fallback.
  const growByHand = typeof CSS !== 'undefined' && !CSS.supports('field-sizing', 'content');
  function grow() {
    if (!growByHand || !field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }

  /** A new textarea after a burn: its undo history is the only thing that could bring words back. */
  let fieldKey = $state(0);

  function onInput() {
    grow();
    if (burn === 'gone') burn = null;
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
    // No model to wait for (a download takes minutes; its note arrives later as a folded note),
    // or the code check already decided: straight to the choices.
    const codeRisk = riskHit(text);
    if (noModelYet || codeRisk) {
      if (codeRisk) showCare(text, true);
      finishedFor = text;
      return;
    }
    // The writer already opened this note and it's written: straight to the choices.
    if (noteIsCurrent && words.length > 0 && !waitingForWords) {
      finishedFor = text;
      return;
    }
    waitingForWords = true;
    inkRanDry = false;
    stallDismissed = false;
    let safety: SafetyResult;
    try {
      safety = await engine.checkSafety(text);
    } catch {
      safety = { risk: false, modelChecked: false }; // the code check above already ran
    }
    if (safety.risk) {
      waitingForWords = false;
      showCare(text, true);
      if (letter === text) finishedFor = text;
      return;
    }
    clearCare(text);
    await openNote(text);
    // The choices wait until the last word of the note is written.
    if (letter === text) finishedFor = text;
  }

  function keep() {
    keptFor = letter;
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  async function askBurn() {
    burn = 'asking';
    await tick();
    // The safe answer has the focus, so a stray Enter never burns anything.
    notYet?.focus({ preventScroll: true });
  }

  async function cancelBurn() {
    burn = null;
    await tick();
    letGo?.focus({ preventScroll: true });
  }

  async function burnIt() {
    const quiet = calm();
    burn = 'burning';
    field.blur();
    clearTimeout(pauseTimer);
    pacer?.stop();
    settlePaced?.();
    // Gone from this device now, not when the flames finish: storage, and everything the
    // helper held or wrote about it.
    onburn?.();
    engine.forget();

    // A ritual moment: never skipped by accident, always on purpose (Escape).
    await new Promise<void>((done) => {
      const timer = setTimeout(done, quiet ? CALM_BURN_MS : BURN_MS);
      skipBurn = () => {
        clearTimeout(timer);
        done();
      };
    });
    skipBurn = undefined;

    // The sheet is ash. A fresh one comes, with nothing on it and nothing behind it.
    instant = true;
    sheetAway = true;
    letter = '';
    // Setting the value from code leaves the undo history in place, and undo would bring back
    // whatever was deleted while writing. A new element starts with none.
    fieldKey++;
    noteFor = null;
    words = [];
    waitingForWords = false;
    inkRanDry = false;
    stallDismissed = false;
    careFor = null;
    careClosed = false;
    finishedFor = null;
    keptFor = null;
    preparedFor = '';
    typing = false;
    burn = 'gone';
    await nextFrame();
    instant = false;
    await sleep(quiet ? 500 : 1300);
    sheetAway = false;
  }

  async function release() {
    const text = letter;
    if (noModelYet) return handOver(text, null);
    const run = {};
    releaseRun = run;
    field.blur();
    condensing = { phase: 'fading' };
    void pickGlowWords();

    // The essence was usually written ahead during the pauses (D28), so this is mostly ritual.
    const ritual = sleep(calm() ? 1200 : 2800);
    const slow = setTimeout(() => {
      if (releaseRun === run && condensing?.phase === 'fading') condensing = { phase: 'slow' };
    }, 9000);
    let essence: Essence | null = null;
    try {
      essence = await engine.condense(text);
    } catch {
      // The writer gets to write the lantern's words themselves instead (DESIGN.md §4b).
    }
    await ritual;
    clearTimeout(slow);
    if (releaseRun !== run) return;
    if (essence) {
      condensing = { phase: 'found', essence };
      await sleep(calm() ? 1400 : 2200);
      if (releaseRun !== run) return;
    }
    handOver(text, essence);
  }

  /** The writer would rather not wait: they write the lantern's words themselves. */
  function writeOwn() {
    handOver(letter, null);
  }

  function handOver(text: string, essence: Essence | null) {
    releaseRun = undefined;
    onrelease?.(text, essence);
    // The app has faded this screen out by then; the sheet is whole again for the way back.
    setTimeout(() => (condensing = null), 700);
  }

  /** The words that glow and drift up: a few plain words (never a name, D4) in view right now. */
  const STOP = new Set(
    'that this with have from your what when were just they them then there their about would could should been into because still always never really which while where after before every those these some like will only even also more much very'.split(' '),
  );
  let overlay = $state<HTMLDivElement>();
  let glowing = $state<Map<number, number>>(new Map());
  let condenseGo = $state(false);
  let condenseRise = $state(false);
  const tokens = $derived(condensing ? letter.split(/(\s+)/) : []);

  async function pickGlowWords() {
    glowing = new Map();
    condenseGo = false;
    condenseRise = false;
    await tick();
    if (!overlay) return;
    const view = window.innerHeight;
    const candidates = [...overlay.querySelectorAll<HTMLElement>('[data-i]')].filter((el) => {
      const word = el.textContent?.replace(/[^\p{L}']/gu, '') ?? '';
      if (word.length < 4 || /^\p{Lu}/u.test(word) || STOP.has(word.toLowerCase())) return false;
      const r = el.getBoundingClientRect();
      return r.top > 40 && r.bottom < view - 40;
    });
    const count = Math.min(5, candidates.length);
    const picked = new Map<number, number>();
    for (let k = 0; k < count; k++) {
      const el = candidates[Math.floor(((k + 0.5) * candidates.length) / count)];
      picked.set(Number(el.dataset.i), k);
    }
    glowing = picked;
    requestAnimationFrame(() => {
      condenseGo = true;
      setTimeout(() => (condenseRise = true), calm() ? 0 : 1500);
    });
  }

  let settlePaced: (() => void) | undefined;

  async function openNote(text: string) {
    pacer?.stop();
    settlePaced?.();
    let resolvePaced!: () => void;
    const paced = new Promise<void>((r) => (resolvePaced = r));
    settlePaced = resolvePaced;
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
        resolvePaced();
      },
    });
    pacer = p;
    try {
      await engine.reflect(text, (delta) => p.push(delta));
      p.end();
    } catch {
      if (pacer === p) {
        p.stop();
        if (words.length === 0) dryInk();
        else waitingForWords = false;
      }
      resolvePaced();
    }
    await paced;
  }

  function dryInk() {
    waitingForWords = false;
    inkRanDry = true;
    noteFor = null;
  }

  onMount(() => {
    // Chrome only downloads or loads the model inside a user gesture. Every gesture offers one:
    // after an idle unload, the writer's next keystroke loads it again (a no-op while warm).
    const warm = () => engine.warmUp();
    window.addEventListener('pointerdown', warm);
    window.addEventListener('keydown', warm);
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (burn === 'asking') void cancelBurn();
      else skipBurn?.();
    };
    window.addEventListener('keydown', escape);

    grow();

    return () => {
      clearTimeout(pauseTimer);
      pacer?.stop();
      window.removeEventListener('pointerdown', warm);
      window.removeEventListener('keydown', warm);
      window.removeEventListener('keydown', escape);
      skipBurn?.();
    };
  });
</script>

{#snippet envelope()}
  <svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <rect x="1.5" y="3.5" width="13" height="9.5" rx="1.8" fill="var(--paper-shade)" />
    <path d="M2.2 4.4 8 8.6l5.8-4.2" fill="none" stroke="var(--hand-faint)" stroke-width="1.1" stroke-linejoin="round" />
    <path d="M8 11.1c-1.1-.8-1.8-1.4-1.8-2.1 0-.5.4-.8.8-.8.4 0 .7.2 1 .6.3-.4.6-.6 1-.6.4 0 .8.3.8.8 0 .7-.7 1.3-1.8 2.1z" fill="var(--lantern-rose)" />
  </svg>
{/snippet}

{#snippet singed()}
  <svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M3.5 2h9A1.5 1.5 0 0 1 14 3.5v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5v-10A1.5 1.5 0 0 1 3.5 2z" fill="var(--paper-shade)" />
    <path d="M4.5 5h7M4.5 7.4h5" stroke="var(--ink-faded)" stroke-width="0.9" stroke-linecap="round" opacity="0.6" />
    <path d="M2 10.6c1.2-.9 2.1.5 3.3-.2s1.8-1 3 .1 2.1-.3 3.2-.5c.9-.2 1.7.3 2.5.2v3.3a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5z" fill="var(--char-warm)" />
    <path d="M2 10.6c1.2-.9 2.1.5 3.3-.2s1.8-1 3 .1 2.1-.3 3.2-.5c.9-.2 1.7.3 2.5.2" fill="none" stroke="var(--burn-edge)" stroke-width="0.9" stroke-linecap="round" />
    <circle cx="11.6" cy="8.2" r="0.75" fill="var(--ember)" />
    <circle cx="13.4" cy="6.4" r="0.5" fill="var(--ember)" opacity="0.8" />
  </svg>
{/snippet}

{#snippet flame()}
  <svg class="icon" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
    <path d="M8 1.8c.4 2.2 3.7 3.9 3.7 7.4A3.7 3.7 0 0 1 8 13 3.7 3.7 0 0 1 4.3 9.2c0-1.6.8-2.6 1.6-3.4.1 1.2.6 1.9 1.3 2.2-.2-2.4.1-4.6.8-6.2z" fill="var(--flame)" />
    <path d="M8 13a1.9 1.9 0 0 1-1.9-2c0-1 .8-1.7 1.4-2.5.2.9.8 1.2 1.3 1.6.6.4 1.1.8 1.1 1A1.9 1.9 0 0 1 8 13z" fill="var(--flame-core)" />
  </svg>
{/snippet}

<main class="page" class:entered>
  <header class="masthead">
    <span class="wordmark"><Lantern tone="honey" size={17} />dear sky</span>
    {#if onsky}
      <button class="sky-link" type="button" onclick={onsky}>
        <Lantern tone="apricot" size={10} />the sky
      </button>
    {/if}
  </header>

  <article
    class="sheet"
    class:entered={entered && !sheetAway}
    class:burning={burn === 'burning'}
    class:instant
    data-state={modelState}
  >
    <div class="paper" aria-hidden="true">
      <span class="creases"></span>
      <span class="ear"><span></span></span>
    </div>

    <div class="letter">
      <label class="visually-hidden" for="letter">your letter</label>
      <!-- Spellcheck is off on purpose: Chrome's enhanced spell check sends text to Google,
           and grammar extensions read the page. The letter must stay on this device. -->
      {#key fieldKey}
      <textarea
        id="letter"
        bind:this={field}
        bind:value={letter}
        oninput={onInput}
        onblur={() => typing && paused()}
        placeholder="who are you writing to tonight?"
        class:hush={!!condensing}
        readonly={!!condensing || burn === 'burning'}
        spellcheck="false"
        autocomplete="off"
        autocapitalize="sentences"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
      ></textarea>
      {/key}
      {#if condensing}
        <!-- The same words in the same places, laid over the letter so they can fade and glow. -->
        <div class="condense" class:go={condenseGo} class:rise={condenseRise} bind:this={overlay} aria-hidden="true">{#each tokens as token, i}{#if i % 2}{token}{:else}<span data-i={i} class:glow={glowing.has(i)} style:--k={glowing.get(i) ?? 0}>{token}</span>{/if}{/each}</div>
      {/if}
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
        onitsway={finished && !noteIsCurrent && cue === 'none' && (modelState === 'downloading' || modelState === 'warming')}
        onopen={() => openNote(letter)}
        onkeepwaiting={() => (stallDismissed = true)}
        onwriteown={!flagged && english ? writeOwn : undefined}
        onretry={finish}
        oncareclose={() => (careClosed = true)}
      />
    </aside>

    <div class="corner">
      <Candle readiness={$readiness} lean={reading} />
    </div>

    {#if burn === 'burning'}
      <Burn calm={calm()} />
    {/if}
  </article>

  <!-- Every option lives in the same grid cell with its space held, so nothing below ever jumps. -->
  <div class="actions">
    <div class="slot" class:shown={actions === 'done' && canFinish} inert={actions !== 'done' || !canFinish}>
      <button class="soft-button" type="button" onclick={finish}>i'm done for now</button>
    </div>

    <div class="slot" class:shown={actions === 'choose'} inert={actions !== 'choose'}>
      <div class="choices">
        <button class="soft-button" type="button" onclick={keep}>{@render envelope()}keep it here</button>
        <button class="soft-button" type="button" onclick={askBurn} bind:this={letGo}>{@render singed()}let it go</button>
        {#if !flagged && english}
          <button class="soft-button warm" type="button" onclick={release}>
            <Lantern tone="honey" size={14} />let it become a lantern
          </button>
        {/if}
      </div>
      {#if !flagged && !english}
        <p class="aside">lanterns can only carry english words for now, so this letter stays here with you.</p>
      {/if}
    </div>

    <div class="slot" class:shown={actions === 'kept'} inert={actions !== 'kept'}>
      <p class="aside">kept, here on this device. it'll be waiting whenever you come back.</p>
    </div>

    <div class="slot" class:shown={actions === 'asking'} inert={actions !== 'asking'}>
      <p class="aside">burn it gently? once it's gone, it can't come back.</p>
      <div class="choices">
        <button class="soft-button" type="button" onclick={cancelBurn} bind:this={notYet}>not yet</button>
        <button class="soft-button ember" type="button" onclick={burnIt}>{@render flame()}burn it</button>
      </div>
    </div>

    <div class="slot" class:shown={actions === 'gone'} inert={actions !== 'gone'}>
      <p class="aside" aria-live="polite">{actions === 'gone' ? "it's gone now. only you remember what it said." : ''}</p>
    </div>

    <div class="slot" class:shown={actions === 'condensing'} inert={actions !== 'condensing'}>
      <p class="badge">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path d="M10.5 1.8A6.5 6.5 0 1 0 14.2 11 5.3 5.3 0 0 1 10.5 1.8z" fill="currentColor" />
        </svg>
        On this device. Nothing has left yet.
      </p>
      <div class="found-stack">
        <p class="gathering" class:shown={condensing?.phase !== 'found'} aria-live="polite">
          gathering the heart of your letter
        </p>
        <p class="essence-line" class:shown={condensing?.phase === 'found'} aria-live="polite">
          {#if condensing?.essence}“{condensing.essence.essence}”{/if}
        </p>
      </div>
      <button
        class="quiet-link"
        class:shown={condensing?.phase === 'slow'}
        inert={condensing?.phase !== 'slow'}
        type="button"
        onclick={writeOwn}
      >
        write the words myself instead
      </button>
    </div>
  </div>
</main>

<style>
  .page {
    /*
      One screen, whole: the masthead, the sheet and the button row fit the window, with the
      button resting just above the rooftops. The page scrolls only once the letter outgrows
      the sheet. --chrome is everything on the page that isn't the sheet.
    */
    --masthead-h: 68px;
    --actions-gap: 22px;
    --button-row: 48px;
    --ground: calc(var(--horizon-h) * 0.6 + env(safe-area-inset-bottom));
    --chrome: calc(var(--masthead-h) + var(--actions-gap) + var(--button-row) + var(--ground));
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100dvh;
    padding: 0 16px var(--ground);
    /* The candle's glow may spill past the paper, never past the screen. */
    overflow-x: clip;
  }

  .masthead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: var(--sheet-w);
    height: var(--masthead-h);
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
  }

  .sky-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--ui-soft);
    font-family: var(--font-ui);
    font-size: 0.92rem;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition:
      color var(--t-ui) var(--ease-out),
      transform var(--t-ui) var(--ease-out);
  }

  .sky-link:hover {
    color: var(--ui);
  }

  .sky-link:active {
    transform: scale(0.96);
    transition-duration: var(--t-press);
  }

  /* The moon sits in the header's corner until 1180px: leave it room. */
  @media (max-width: 939px) {
    .masthead {
      padding-right: 60px;
    }
  }

  .sheet {
    position: relative;
    width: 100%;
    max-width: var(--sheet-w);
    /*
      Fills the window, so "done" is on the first screen. The floor keeps room for a whole
      margin note (2–3 sentences ≈ 12 lines in the 208px column), so it never grows the sheet
      while it streams; below that height the page scrolls a little instead.
    */
    min-height: clamp(500px, calc(100dvh - var(--chrome)), 940px);
    display: grid;
    grid-template-columns: minmax(0, 1fr) 208px;
    column-gap: 40px;
    padding: 60px 40px 112px 60px;
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

  .sheet.instant {
    transition: none;
  }

  /* The sheet curls back from its bottom edge as it chars, then fades into the embers. */
  .sheet.burning {
    transform-origin: 50% 100%;
    animation: curl 2.8s cubic-bezier(0.4, 0, 0.3, 1) 2.4s forwards;
  }

  /* It starts to go while the top still burns, so the char is never seen as one dark slab. */
  @keyframes curl {
    0% {
      opacity: 1;
      transform: none;
    }
    45% {
      opacity: 0.7;
      transform: perspective(1600px) rotateX(10deg) rotate(-0.6deg) scale(0.985);
    }
    100% {
      opacity: 0;
      transform: perspective(1600px) rotateX(34deg) rotate(-1.4deg) translateY(-26px) scale(0.9);
    }
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

  /* The writing surface is the whole sheet: a tap anywhere on the paper starts writing. */
  .letter {
    display: flex;
    flex-direction: column;
  }

  textarea {
    display: block;
    flex: 1 0 auto;
    width: 100%;
    min-height: calc(1.8em * 6);
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

  /* While the letter condenses, the overlay shows the words; the field keeps its place. */
  textarea.hush {
    color: transparent;
    caret-color: transparent;
  }

  .condense {
    position: absolute;
    inset: 0;
    font-family: var(--font-letter);
    font-size: 1.1875rem;
    line-height: 1.8;
    color: var(--ink);
    white-space: pre-wrap;
    overflow-wrap: break-word;
    pointer-events: none;
  }

  .condense span {
    transition: opacity 1.6s var(--ease-out);
  }

  .condense.go span {
    opacity: 0.13;
  }

  .condense span.glow {
    display: inline-block;
    transition:
      color 0.9s var(--ease-out),
      text-shadow 0.9s var(--ease-out),
      opacity 1.6s var(--ease-out),
      transform 1.6s var(--ease-out);
  }

  .condense.go span.glow {
    opacity: 1;
    color: var(--ink-glow);
    text-shadow: 0 0 14px var(--lantern-glow);
    transition-delay: calc(0.3s + var(--k) * 0.12s);
  }

  /* The glowing words drift up like sparks and go out, one after another. */
  .condense.rise span.glow {
    opacity: 0;
    transform: translateY(-30px) scale(0.92);
    transition-timing-function: var(--ease-out), var(--ease-out), ease-in, var(--ease-out);
    transition-delay: calc(var(--k) * 0.16s);
  }

  /*
    Every moment's space is held (nothing below ever jumps), but only the button row counts
    toward the page's height: the taller moments (condensing) open down over the rooftops.
  */
  .actions {
    display: grid;
    align-content: start;
    justify-items: center;
    width: 100%;
    max-width: var(--sheet-w);
    height: var(--button-row);
    margin-top: var(--actions-gap);
  }

  .slot {
    grid-area: 1 / 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    opacity: 0;
    transform: translateY(6px);
    transition:
      opacity 0.6s var(--ease-out),
      transform 0.6s var(--ease-out);
  }

  .slot.shown {
    opacity: 1;
    transform: none;
    transition-delay: 0.15s;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
  }

  .soft-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 12px 28px;
    border: 1px solid var(--ui-line);
    border-radius: 999px;
    background: var(--button-bg);
    color: var(--ui);
    font-family: var(--font-ui);
    font-size: 0.975rem;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: transform var(--t-ui) var(--ease-out);
  }

  .soft-button::after {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    box-shadow: 0 0 24px 2px oklch(0.8 0.13 70 / 0.22);
    opacity: 0;
    transition: opacity var(--t-ui) var(--ease-out);
  }

  .soft-button:hover::after,
  .soft-button:focus-visible::after {
    opacity: 1;
  }

  .soft-button:active {
    transform: scale(0.96);
    transition-duration: var(--t-press);
  }

  .soft-button .icon {
    flex: none;
    margin-left: -4px;
  }

  .soft-button.ember {
    border-color: oklch(0.72 0.14 50 / 0.55);
    background: oklch(0.22 0.06 40 / 0.55);
  }

  .soft-button.warm {
    border-color: oklch(0.8 0.12 72 / 0.6);
    background: oklch(0.24 0.06 60 / 0.55);
  }

  .aside {
    max-width: 36ch;
    margin: 0;
    color: var(--ui-soft);
    font-size: 0.95rem;
    text-align: center;
    text-wrap: balance;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 6px 14px;
    border: 1px solid oklch(0.8 0.04 270 / 0.22);
    border-radius: 999px;
    background: var(--button-bg);
    color: var(--moon);
    font-size: 0.82rem;
    letter-spacing: 0.01em;
  }

  .found-stack {
    display: grid;
    justify-items: center;
  }

  .gathering,
  .essence-line {
    grid-area: 1 / 1;
    margin: 0;
    text-align: center;
    opacity: 0;
    transition: opacity 0.9s var(--ease-out);
  }

  .gathering {
    align-self: center;
    color: var(--ui-soft);
    font-size: 0.95rem;
    letter-spacing: 0.02em;
  }

  .essence-line {
    max-width: 30ch;
    color: var(--essence-on-sky);
    font-family: var(--font-letter);
    font-size: 1.375rem;
    font-style: italic;
    line-height: 1.45;
    text-shadow: 0 0 22px var(--lantern-glow);
    text-wrap: balance;
  }

  .gathering.shown,
  .essence-line.shown {
    opacity: 1;
  }

  .essence-line.shown {
    transition-duration: 1.4s;
  }

  .quiet-link {
    padding: 4px 8px;
    border: 0;
    background: none;
    color: var(--ui-soft);
    font-size: 0.9rem;
    text-decoration: underline;
    text-decoration-color: var(--ui-line);
    text-underline-offset: 4px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.8s var(--ease-out);
  }

  .quiet-link.shown {
    opacity: 1;
  }

  /* Phones: the margin moves under the letter, after a pencil squiggle, with its height held. */
  @media (max-width: 760px) {
    .page {
      --masthead-h: 62px;
    }

    .sheet {
      grid-template-columns: minmax(0, 1fr);
      min-height: 0;
      padding: 40px 24px 100px;
    }

    .paper {
      --ear: 28px;
    }

    textarea,
    .condense {
      font-size: 1.125rem;
      line-height: 1.75;
    }

    textarea {
      min-height: calc(1.75em * 10);
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
    .sheet,
    .slot {
      transform: none;
    }

    /* The page darkens in place (Burn), then simply fades. */
    .sheet.burning {
      animation: fade-away 0.9s var(--ease-out) 0.9s forwards;
    }

    @keyframes fade-away {
      to {
        opacity: 0;
      }
    }

    /* The words still fade and the glow still comes; nothing moves. */
    .condense.rise span.glow {
      transform: none;
    }
  }
</style>
