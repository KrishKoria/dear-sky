<!--
  The wordmark (D43): "Dear Sky," the way a letter opens, where the comma is a small lantern
  just lifting off. The idea of the app in one line: you write, then you let something go.

  On the first screen of a visit the letters settle in like ink, one by one, and the comma
  swells into its lantern and lifts. After that it bobs on the air, its glow breathing. Hovering
  lifts it a little higher. Later screens show it already settled. Transform and opacity only;
  reduced motion keeps the fades and drops the travel.
-->
<script module lang="ts">
  /** The ink-in plays once a visit, not on every screen change. */
  let introduced = false;
</script>

<script lang="ts">
  import Lantern from './Lantern.svelte';

  const intro = !introduced;
  introduced = true;

  const LETTERS = [...'Dear Sky'];
</script>

<span class="wordmark" class:intro role="img" aria-label="Dear Sky">
  {#each LETTERS as ch, i (i)}
    <span class="ch" style:--i={i} aria-hidden="true">{ch === ' ' ? ' ' : ch}</span>
  {/each}
  <span class="comma" aria-hidden="true">
    <span class="lift">
      <span class="bob">
        <span class="halo"></span>
        <Lantern tone="honey" size={11} />
      </span>
    </span>
    <span class="trail"><i></i><i></i></span>
  </span>
</span>

<style>
  .wordmark {
    position: relative;
    display: inline-flex;
    align-items: baseline;
    color: var(--ui);
    font-family: var(--font-letter);
    font-size: 1.5rem;
    font-style: italic;
    font-weight: 440;
    letter-spacing: 0.005em;
    line-height: 1;
    white-space: pre;
    cursor: default;
  }

  .ch {
    display: inline-block;
  }

  /* Ink settling: each letter rises a hair and darkens into place. */
  .intro .ch {
    animation: ink 0.9s var(--ease-out) both;
    animation-delay: calc(0.25s + var(--i) * 0.07s);
  }

  @keyframes ink {
    from {
      opacity: 0;
      transform: translateY(0.22em);
    }
  }

  .comma {
    position: relative;
    display: inline-block;
    width: 13px;
    margin-left: 3px;
    /* A comma's place: on the baseline, dipping just below it. */
    height: 0.9em;
    vertical-align: -0.12em;
  }

  .lift {
    position: absolute;
    left: 0;
    bottom: 0;
    transition: transform 0.6s var(--ease-out);
  }

  .wordmark:hover .lift {
    transform: translateY(-4px);
  }

  .intro .lift {
    animation: lift-off 1.4s var(--ease-out) 0.95s both;
  }

  /* From a comma's dot to a lantern, rising. */
  @keyframes lift-off {
    from {
      opacity: 0;
      transform: translateY(3px) scale(0.35);
    }
    35% {
      opacity: 1;
    }
  }

  /* Exactly the lantern's size (11 × 15.4): no line box from the text around it. */
  .bob {
    position: relative;
    display: block;
    width: 11px;
    height: 15.4px;
    line-height: 0;
    transform-origin: 50% 0;
    animation: bob 5.6s ease-in-out infinite;
  }

  @keyframes bob {
    0%,
    100% {
      transform: translateY(0) rotate(-3deg);
    }
    50% {
      transform: translateY(-2.5px) rotate(3deg);
    }
  }

  .bob :global(.lantern) {
    position: relative;
  }

  .halo {
    position: absolute;
    inset: -90% -110%;
    border-radius: 50%;
    background: radial-gradient(closest-side, var(--lantern-glow), transparent 80%);
    animation: breathe 4.2s ease-in-out infinite;
  }

  @keyframes breathe {
    50% {
      opacity: 0.55;
    }
  }

  /* Two faint sparks under it, where the comma was. */
  .trail {
    position: absolute;
    left: 4px;
    bottom: -7px;
    display: grid;
    gap: 2px;
  }

  .trail i {
    display: block;
    width: 2px;
    height: 2px;
    border-radius: 50%;
    background: var(--ember);
    opacity: 0;
    animation: spark 3.6s ease-out infinite;
  }

  .trail i:last-child {
    animation-delay: 1.8s;
  }

  @keyframes spark {
    0% {
      opacity: 0;
      transform: translateY(4px);
    }
    20% {
      opacity: 0.7;
    }
    100% {
      opacity: 0;
      transform: translateY(-8px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .intro .ch,
    .intro .lift {
      animation-name: fade;
    }

    .bob,
    .halo,
    .trail i {
      animation: none;
    }

    .wordmark:hover .lift {
      transform: none;
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
