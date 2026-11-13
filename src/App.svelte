<script lang="ts">
  import { onMount, tick, type Component } from 'svelte';
  import { cloudModerationModel, moderate } from './lib/cloud/moderation';
  import { AILogicEngine } from './lib/engine/ailogic-engine';
  import type { Essence, OnDeviceEngine } from './lib/engine/types';
  import { ai } from './lib/firebase';
  import type { ApprovedWords } from './lib/privacy/release';
  import Consent from './lib/ui/Consent.svelte';
  import { loadDraft, saveDraft } from './lib/letters/draft';
  import { release, sendWaiting, watch } from './lib/sky/sky';
  import { installGrain } from './lib/ui/grain';
  import Sky from './lib/ui/Sky.svelte';
  import WritingScreen from './lib/ui/WritingScreen.svelte';

  const real = new AILogicEngine(ai);
  let engine = $state.raw<OnDeviceEngine>(real);

  // The only cloud model that sees anything from a letter, and it only accepts approved words (D30).
  const cloud = cloudModerationModel(ai);
  const check = (words: ApprovedWords) => moderate(cloud, words);
  // The shared sky: approved words only, moderated again by the server before anyone sees them (D32).
  const sky = { release, watch };

  /** Writing ⇄ consent, with a fade each way. The writing screen stays mounted, so the way back is exact. */
  type Stage = 'writing' | 'to-consent' | 'consent' | 'to-writing';
  let stage = $state<Stage>('writing');
  let releasing = $state.raw<{ letter: string; essence: Essence | null } | null>(null);
  let scrollBack = 0;
  const FADE_MS = 440;

  function toConsent(text: string, essence: Essence | null) {
    releasing = { letter: text, essence };
    scrollBack = window.scrollY;
    stage = 'to-consent';
    setTimeout(() => {
      window.scrollTo({ top: 0 });
      stage = 'consent';
    }, FADE_MS);
  }

  function toWriting() {
    stage = 'to-writing';
    setTimeout(() => {
      stage = 'writing';
      releasing = null;
      requestAnimationFrame(() => window.scrollTo({ top: scrollBack }));
    }, FADE_MS);
  }

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
      // Lanterns still waiting for the wind from an earlier visit go up now (D34).
      setTimeout(() => void sendWaiting(), 2000);
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
    void import('./lib/dev/probe').then((p) => p.watch(real));
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
  <div class="scene" class:away={stage === 'to-consent'} hidden={stage === 'consent' || stage === 'to-writing'}>
    <WritingScreen {engine} bind:letter {entered} onrelease={toConsent} />
  </div>
  {#if dev}
    <dev.DevStates {engine} sim={dev.sim} {useSim} onengine={swapEngine} onletter={devLetter} />
  {/if}
{/key}

{#if releasing && (stage === 'consent' || stage === 'to-writing')}
  <Consent
    letter={releasing.letter}
    initial={releasing.essence}
    {check}
    {sky}
    leaving={stage === 'to-writing'}
    onkeep={toWriting}
    onback={toWriting}
  />
{/if}

<style>
  .scene {
    transition: opacity 0.44s var(--ease-out);
  }

  /* Coming back from the tag: the page fades in from nothing (it was display: none). */
  @starting-style {
    .scene {
      opacity: 0;
    }
  }

  .scene.away {
    opacity: 0;
    pointer-events: none;
  }
</style>
