<!--
  Everything that lives in the margin (DESIGN.md §4.2, design/directions.md §4 rules 1 and 5).
  The margin's space is reserved by the page, so nothing here can move the letter.

  - nib dots: the helper is writing a note right now (in the background, or for you)
  - folded note: a note is waiting; it opens when you tap it or say you're done
  - handwriting: the note, word by word, as if someone is writing back beside you
  - care card: shown instead of a note when the letter suggests the writer may be in danger
  - stalled: a gentle line and a soft choice, written as marginalia, never a dialog
-->
<script lang="ts">
  type Cue = 'none' | 'writing' | 'waiting';

  let {
    words,
    stale = false,
    cue = 'none',
    care = false,
    stalled = false,
    inkRanDry = false,
    onitsway = false,
    onopen,
    onkeepwaiting,
    onwriteown,
    onretry,
    oncareclose,
  }: {
    words: string[];
    /** The letter changed after this note was written. */
    stale?: boolean;
    cue?: Cue;
    care?: boolean;
    stalled?: boolean;
    inkRanDry?: boolean;
    /** The writer is done but the model is still arriving; its note will come on its own. */
    onitsway?: boolean;
    onopen: () => void;
    onkeepwaiting: () => void;
    /** Absent when this letter can't become a lantern (care card, not English). */
    onwriteown?: () => void;
    onretry: () => void;
    oncareclose: () => void;
  } = $props();

  const hasNote = $derived(words.length > 0);

  /** The envelope opens (flap up, heart lifting out) before the note starts writing. */
  let opening = $state(false);
  function open() {
    if (opening) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return onopen();
    opening = true;
    setTimeout(() => {
      opening = false;
      onopen();
    }, 520);
  }
  const announce = $derived(
    care
      ? 'A note with places to find support is in the margin.'
      : cue === 'waiting'
        ? 'A note is waiting in the margin.'
        : '',
  );
</script>

<div class="margin-note">
  <p class="visually-hidden" aria-live="polite">{announce}</p>

  {#if care}
    <section class="care" aria-label="support">
      <p class="care-lead">this sounds like a very heavy night.</p>
      <p>You don't have to hold it alone. If you might be in danger, please reach out to someone right now.</p>
      <p>
        <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">Find a free, confidential helpline</a>
        near you, or call your local emergency number.
      </p>
      <p class="care-quiet">Your letter stays on this device. Nothing was sent anywhere.</p>
      <button class="hand-button" type="button" onclick={oncareclose}>i'm okay for now</button>
    </section>
  {:else}
    {#if hasNote}
      <p class="note" class:stale aria-label="a note from your helper">
        {#each words as word, i (i)}<span class="word">{word}</span>{/each}
      </p>
    {/if}

    {#if inkRanDry && !hasNote}
      <p class="aside">
        the ink ran dry for a moment. your letter is safe here.
        <button class="hand-button" type="button" onclick={onretry}>try again</button>
      </p>
    {/if}

    {#if stalled}
      <p class="aside">
        your helper is taking its time tonight.
        <span class="ways">
          <button class="hand-button" type="button" onclick={onkeepwaiting}>keep waiting</button>
          {#if onwriteown}
            <button class="hand-button" type="button" onclick={onwriteown}>write the lantern's words myself</button>
          {/if}
        </span>
      </p>
    {/if}

    {#if onitsway && !hasNote && !stalled}
      <p class="aside">your helper is still on its way. it'll leave a note here when it arrives.</p>
    {/if}

    <!-- The cue slot keeps its height whether or not anything is in it. -->
    <div class="cue" class:after-note={hasNote}>
      {#if cue === 'writing'}
        <span class="nib" aria-hidden="true"><i></i><i></i><i></i></span>
      {:else if cue === 'waiting'}
        <button class="folded" class:opening type="button" onclick={open}>
          <svg viewBox="0 0 48 34" width="52" height="37" aria-hidden="true">
            <path d="M5 6.5Q5 4 7.5 4h33Q43 4 43 6.5v21q0 2.5-2.5 2.5h-33Q5 30 5 27.5z" fill="var(--paper-shade)" />
            <path class="flap" d="M5.5 6 24 18.5 42.5 6" fill="none" stroke="var(--hand-faint)" stroke-width="1.3" stroke-linejoin="round" />
            <path class="heart" d="M24 25.2c-2.6-1.8-4.2-3.2-4.2-4.8 0-1.1.9-1.9 2-1.9.9 0 1.6.5 2.2 1.3.6-.8 1.3-1.3 2.2-1.3 1.1 0 2 .8 2 1.9 0 1.6-1.6 3-4.2 4.8z" fill="var(--hand)" />
          </svg>
          <span>{hasNote ? 'a new note' : 'a note for you'}</span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .margin-note {
    font-family: var(--font-hand);
    font-variation-settings: 'INFM' 55;
    font-size: 1rem;
    line-height: 1.7;
    color: var(--hand);
  }

  .note {
    margin: 0;
    transition: opacity 0.9s var(--ease-out);
  }

  .note.stale {
    opacity: 0.5;
  }

  .word {
    display: inline;
    animation: ink 0.7s var(--ease-out) both;
  }

  @keyframes ink {
    from {
      opacity: 0;
    }
  }

  .aside {
    margin: 0 0 0.5rem;
  }

  /* Two soft ways on, one per line: a margin is too narrow to run them together. */
  .ways {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-top: 6px;
    line-height: 1.45;
  }

  .ways .hand-button {
    text-align: left;
  }

  .hand-button {
    display: inline;
    padding: 0 2px;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline wavy var(--hand-faint) 1px;
    text-underline-offset: 4px;
    border-radius: 6px;
    transition: transform var(--t-press) var(--ease-out);
  }

  .hand-button:active {
    transform: scale(0.96);
  }

  .cue {
    min-height: 44px;
    display: flex;
    align-items: center;
  }

  .cue.after-note {
    margin-top: 0.5rem;
  }

  .nib {
    display: inline-flex;
    gap: 6px;
    padding-left: 2px;
  }

  .nib i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--hand);
    opacity: 0.2;
    animation: nib 1.5s ease-in-out infinite;
  }

  .nib i:nth-child(2) {
    animation-delay: 0.2s;
  }

  .nib i:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes nib {
    40% {
      opacity: 0.85;
      transform: translateY(-1.5px);
    }
  }

  .folded {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-left: -4px;
    padding: 4px 8px 4px 4px;
    border: 0;
    border-radius: 12px;
    background: none;
    font: inherit;
    color: var(--hand);
    cursor: pointer;
    animation:
      arrive 0.9s var(--ease-out-expo) both,
      bob 3.6s ease-in-out 0.9s infinite;
    transition: transform var(--t-ui) var(--ease-out);
  }

  .folded svg {
    filter: drop-shadow(0 2px 3px oklch(0.4 0.05 60 / 0.18));
    transition: transform var(--t-ui) var(--ease-out);
  }

  .folded:hover svg {
    transform: translateY(-2px) rotate(-3deg);
  }

  .folded:active {
    transform: scale(0.95);
  }

  .flap,
  .heart {
    transform-box: view-box;
    transform-origin: 24px 6px;
    transition:
      transform 0.45s var(--ease-out),
      opacity 0.45s var(--ease-out);
  }

  .folded.opening {
    animation: lift 0.52s var(--ease-out) both;
  }

  .folded.opening .flap {
    transform: scaleY(-0.7);
  }

  .folded.opening .heart {
    transform: translateY(-13px) scale(1.25);
  }

  @keyframes lift {
    60% {
      opacity: 1;
    }
    to {
      opacity: 0;
      transform: translateY(-5px);
    }
  }

  @keyframes arrive {
    from {
      opacity: 0;
      transform: translateY(6px) rotate(-6deg) scale(0.9);
    }
  }

  @keyframes bob {
    50% {
      transform: translateY(-2px);
    }
  }

  .care {
    padding: 14px 14px 12px;
    border-radius: 16px;
    background: var(--paper-shade);
    font-family: var(--font-ui);
    font-variation-settings: normal;
    font-size: 0.875rem;
    line-height: 1.55;
    color: var(--ink);
    animation: ink 0.9s var(--ease-out) both;
  }

  .care p {
    margin: 0 0 0.6rem;
  }

  .care-lead {
    font-family: var(--font-hand);
    font-variation-settings: 'INFM' 55;
    font-size: 1rem;
    color: var(--hand);
  }

  .care a {
    color: var(--ink);
    font-weight: 700;
    text-decoration-color: var(--hand-faint);
    text-underline-offset: 3px;
    border-radius: 4px;
  }

  .care-quiet {
    color: var(--moon-ink);
    font-size: 0.8125rem;
  }

  .care .hand-button {
    font-family: var(--font-hand);
    color: var(--hand);
  }

  @media (prefers-reduced-motion: reduce) {
    .nib i,
    .folded {
      animation: none;
    }
    .nib i {
      opacity: 0.55;
    }
  }
</style>
