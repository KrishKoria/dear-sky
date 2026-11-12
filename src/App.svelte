<script lang="ts">
  import { onMount, tick, type Component } from 'svelte';
  import { AILogicEngine } from './lib/engine/ailogic-engine';
  import type { OnDeviceEngine } from './lib/engine/types';
  import { ai } from './lib/firebase';
  import { loadDraft, saveDraft } from './lib/letters/draft';
  import { installGrain } from './lib/ui/grain';
  import Sky from './lib/ui/Sky.svelte';
  import WritingScreen from './lib/ui/WritingScreen.svelte';

  const real = new AILogicEngine(ai);
  let engine = $state.raw<OnDeviceEngine>(real);

  let letter = $state('');
  let entered = $state(false);
  /** The text as it arrived from storage; saving starts once the writer changes it. */
  let arrived: string | undefined;

  /** Stars come out with real download progress (DESIGN.md §4b). */
  let lit = $state(1);
  $effect(() => engine.readiness.subscribe((r) => (lit = r.state === 'downloading' ? r.progress : 1)));

  onMount(() => {
    installGrain();
    let settled = false;
    const fonts = Promise.all([
      document.fonts.load('400 19px "Literata Variable"'),
      document.fonts.load('400 16px "Nunito Variable"'),
    ]).catch(() => {});
    const draft = loadDraft().then((text) => {
      if (!settled) letter = text;
    });
    // Never hold the page for long: after 1.6 s it arrives with whatever is ready.
    void Promise.race([Promise.all([fonts, draft]), new Promise((r) => setTimeout(r, 1600))]).then(() => {
      settled = true;
      arrived = letter;
      entered = true;
    });
  });

  $effect(() => {
    const text = letter;
    if (!entered || text === arrived) return;
    arrived = undefined;
    const id = setTimeout(() => saveDraft(text), 500);
    return () => clearTimeout(id);
  });

  // Dev only: the state switcher and a simulated engine. Dead code in production builds.
  type DevKit = {
    DevStates: Component<any>;
    sim: import('./lib/dev/sim-engine').SimEngine;
  };
  let dev = $state.raw<DevKit | null>(null);
  let useSim = $state(false);

  if (import.meta.env.DEV) {
    void Promise.all([import('./lib/dev/DevStates.svelte'), import('./lib/dev/sim-engine')]).then(([m, s]) => {
      const sim = new s.SimEngine();
      dev = { DevStates: m.default, sim };
      if (localStorage.getItem('dev:sim') === '1') swapEngine(true);
    });
  }

  function swapEngine(simulated: boolean) {
    if (!dev) return;
    useSim = simulated;
    engine = simulated ? dev.sim : real;
    localStorage.setItem('dev:sim', simulated ? '1' : '0');
  }

  async function devLetter(text: string) {
    letter = text;
    await tick();
    // Behave as if it was typed, so the pause and the work-ahead run as usual.
    document.getElementById('letter')?.dispatchEvent(new Event('input', { bubbles: true }));
  }
</script>

<Sky {lit} />

{#key engine}
  <WritingScreen {engine} bind:letter {entered} />
  {#if dev}
    <dev.DevStates {engine} sim={dev.sim} {useSim} onengine={swapEngine} onletter={devLetter} />
  {/if}
{/key}
