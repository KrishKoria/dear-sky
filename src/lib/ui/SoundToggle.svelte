<!--
  The one switch for sound (D42, D46): always in the same corner, over the rooftops, on every
  screen. It remembers the choice on this device. On, the speaker's waves are out; off, they
  fold away. Sound itself waits for the first click or key (browsers require one).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { onSound, setSound } from '../sound/sound';

  let on = $state(true);
  let shown = $state(false);

  onMount(() => {
    const stop = onSound((v) => (on = v));
    requestAnimationFrame(() => (shown = true));
    return stop;
  });
</script>

<button
  class="sound"
  class:shown
  class:off={!on}
  type="button"
  aria-pressed={on}
  title={on ? 'sound is on' : 'sound is off'}
  onclick={() => setSound(!on)}
>
  <span class="visually-hidden">sound</span>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path class="body" d="M4.5 9.6h2.7l4.2-3.4c.6-.5 1.4 0 1.4.7v10.2c0 .8-.8 1.2-1.4.7l-4.2-3.4H4.5c-.6 0-1-.4-1-1v-2.8c0-.6.4-1 1-1z" />
    <path class="wave near" d="M15.6 9.4c.9.7 1.4 1.6 1.4 2.6s-.5 1.9-1.4 2.6" />
    <path class="wave far" d="M17.9 7c1.6 1.3 2.6 3 2.6 5s-1 3.7-2.6 5" />
    <path class="hush" d="M16.2 10.2l3.4 3.6M19.6 10.2l-3.4 3.6" />
  </svg>
</button>

<style>
  .sound {
    position: fixed;
    right: max(14px, env(safe-area-inset-right));
    bottom: calc(12px + env(safe-area-inset-bottom));
    z-index: 30;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid oklch(0.85 0.03 280 / 0.16);
    border-radius: 50%;
    background: oklch(0.2 0.04 275 / 0.55);
    color: var(--ui-soft);
    cursor: pointer;
    opacity: 0;
    box-shadow: 0 0 18px -4px var(--lantern-glow);
    transition:
      opacity 1.2s var(--ease-out) 0.6s,
      color var(--t-ui) var(--ease-out),
      box-shadow var(--t-ui) var(--ease-out),
      scale var(--t-press) var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }

  .sound.shown {
    opacity: 1;
  }

  .sound:active {
    scale: 0.92;
  }

  @media (hover: hover) {
    .sound:hover {
      color: var(--essence-on-sky);
      box-shadow: 0 0 22px -2px var(--lantern-glow);
    }
  }

  /* Off: no glow, the waves fold in, a soft hush mark in their place. */
  .sound.off {
    box-shadow: none;
  }

  svg {
    width: 20px;
    height: 20px;
    overflow: visible;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .body {
    fill: currentColor;
    stroke: none;
  }

  .wave,
  .hush {
    transform-box: fill-box;
    transform-origin: 0% 50%;
    transition:
      opacity var(--t-ui) var(--ease-out),
      scale 0.32s var(--ease-out);
  }

  .wave.far {
    transition-delay: 40ms;
  }

  .off .wave {
    opacity: 0;
    scale: 0.4 1;
  }

  .hush {
    opacity: 0;
    scale: 0.6;
    transform-origin: 50% 50%;
  }

  .off .hush {
    opacity: 0.85;
    scale: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .wave,
    .hush {
      transition: opacity var(--t-ui) var(--ease-out);
    }

    .off .wave,
    .hush {
      scale: none;
    }
  }
</style>
