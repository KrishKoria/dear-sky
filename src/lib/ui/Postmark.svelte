<!--
  The postmark: once a lantern has risen, a little stamp offers to show where each part of its
  making happened. Tapped, a paper slip lays out the journey (src/lib/privacy/postmark.ts):
  what stayed on this device, what was checked in code, and what went to the cloud, with the
  exact count of words that left. The app's own bookkeeping, told plainly.
-->
<script lang="ts">
  import { postmark, type Journey, type Where } from '../privacy/postmark';
  import { play } from '../sound/sound';

  let { journey }: { journey: Journey } = $props();

  const mark = $derived(postmark(journey));
  const day = new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' }).toLowerCase();

  let dialog = $state<HTMLDialogElement>();

  function show() {
    dialog?.showModal();
    void play('paper', { fadeAfter: 1.2 });
  }

  function hide() {
    dialog?.close();
  }

  /** A tap on the dimmed night around the slip puts it away. */
  function onclick(e: MouseEvent) {
    if (e.target === dialog) hide();
  }
</script>

{#snippet icon(where: Where)}
  <svg class="where-icon" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    {#if where === 'device'}
      <path d="M10.5 1.8A6.5 6.5 0 1 0 14.2 11 5.3 5.3 0 0 1 10.5 1.8z" fill="currentColor" />
    {:else if where === 'cloud'}
      <path d="M4.6 12.5a3 3 0 0 1-.3-6 4.2 4.2 0 0 1 8 1.1 2.5 2.5 0 0 1-.3 4.9z" fill="currentColor" />
    {:else if where === 'code'}
      <path d="M3.5 8.4l2.9 2.8 6.1-6.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    {:else}
      <path d="M3 13l1-3.4 6.8-6.8a1.6 1.6 0 0 1 2.3 2.3L6.3 12z" fill="currentColor" />
    {/if}
  </svg>
{/snippet}

{#snippet stamp(size: number)}
  <svg class="stamp" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
    <defs>
      <path id="ring-{size}" d="M32 32m-21 0a21 21 0 1 1 42 0a21 21 0 1 1-42 0" />
    </defs>
    <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" stroke-width="1.6" />
    <circle cx="32" cy="32" r="16" fill="none" stroke="currentColor" stroke-width="1" />
    <text font-size="7.4" letter-spacing="1.6" fill="currentColor"><textPath href="#ring-{size}">DEAR SKY · {day.toUpperCase()} ·</textPath></text>
    <path d="M27 33.5c-1.6-1.2-2.8-2.2-2.8-3.4 0-.8.6-1.4 1.4-1.4.6 0 1.1.4 1.4.9.4-.5.9-.9 1.5-.9.8 0 1.4.6 1.4 1.4 0 1.2-1.3 2.2-2.9 3.4z" fill="currentColor" transform="translate(5 1)" />
  </svg>
{/snippet}

<button class="trigger" type="button" onclick={show}>
  {@render stamp(22)}see its postmark
</button>

<dialog class="slip" bind:this={dialog} {onclick} aria-labelledby="postmark-title">
  <div class="paper">
    <span class="cancel" aria-hidden="true">{@render stamp(76)}</span>
    <h2 id="postmark-title">{mark.left} words and its picture left this device.</h2>
    <p class="sub">Everything else stayed here.</p>
    <ol class="stamps">
      {#each mark.stamps as s, i (i)}
        <li style:--i={i}>
          <span class="what">{s.what}</span>
          <span class="how {s.where}">{@render icon(s.where)}{s.how}</span>
        </li>
      {/each}
    </ol>
    <form method="dialog">
      <button class="soft-button close" type="submit">put it away</button>
    </form>
  </div>
</dialog>

<style>
  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--ui-soft);
    font-family: var(--font-ui);
    font-size: 0.9rem;
    cursor: pointer;
    transition:
      color var(--t-ui) var(--ease-out),
      transform var(--t-ui) var(--ease-out);
  }

  .trigger:hover {
    color: var(--ui);
  }

  .trigger:active {
    transform: scale(0.96);
    transition-duration: var(--t-press);
  }

  .trigger .stamp {
    color: var(--lantern-apricot);
    rotate: -12deg;
  }

  .slip {
    width: min(440px, calc(100vw - 32px));
    max-width: none;
    max-height: calc(100dvh - 32px);
    padding: 0;
    border: 0;
    background: none;
    overflow: visible;
    opacity: 0;
    transform: translateY(16px) rotate(1.4deg);
    transition:
      opacity 0.45s var(--ease-out),
      transform 0.6s var(--ease-out),
      overlay 0.45s allow-discrete,
      display 0.45s allow-discrete;
  }

  .slip[open] {
    opacity: 1;
    transform: rotate(-0.8deg);
  }

  @starting-style {
    .slip[open] {
      opacity: 0;
      transform: translateY(16px) rotate(1.4deg);
    }
  }

  .slip::backdrop {
    background: oklch(0.1 0.03 275 / 0);
    transition:
      background 0.45s var(--ease-out),
      overlay 0.45s allow-discrete,
      display 0.45s allow-discrete;
  }

  .slip[open]::backdrop {
    background: oklch(0.1 0.03 275 / 0.55);
  }

  @starting-style {
    .slip[open]::backdrop {
      background: oklch(0.1 0.03 275 / 0);
    }
  }

  .paper {
    position: relative;
    padding: 30px 28px 22px;
    border-radius: 16px;
    background-color: var(--paper);
    background-image: var(--grain, none), linear-gradient(172deg, var(--paper) 55%, var(--paper-shade));
    box-shadow:
      inset 0 0 50px var(--paper-edge),
      0 1px 2px var(--paper-shadow-near),
      0 14px 30px -10px var(--paper-shadow-mid),
      0 46px 90px -24px var(--paper-shadow-far);
    color: var(--ink);
  }

  /* The postmark itself, struck at an angle over the slip's corner. */
  .cancel {
    position: absolute;
    top: -14px;
    right: 18px;
    color: oklch(0.6 0.11 40 / 0.55);
    rotate: 14deg;
    pointer-events: none;
  }

  h2 {
    margin: 0 70px 2px 0;
    font-family: var(--font-letter);
    font-size: 1.3rem;
    font-style: italic;
    font-weight: 400;
  }

  .sub {
    margin: 0 0 18px;
    color: var(--ink-faded);
    font-size: 0.9rem;
  }

  .stamps {
    display: grid;
    gap: 12px;
    margin: 0 0 20px;
    padding: 0;
    list-style: none;
  }

  .stamps li {
    display: grid;
    gap: 1px;
    animation: inked 0.6s var(--ease-out) calc(0.25s + var(--i) * 0.09s) both;
  }

  @keyframes inked {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  .what {
    color: var(--hand);
    font-family: var(--font-hand);
    font-size: 1.02rem;
    line-height: 1.35;
  }

  .how {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--ink-faded);
    font-size: 0.84rem;
  }

  .how.device {
    color: var(--moon-ink);
  }

  .how.cloud {
    color: oklch(0.5 0.07 245);
  }

  .where-icon {
    flex: none;
  }

  form {
    display: flex;
    justify-content: center;
    margin: 0;
  }

  /* The slip is paper, so its button is ink on paper rather than the night's pill. */
  .close {
    padding: 9px 22px;
    border-color: oklch(0.6 0.05 60 / 0.35);
    background: oklch(0.93 0.025 80);
    color: var(--ink);
    font-size: 0.92rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .slip,
    .slip[open] {
      transform: none;
    }

    @starting-style {
      .slip[open] {
        transform: none;
      }
    }

    .stamps li {
      animation-name: fade;
    }

    @keyframes fade {
      from {
        opacity: 0;
      }
    }
  }
</style>
