<!--
  Dev only (never in the build): flip the writing screen through every readiness state in
  DESIGN.md §4b, on any browser, and drop in the lab's fictional letters.
-->
<script lang="ts">
  import { LETTERS } from '../../lab/letters';
  import type { Readiness } from '../engine/readiness';
  import type { OnDeviceEngine } from '../engine/types';
  import { SimEngine } from './sim-engine';

  let {
    engine,
    sim,
    useSim,
    onengine,
    onletter,
  }: {
    engine: OnDeviceEngine;
    sim: SimEngine;
    useSim: boolean;
    onengine: (useSim: boolean) => void;
    onletter: (text: string) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const { readiness, progress } = engine;

  let open = $state(false);
  let risky = $state(false);
  let download = $state(0.4);

  const STATES: Readiness['state'][] = ['downloading', 'warming', 'ready', 'slow', 'stalled', 'unavailable'];

  function pick(state: Readiness['state']) {
    sim.set(state === 'downloading' ? { state, progress: download } : ({ state } as Readiness));
  }

  $effect(() => {
    sim.risky = risky;
  });
</script>

<div class="dev" class:open>
  <button class="toggle" type="button" onclick={() => (open = !open)}>
    {open ? 'hide' : 'states'} · {$readiness.state}
  </button>

  {#if open}
    <div class="panel">
      <fieldset>
        <legend>engine</legend>
        <label><input type="radio" checked={useSim} onchange={() => onengine(true)} /> simulated</label>
        <label><input type="radio" checked={!useSim} onchange={() => onengine(false)} /> real (AI Logic)</label>
      </fieldset>

      {#if useSim}
        <fieldset>
          <legend>readiness</legend>
          <div class="row">
            {#each STATES as s (s)}
              <button type="button" class:on={$readiness.state === s} onclick={() => pick(s)}>{s}</button>
            {/each}
          </div>
          <label class="slider">
            download {Math.round(download * 100)}%
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              bind:value={download}
              oninput={() => sim.set({ state: 'downloading', progress: download })}
            />
          </label>
          <button type="button" onclick={() => sim.playArrival()}>play first visit</button>
          <label><input type="checkbox" bind:checked={risky} /> model flags every letter</label>
        </fieldset>
      {/if}

      <fieldset>
        <legend>letter</legend>
        <div class="row">
          {#each Object.keys(LETTERS) as key (key)}
            <button type="button" onclick={() => onletter(LETTERS[key])}>{key}</button>
          {/each}
          <button type="button" onclick={() => onletter('')}>clear</button>
        </div>
      </fieldset>

      <p class="steps">
        safety <b>{$progress.safety}</b> · reflection <b>{$progress.reflection}</b> · essence <b>{$progress.essence}</b>
      </p>
    </div>
  {/if}
</div>

<style>
  .dev {
    position: fixed;
    left: 12px;
    bottom: 12px;
    z-index: 50;
    max-width: min(340px, calc(100vw - 24px));
    font: 12px/1.4 var(--font-ui);
    color: var(--ui);
  }

  .toggle,
  .panel button {
    padding: 4px 10px;
    border: 1px solid oklch(0.6 0.05 280 / 0.5);
    border-radius: 999px;
    background: oklch(0.2 0.04 278 / 0.92);
    cursor: pointer;
  }

  .panel {
    margin-bottom: 8px;
    padding: 10px 12px;
    border-radius: 14px;
    background: oklch(0.18 0.04 278 / 0.96);
    box-shadow: 0 10px 30px oklch(0.05 0.03 275 / 0.6);
  }

  .dev.open {
    display: flex;
    flex-direction: column-reverse;
    align-items: flex-start;
  }

  fieldset {
    margin: 0 0 8px;
    padding: 6px 8px 8px;
    border: 1px solid oklch(0.5 0.04 280 / 0.4);
    border-radius: 10px;
  }

  legend {
    padding: 0 4px;
    color: var(--ui-soft);
  }

  label {
    display: block;
    margin: 4px 0;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;
  }

  .on {
    border-color: var(--focus) !important;
    color: var(--focus);
  }

  .slider input {
    width: 100%;
  }

  .steps {
    margin: 0;
    color: var(--ui-soft);
  }

  .steps b {
    color: var(--ui);
    font-weight: 600;
  }
</style>
