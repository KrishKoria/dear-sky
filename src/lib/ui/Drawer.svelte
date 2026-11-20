<!--
  The drawer: letters the writer kept, filed on this device only. Each waits in its envelope,
  marked with when it was kept. Opening one lays the letter out on its paper again, with the
  margin note the helper wrote at the time.

  With a warm helper on this device and a letter kept a while ago, the helper reads it again
  and writes a second note underneath: what may read differently with a little time. It runs
  on this device only, like every prompt that sees a letter, and is kept with the letter.

  "take it out" puts the letter back on the desk to carry on, let go or release. A letter
  already on the desk is never lost: it's tucked into the drawer in its place.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { HAND_FONT } from '../../fonts';
  import { keptAgo } from '../engine/revisit';
  import type { KeptLetter } from '../letters/drawer';
  import { pencil, play, type Loop } from '../sound/sound';
  import { Pacer, splitWords } from './pacer';
  import Wordmark from './Wordmark.svelte';

  const HOUR = 3_600_000;

  let {
    letters,
    leaving = false,
    writeLabel = 'write a letter',
    deskHasWords = false,
    onwrite,
    ontakeout,
    revisit,
    onrevisited,
    revisitAfter = 3 * HOUR,
  }: {
    /** Newest first. */
    letters: KeptLetter[];
    /** True while the app fades this screen out. */
    leaving?: boolean;
    writeLabel?: string;
    /** There's a letter on the desk right now: taking one out tucks it in here instead. */
    deskHasWords?: boolean;
    onwrite: () => void;
    ontakeout: (letter: KeptLetter) => void;
    /** Rereads a kept letter on this device. Absent when there's no warm helper. */
    revisit?: (letter: KeptLetter, onText: (delta: string) => void) => Promise<string>;
    onrevisited?: (letter: KeptLetter, text: string) => void;
    /** A letter kept more recently than this gets no second reading yet: it hasn't had time. */
    revisitAfter?: number;
  } = $props();

  /** A second reading is written at most twice a day; between, the last one is shown. */
  const FRESH_MS = 12 * HOUR;

  let open = $state.raw<KeptLetter | null>(null);
  let openedFrom: HTMLElement | null = null;
  let heading = $state<HTMLElement>();

  type Reading = { status: 'none' } | { status: 'writing'; words: string[] } | { status: 'written'; words: string[] };
  let reading = $state<Reading>({ status: 'none' });
  let readingRun: object | undefined;
  let pacer: Pacer | undefined;
  let scratching: Loop | undefined;

  const now = Date.now();

  function excerpt(text: string): string {
    const line = text.split('\n').find((l) => l.trim()) ?? '';
    return line.trim();
  }

  /** A small resting tilt per envelope, the same every visit. */
  function tilt(id: string): number {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
    return ((Math.abs(h) % 100) / 100) * 2.4 - 1.2;
  }

  function stopReading() {
    readingRun = undefined;
    pacer?.stop();
    pacer = undefined;
    scratching?.stop(0.3);
    scratching = undefined;
  }

  async function openLetter(letter: KeptLetter, from: HTMLElement) {
    openedFrom = from;
    stopReading();
    // Decided before the letter is laid out, so a note about to be written has its space from the first frame.
    const at = Date.now();
    const fresh = letter.revisit && at - letter.revisit.at < FRESH_MS;
    const write = !fresh && !!revisit && at - letter.keptAt >= revisitAfter;
    if (write) void writeReading(letter);
    else reading = letter.revisit ? { status: 'written', words: splitWords(letter.revisit.text) } : { status: 'none' };
    open = letter;
    void play('paper', { fadeAfter: 1.4 });
    window.scrollTo({ top: 0 });
    await tick();
    heading?.focus({ preventScroll: true });
  }

  async function writeReading(letter: KeptLetter) {
    if (!revisit) return;
    const run = {};
    readingRun = run;
    const words: string[] = [];
    reading = { status: 'writing', words };
    await Promise.race([document.fonts.load(HAND_FONT), new Promise((r) => setTimeout(r, 1500))]);
    if (readingRun !== run) return;

    const p = new Pacer({
      msPerWord: () => 150,
      onWord: (word) => {
        if (readingRun !== run) return;
        words.push(word);
        reading = { status: 'writing', words: [...words] };
        scratching ??= pencil();
      },
      onDone: () => {
        if (readingRun !== run) return;
        scratching?.stop();
        scratching = undefined;
        reading = words.length ? { status: 'written', words } : { status: 'none' };
      },
    });
    pacer = p;
    try {
      const text = await revisit(letter, (delta) => p.push(delta));
      p.end();
      if (text) onrevisited?.(letter, text);
    } catch {
      if (readingRun !== run) return;
      p.stop();
      scratching?.stop(0.3);
      scratching = undefined;
      // Nothing came: the letter is simply there to read, with no second note.
      reading = words.length ? { status: 'written', words } : { status: 'none' };
    }
  }

  async function close() {
    stopReading();
    open = null;
    reading = { status: 'none' };
    void play('paper', { fadeAfter: 1.2 });
    await tick();
    const id = openedFrom?.dataset.id;
    document.querySelector<HTMLElement>(`[data-id="${id}"]`)?.focus({ preventScroll: true });
  }

  function takeOut() {
    if (!open) return;
    const letter = open;
    stopReading();
    ontakeout(letter);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) void close();
  }

  $effect(() => stopReading);

  // Start the keyboard (and a screen reader) at the drawer's name, not wherever the last screen left it.
  let shelfHeading = $state<HTMLElement>();
  onMount(() => shelfHeading?.focus({ preventScroll: true }));
</script>

<svelte:window {onkeydown} />

{#snippet seal()}
  <svg class="seal" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
    <path d="M8 13.4c-2.4-1.7-4.2-3.2-4.2-5 0-1.2.9-2 2-2 .9 0 1.6.5 2.2 1.3.6-.8 1.3-1.3 2.2-1.3 1.1 0 2 .8 2 2 0 1.8-1.8 3.3-4.2 5z" fill="var(--lantern-rose)" />
  </svg>
{/snippet}

<main class="drawer" class:leaving>
  <header class="masthead">
    <Wordmark />
    <button class="soft-button pill" type="button" onclick={onwrite}>
      <span class="ember" aria-hidden="true"></span>{writeLabel}
    </button>
  </header>

  {#if open}
    {@const ago = keptAgo(open.keptAt, now)}
    <section class="reading" aria-labelledby="kept-heading">
      <article class="sheet">
        <div class="sheet-paper" aria-hidden="true">
          <span class="creases"></span>
          <span class="ear"><span></span></span>
        </div>

        <div class="letter">
          <h1 class="kept-when" id="kept-heading" tabindex="-1" bind:this={heading}>kept {ago}</h1>
          <p class="text">{open.text}</p>
        </div>

        <aside class="margin" aria-label="the margin">
          {#if open.note}
            <p class="label">when you wrote it</p>
            <p class="note">{open.note}</p>
          {/if}
          {#if reading.status !== 'none'}
            <div class="again" class:first={!open.note}>
              <p class="label">reading it again</p>
              <p class="note" aria-live="polite">
                {#each reading.words as word, i (i)}<span class="word" class:inked={reading.status === 'writing'}>{word}</span>{/each}
                {#if reading.status === 'writing' && reading.words.length === 0}
                  <span class="nib" aria-hidden="true"><i></i><i></i><i></i></span>
                {/if}
              </p>
            </div>
          {/if}
        </aside>
      </article>

      <div class="actions">
        <div class="choices">
          <button class="soft-button" type="button" onclick={close}>put it back</button>
          <button class="soft-button warm" type="button" onclick={takeOut}>take it out</button>
        </div>
        {#if deskHasWords}
          <p class="aside">the letter on your desk will be tucked in here, in its place.</p>
        {/if}
      </div>
    </section>
  {:else}
    <section class="shelf" aria-labelledby="drawer-heading">
      <h1 class="title" id="drawer-heading" tabindex="-1" bind:this={shelfHeading}>your drawer</h1>
      <p class="promise">These letters are kept on this device only. Nothing in here has left it.</p>

      {#if letters.length}
        <ul class="envelopes">
          {#each letters as letter, i (letter.id)}
            <li style:--i={Math.min(i, 8)} style:--tilt="{tilt(letter.id)}deg">
              <button
                class="envelope"
                type="button"
                data-id={letter.id}
                onclick={(e) => openLetter(letter, e.currentTarget)}
              >
                <span class="flap" aria-hidden="true">
                  <svg class="fold" viewBox="0 0 200 60" preserveAspectRatio="none">
                    <path d="M0 0h200L108 52a14 14 0 0 1-16 0z" fill="var(--paper-shade)" />
                    <path d="M0 0l92 52a14 14 0 0 0 16 0L200 0" fill="none" stroke="var(--paper-rule)" stroke-width="1.2" vector-effect="non-scaling-stroke" />
                  </svg>
                  {@render seal()}
                </span>
                <span class="when">kept {keptAgo(letter.keptAt, now)}</span>
                <span class="first">{excerpt(letter.text)}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">nothing in here just now. letters you keep will wait here for you.</p>
      {/if}
    </section>
  {/if}
</main>

<style>
  .drawer {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100dvh;
    padding: 0 16px var(--ground);
    overflow-x: clip;
    transition: opacity 0.44s var(--ease-out);
  }

  @starting-style {
    .drawer {
      opacity: 0;
    }
  }

  .drawer.leaving {
    opacity: 0;
    pointer-events: none;
  }

  /* The same place as the writing page's masthead, so the wordmark never moves between screens. */
  .masthead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    max-width: var(--sheet-w);
    height: 68px;
    padding: 4px 4px 0;
  }

  @media (max-width: 939px) {
    .masthead {
      padding-right: 60px;
    }
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

  /* Each view comes in on its own: the shelf settles, a letter rises a touch as it's laid out. */
  .shelf,
  .reading {
    width: 100%;
    max-width: var(--sheet-w);
    transition:
      opacity 0.5s var(--ease-out),
      transform 0.6s var(--ease-out);
  }

  @starting-style {
    .shelf {
      opacity: 0;
    }

    .reading {
      opacity: 0;
      transform: translateY(14px);
    }
  }

  .title {
    margin: 28px 0 6px;
    color: var(--ui);
    font-family: var(--font-letter);
    font-size: 1.75rem;
    font-style: italic;
    font-weight: 400;
    text-align: center;
  }

  .promise {
    margin: 0 auto 36px;
    max-width: 44ch;
    color: var(--ui-soft);
    font-size: 0.92rem;
    text-align: center;
    text-wrap: balance;
  }

  .empty {
    margin: 40px auto;
    max-width: 36ch;
    color: var(--ui-soft);
    text-align: center;
    text-wrap: balance;
  }

  .envelopes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 250px));
    justify-content: center;
    gap: 28px 26px;
    margin: 0;
    padding: 0 8px;
    list-style: none;
  }

  .envelopes li {
    animation: settle 0.7s var(--ease-out) calc(0.08s * var(--i)) both;
  }

  @keyframes settle {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }

  .envelope {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 4px;
    width: 100%;
    aspect-ratio: 1.6;
    padding: 0 18px 16px;
    border: 0;
    border-radius: 14px;
    background-color: var(--paper);
    background-image: var(--grain, none), linear-gradient(172deg, var(--paper) 55%, var(--paper-shade));
    box-shadow:
      inset 0 0 40px var(--paper-edge),
      0 1px 2px var(--paper-shadow-near),
      0 10px 22px -8px var(--paper-shadow-mid),
      0 30px 60px -20px var(--paper-shadow-far);
    text-align: left;
    cursor: pointer;
    rotate: var(--tilt);
    transition:
      transform var(--t-panel) var(--ease-out),
      rotate var(--t-panel) var(--ease-out);
  }

  .envelope:hover,
  .envelope:focus-visible {
    transform: translateY(-4px);
    rotate: 0deg;
  }

  .envelope:active {
    transform: translateY(-2px) scale(0.98);
    transition-duration: var(--t-press);
  }

  .flap {
    position: absolute;
    inset: 0 0 auto;
    height: 48%;
    border-radius: 14px 14px 0 0;
    overflow: hidden;
    pointer-events: none;
  }

  .fold {
    display: block;
    width: 100%;
    height: 100%;
  }

  .seal {
    position: absolute;
    left: 50%;
    bottom: 2px;
    translate: -50% 0;
    filter: drop-shadow(0 1px 1px oklch(0.4 0.08 30 / 0.3));
  }

  .when {
    color: var(--hand);
    font-family: var(--font-hand);
    font-size: 0.98rem;
    line-height: 1.3;
  }

  .first {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    color: var(--ink-faded);
    font-family: var(--font-letter);
    font-size: 0.98rem;
    line-height: 1.45;
  }

  /* A letter laid out again: the same paper as the desk, read-only. */
  .sheet {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 208px;
    column-gap: 40px;
    margin-top: 16px;
    padding: 44px 40px 48px 60px;
  }

  .letter,
  .margin {
    position: relative;
  }

  .kept-when {
    margin: 0 0 18px;
    color: var(--hand);
    font-family: var(--font-hand);
    font-size: 1.05rem;
    font-weight: 400;
  }

  .kept-when:focus,
  .title:focus {
    outline: none;
  }

  .text {
    margin: 0;
    color: var(--ink);
    font-family: var(--font-letter);
    font-size: 1.3125rem;
    line-height: 1.8;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  .margin {
    padding-top: 0.3rem;
  }

  .margin::before {
    content: '';
    position: absolute;
    top: -30px;
    bottom: -40px;
    left: -24px;
    width: 1px;
    background: linear-gradient(to bottom, transparent, var(--paper-rule) 10%, var(--paper-rule) 85%, transparent);
  }

  .label {
    margin: 0 0 4px;
    color: var(--ink-faded);
    font-family: var(--font-ui);
    font-size: 0.78rem;
    letter-spacing: 0.04em;
  }

  .note {
    margin: 0;
    color: var(--hand);
    font-family: var(--font-hand);
    font-size: 1.0625rem;
    line-height: 1.7;
  }

  /* Room for a whole note (35 words is about 7 lines here), so it never grows the sheet as it's written. */
  .again {
    min-height: calc(1.0625rem * 1.7 * 7 + 1.4rem);
    margin-top: 26px;
  }

  .again.first {
    margin-top: 0;
  }

  .word.inked {
    animation: ink 0.7s var(--ease-out) both;
  }

  @keyframes ink {
    from {
      opacity: 0;
      filter: blur(1.5px);
    }
  }

  .nib {
    display: inline-flex;
    gap: 5px;
    padding: 6px 0;
  }

  .nib i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--hand-faint);
    animation: nib 1.5s ease-in-out infinite;
  }

  .nib i:nth-child(2) {
    animation-delay: 0.2s;
  }

  .nib i:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes nib {
    0%,
    100% {
      opacity: 0.35;
      transform: none;
    }
    40% {
      opacity: 1;
      transform: translateY(-2px);
    }
  }

  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-top: 22px;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
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

  /*
    Short, wide windows: the same move as the writing page. A wider margin holds the same notes in
    fewer lines (35 words is 6 lines at 272px), so the buttons and their aside clear the rooftops.
  */
  @media (min-width: 761px) and (max-height: 725px) {
    .sheet {
      grid-template-columns: minmax(0, 1fr) 272px;
      column-gap: 32px;
      margin-top: 8px;
      padding: 32px 36px 36px 52px;
    }

    .again {
      min-height: calc(1.0625rem * 1.7 * 6 + 1.4rem);
    }

    .actions {
      margin-top: 16px;
    }
  }

  @media (max-width: 760px) {
    .sheet {
      grid-template-columns: minmax(0, 1fr);
      padding: 40px 24px 56px;
    }

    .text {
      font-size: 1.125rem;
      line-height: 1.75;
    }

    .margin {
      margin-top: 28px;
    }

    .margin::before {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reading,
    .envelope,
    .envelope:hover,
    .envelope:focus-visible {
      transform: none;
    }

    @starting-style {
      .reading {
        transform: none;
      }
    }

    .envelopes li {
      animation-name: fade-in;
    }

    @keyframes fade-in {
      from {
        opacity: 0;
      }
    }

    .word.inked {
      animation: none;
    }

    .nib i {
      animation: none;
    }
  }
</style>
