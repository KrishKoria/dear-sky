<script lang="ts">
  import { onMount, tick, type Component } from 'svelte';
  import { FONTS } from './fonts';
  import { cloudModerationModel, moderate } from './lib/cloud/moderation';
  import { AILogicEngine } from './lib/engine/ailogic-engine';
  import type { Essence, OnDeviceEngine } from './lib/engine/types';
  import { ai } from './lib/firebase';
  import type { ApprovedWords } from './lib/privacy/release';
  import Consent from './lib/ui/Consent.svelte';
  import { burnDraft, loadDraft, saveDraft } from './lib/letters/draft';
  import { release, sendWaiting, watch } from './lib/sky/sky';
  import { installGrain } from './lib/ui/grain';
  import Sky from './lib/ui/Sky.svelte';
  import SkyView from './lib/ui/SkyView.svelte';
  import WritingScreen from './lib/ui/WritingScreen.svelte';

  const real = new AILogicEngine(ai);
  let engine = $state.raw<OnDeviceEngine>(real);

  // The only cloud model that sees anything from a letter, and it only accepts approved words (D30).
  const cloud = cloudModerationModel(ai);
  const check = (words: ApprovedWords) => moderate(cloud, words);
  // The lantern's glyph (D13). Which model chose it is the hybrid call made visible, so it's logged.
  const paint = (words: ApprovedWords) =>
    engine.paint(words).then((p) => {
      console.info(`[dear sky] lantern painted: ${p.glyph}, by ${p.by === 'words' ? 'the word match' : `the ${p.by}`}`);
      return p;
    });
  // The shared sky: approved words only, moderated again by the server before anyone sees them (D32).
  const sky = { release, watch };

  /**
   * Three screens, one fade between any two. The writing screen stays mounted (hidden), so the
   * way back to the letter is exact, scroll position and all.
   */
  type Screen = 'writing' | 'consent' | 'sky';
  let screen = $state<Screen>('writing');
  let leaving = $state(false);
  let releasing = $state.raw<{ letter: string; essence: Essence | null } | null>(null);
  /** Who the sky gathers around: the lantern that just rose, coming up from below. */
  let skyFocus = $state.raw<{ id?: string; arriving: boolean }>({ arriving: false });
  let scrollBack = 0;
  const FADE_MS = 440;

  function go(to: Screen) {
    if (leaving || to === screen) return;
    const from = screen;
    if (from === 'writing') scrollBack = window.scrollY;
    leaving = true;
    setTimeout(() => {
      screen = to;
      leaving = false;
      if (from === 'consent') releasing = null;
      if (to === 'writing') requestAnimationFrame(() => window.scrollTo({ top: scrollBack }));
      else window.scrollTo({ top: 0 });
    }, FADE_MS);
  }

  function toConsent(text: string, essence: Essence | null) {
    releasing = { letter: text, essence };
    go('consent');
  }

  function toSky(id?: string) {
    skyFocus = { id, arriving: !!id };
    go('sky');
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
    const fonts = Promise.all(FONTS.map((f) => document.fonts.load(f))).catch(() => {});
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

<Sky {lit} quiet={screen === 'sky'} />

{#key engine}
  <div class="scene" class:away={screen === 'writing' && leaving} hidden={screen !== 'writing'}>
    <WritingScreen {engine} bind:letter {entered} onrelease={toConsent} onburn={burnDraft} onsky={() => toSky()} />
  </div>
  {#if dev}
    <dev.DevStates {engine} sim={dev.sim} {useSim} onengine={swapEngine} onletter={devLetter} />
  {/if}
{/key}

{#if releasing && screen === 'consent'}
  <Consent
    letter={releasing.letter}
    initial={releasing.essence}
    {check}
    sketch={(words) => engine.sketch(words)}
    {paint}
    {sky}
    {leaving}
    onkeep={() => go('writing')}
    onback={() => go('writing')}
    onsky={toSky}
  />
{/if}

{#if screen === 'sky'}
  <SkyView
    focus={skyFocus.id}
    arriving={skyFocus.arriving}
    {leaving}
    writeLabel={letter.trim() ? 'back to my letter' : 'write a letter'}
    onwrite={() => go('writing')}
  />
{/if}

<style>
  .scene {
    transition: opacity 0.44s var(--ease-out);
  }

  /* Coming back: the page fades in from nothing (it was display: none). */
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
