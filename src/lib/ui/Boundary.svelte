<!--
  The boundary diagram (design/storyboard.md beat 8), for the demo video. Two acts on one stage:

  1. "our first design": Nano redacts the names, the letter drifts to the cloud, and a name it
     missed glints on the way. Then what we found: names leaked in 2 / 5, essences clean in 10 / 10.
  2. "so we rebuilt it": the device side runs letter, safety, reflection, essence, leak check,
     the letter bumps against the boundary and stays, and only the tag crosses: moderation,
     kindred, sky, where it rises as a lantern beside its kindred.

  A fixed 1600×900 stage scaled to the window, so a 1920×1080 take is pixel-predictable. Each
  cue only switches classes; CSS does every motion (transform and opacity only, DESIGN.md §3).
  Keys: space pauses, ← → step through the cues, R replays. `?step=<name>` opens on a cue.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Lantern from './Lantern.svelte';
  import Sky from './Sky.svelte';

  /**
   * Seconds from the start, timed to the beat-8 voiceover at ~130 words a minute
   * (design/storyboard.md). Retime here if the VO changes; nothing else needs to move.
   */
  const CUES = [
    ['old', 0], // "Our first design…"
    ['redact', 1.0], // "…asked Nano to redact names,"
    ['send', 3.4], // "…then sent the letter to the cloud."
    ['slip', 5.6],
    ['found', 7.0], // "Names leaked in two of five letters."
    ['clean', 10.2], // "Its one-line essences were clean in ten of ten."
    ['new', 14.3], // "So we rebuilt it."
    ['bump', 16.4], // "The letter never leaves."
    ['ondevice', 18.4], // "The boundary lives in code: one instance locked to the device,"
    ['cross', 21.0], // "…one to the cloud."
    ['incloud', 21.8],
    ['rise', 23.8], // music only: it rises beside its kindred
  ] as const;
  type Cue = (typeof CUES)[number][0];
  const NAMES: readonly Cue[] = CUES.map((c) => c[0]);

  let n = $state(-1);
  const at = (cue: Cue) => n >= NAMES.indexOf(cue);
  const act1 = $derived(at('old') && !at('found'));
  const act2 = $derived(at('new'));

  // A clock that can pause: `base` ms of timeline when it last (re)started at `since`.
  let playing = $state(true);
  let base = 0;
  let since = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clock = () => (playing ? base + performance.now() - since : base);

  function schedule() {
    clearTimeout(timer);
    const next = CUES[n + 1];
    if (!playing || !next) return;
    timer = setTimeout(
      () => {
        n++;
        schedule();
      },
      Math.max(0, next[1] * 1000 - clock()),
    );
  }

  function go(i: number) {
    n = i;
    base = i < 0 ? 0 : CUES[i][1] * 1000;
    since = performance.now();
    schedule();
  }

  /** Back to the empty sky; a short pause for everything to fade, then the first cue. */
  function replay() {
    n = -1;
    playing = true;
    base = -1100;
    since = performance.now();
    schedule();
  }

  function toggle() {
    base = clock();
    since = performance.now();
    playing = !playing;
    schedule();
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === ' ') {
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowRight') go(Math.min(n + 1, CUES.length - 1));
    else if (e.key === 'ArrowLeft') go(Math.max(n - 1, -1));
    else if (e.key === 'r' || e.key === 'R') replay();
  }

  let k = $state(1);
  const fit = () => (k = Math.min(innerWidth / 1600, innerHeight / 900));

  onMount(() => {
    fit();
    const start = NAMES.indexOf(new URLSearchParams(location.search).get('step') as Cue);
    // Fonts first, so no word ever swaps face mid-shot.
    void Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1600))]).then(() => {
      if (start >= 0) {
        playing = false;
        go(start);
      } else replay();
    });
    return () => clearTimeout(timer);
  });

  /** Device stations, left to right; `d` is when the light reaches each, after the 'new' cue. */
  const DEVICE = [
    { x: 130, label: 'safety', icon: 'heart', d: 0.78 },
    { x: 265, label: 'reflection', icon: 'note', d: 1.21 },
    { x: 400, label: 'essence', icon: 'sparkle', d: 1.64 },
    { x: 535, label: 'leak check', icon: 'lens', d: 2.08 },
  ];
  /** Cloud stations; `d` counts from the 'cross' cue. */
  const CLOUD = [
    { x: 960, label: 'moderation', icon: 'shield', d: 1.5 },
    { x: 1110, label: 'kindred', icon: 'kin', d: 2.1 },
    { x: 1260, label: 'sky', icon: 'moon', d: 2.7 },
  ];
  /** Where yours settles, and the kindred around it. */
  const OURS = { x: 1400, y: 250 };
  const KINDRED = [
    { x: 1330, y: 165, tone: 'honey', size: 28 },
    { x: 1500, y: 205, tone: 'rose', size: 24 },
    { x: 1480, y: 335, tone: 'peach', size: 26 },
  ] as const;
</script>

<svelte:window onresize={fit} onkeydown={onkey} />

{#snippet icon(name: string)}
  <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      {#if name === 'heart'}
        <path d="M12 19.5s-7-4.3-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.3c0 5.3-7 9.6-7 9.6z" />
      {:else if name === 'note'}
        <path d="M5.5 4h9l4 4v12h-13z" />
        <path d="M14.5 4v4h4" />
        <path d="M8.5 12.4c1-1 2 .9 3 0s2-.9 3 0M8.5 16c1-1 2 .9 3 0" />
      {:else if name === 'sparkle'}
        <path d="M11 3.5c.6 4.3 2.5 6.2 6.8 6.8-4.3.6-6.2 2.5-6.8 6.8-.6-4.3-2.5-6.2-6.8-6.8 4.3-.6 6.2-2.5 6.8-6.8z" />
        <path d="M18 15.5c.2 1.4.8 2 2.2 2.2-1.4.2-2 .8-2.2 2.2-.2-1.4-.8-2-2.2-2.2 1.4-.2 2-.8 2.2-2.2z" />
      {:else if name === 'lens'}
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15l4.5 4.5M7.9 10.7l1.8 1.8 3.1-3.4" />
      {:else if name === 'shield'}
        <path d="M12 3.5l6.8 2.8v4.9c0 4.3-2.9 7.7-6.8 9.3-3.9-1.6-6.8-5-6.8-9.3V6.3z" />
        <path d="M9 12l2.1 2.1 4-4.2" />
      {:else if name === 'kin'}
        <circle cx="7" cy="14.5" r="3.2" />
        <circle cx="17" cy="9.5" r="3.2" />
        <path d="M10 13l4-2" stroke-dasharray="0.1 2.4" />
      {:else if name === 'moon'}
        <path d="M14 4a8 8 0 1 0 6 11.5A6.4 6.4 0 0 1 14 4z" />
        <path d="M18.5 4.5v3M17 6h3" />
      {/if}
    </g>
  </svg>
{/snippet}

{#snippet squiggle(w: number)}
  <svg class="squiggle" viewBox="0 0 {w} 8" width={w} height="8" aria-hidden="true">
    <path
      d="M1 4.5c{w * 0.08} -3 {w * 0.16} 3 {w * 0.25} 0s{w * 0.17} -3 {w * 0.25} 0 {w * 0.17} 3 {w * 0.25} 0 {w * 0.12} -2 {w * 0.2} -.5"
      fill="none"
      stroke="var(--hand)"
      stroke-width="1.5"
      stroke-linecap="round"
    />
  </svg>
{/snippet}

<Sky quiet />

<main class="boundary">
  <p class="visually-hidden">
    How Dear Sky keeps a letter private. Our first design had the on-device model redact names, then sent the letter to
    the cloud; in testing, names leaked in two of five letters, while one-line essences were clean in ten of ten. So the
    letter never leaves the device: safety, reflection, essence and a leak check all run there, and only the approved
    tag of three short fields crosses to the cloud, which moderates it, finds kindred lanterns and lets it rise.
  </p>

  <div class="stage" style:--k={k} aria-hidden="true">
    <!-- Captions: one cell, held. -->
    <p class="caption fade" class:on={act1}>our first design</p>
    <p class="caption fade" class:on={at('found') && !act2}>what we found</p>
    <p class="caption fade" class:on={act2}>so we rebuilt it</p>

    <!-- The two places: a warm room, and the cool night beyond it. -->
    <div class="warmth fade" class:on={act1 || act2}></div>
    <svg class="cloud fade" class:on={act1 || act2} viewBox="0 0 520 230">
      <filter id="cloud-soft" x="-10%" y="-20%" width="120%" height="140%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <path
        filter="url(#cloud-soft)"
        d="M70 200c-50 0-62-52-18-66-6-48 52-74 92-48 16-52 92-70 132-28 30-34 104-28 120 26 50-6 86 34 64 76 30 14 18 42-14 42z"
      />
    </svg>

    <div class="place fade" class:on={act1 || act2} style:left="400px">
      <span class="badge">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M10.5 1.8A6.5 6.5 0 1 0 14.2 11 5.3 5.3 0 0 1 10.5 1.8z" fill="currentColor" />
        </svg>
        On this device
      </span>
      <span class="chip warm fade" class:on={at('ondevice')}>ONLY_ON_DEVICE</span>
    </div>
    <div class="place fade" class:on={act1 || act2} style:left="1110px">
      <span class="badge">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M7 18.5h10.2a4.1 4.1 0 0 0 .5-8.2 5.6 5.6 0 0 0-10.8 1.6A3.3 3.3 0 0 0 7 18.5z" fill="currentColor" />
        </svg>
        In the cloud
      </span>
      <span class="chip cool fade" class:on={at('incloud')}>ONLY_IN_CLOUD</span>
    </div>

    <!-- The boundary: faint in the first design, drawn firm once it lives in code. -->
    <svg class="line" class:faint={act1} class:firm={act2} viewBox="0 0 8 540" width="8" height="540">
      <path d="M4 4v532" stroke="var(--thread)" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="0 13" />
    </svg>
    <p class="line-note fade" class:on={at('ondevice')}>the boundary lives in code</p>
    <span class="hit warm" class:go={at('bump')}></span>
    <span class="hit cool" class:go={at('cross')}></span>

    <!-- Act 1: the old letter, redacted by the model, sent whole. -->
    <div class="card" class:on={act1} class:redacted={at('redact')} class:sent={at('send')} class:slipped={at('slip')}>
      <span class="ln">Dear Nani,</span>
      <span class="ln">It's been a year since the</span>
      <span class="ln">hospital in <span class="redact">Lucknow</span>.</span>
      <span class="ln"><span class="slip">Riya</span> says you'd laugh at me.</span>
      <span class="ln">Love, <span class="redact later">Ananya</span></span>
    </div>
    <p class="hand-note slip-note fade" class:on={at('slip') && act1}>a name slipped through</p>

    <!-- What we found. -->
    <div class="findings" class:on={at('found') && !act2}>
      <div class="row" class:on={at('found')}>
        <span class="what">redaction</span>
        <span class="minis">
          {#each { length: 5 } as _, i (i)}
            <span class="mini" class:leak={i === 1 || i === 3} style:--i={i}>
              <span></span><span></span><span></span>
            </span>
          {/each}
        </span>
        <span class="result">names leaked in <b>2 / 5</b></span>
      </div>
      <div class="row" class:on={at('clean')}>
        <span class="what">essences</span>
        <span class="minis slips">
          {#each { length: 10 } as _, i (i)}
            <span class="strip" style:--i={i}></span>
          {/each}
        </span>
        <span class="result">clean in <b>10 / 10</b></span>
      </div>
    </div>

    <!-- Act 2, the device: the letter, and what runs on it. -->
    <div class="letter fade" class:on={act2}>
      <div class="sheet" class:bumping={at('bump')}>
        <span class="dear">Dear Nani,</span>
        <span class="rule"></span><span class="rule"></span><span class="rule short"></span><span class="rule"></span>
      </div>
    </div>
    <p class="hand-note stays fade" class:on={at('bump')}>the letter never leaves</p>

    <svg class="paths fade" class:on={act2} viewBox="0 0 1600 900" width="1600" height="900">
      <g stroke="var(--ui-line)" stroke-width="2" stroke-linecap="round" stroke-dasharray="0 9" fill="none">
        <path d="M130 525V450" />
        <path d="M172 410H223M307 410H358M442 410H493M577 410H612" />
        <path d="M768 410H918M1002 410H1068M1152 410H1218" />
      </g>
    </svg>

    {#each DEVICE as s (s.label)}
      <div class="station warm fade" class:on={act2} class:lit={act2} style:left="{s.x}px" style:--d="{s.d}s">
        <span class="bead"><span class="glow"></span>{@render icon(s.icon)}</span>
        <span class="label">{s.label}</span>
      </div>
    {/each}

    {#each CLOUD as s (s.label)}
      <div class="station cool fade" class:on={act2} class:lit={at('cross')} style:left="{s.x}px" style:--d="{s.d}s">
        <span class="bead"><span class="glow"></span>{@render icon(s.icon)}</span>
        <span class="label">{s.label}</span>
      </div>
    {/each}

    {#if act2}<span class="mote device"></span>{/if}
    {#if at('cross')}<span class="mote cloudward"></span>{/if}

    <!-- The tag: the only thing that crosses. -->
    <div class="tag-at" class:on={act2}>
      <div class="tag" class:crossed={at('cross')}>
        <span class="tie"></span>
        <span class="hole"></span>
        <span class="row"><span class="lbl">feeling</span>{@render squiggle(56)}</span>
        <span class="row"><span class="lbl">the words</span>{@render squiggle(96)}</span>
        <span class="row"><span class="lbl">the object</span>{@render squiggle(44)}</span>
      </div>
    </div>

    <!-- The sky: kindred waiting, yours rising to join them. -->
    <svg class="threads" class:on={at('rise')} viewBox="0 0 1600 900" width="1600" height="900">
      <g stroke="var(--thread)" stroke-width="2" stroke-linecap="round" stroke-dasharray="0 8" fill="none">
        {#each KINDRED as l (l.tone)}
          <path d="M{OURS.x} {OURS.y}L{l.x} {l.y}" />
        {/each}
      </g>
    </svg>
    {#each KINDRED as l, i (l.tone)}
      <div class="kin" class:on={act2} class:found={at('cross')} style:left="{l.x}px" style:top="{l.y}px">
        <span class="float" style:animation-delay="{-i * 7}s">
          <span class="halo"></span>
          <Lantern tone={l.tone} size={l.size} />
        </span>
      </div>
    {/each}
    <div class="ours" class:up={at('rise')} style:left="{OURS.x}px" style:top="{OURS.y}px">
      <span class="float">
        <span class="halo"></span>
        <Lantern tone="apricot" size={40} />
      </span>
    </div>
  </div>

  <p class="paused-note" class:on={!playing}>paused · space plays · ← → steps · R replays</p>
</main>

<style>
  .boundary {
    position: fixed;
    inset: 0;
    z-index: 1;
    overflow: hidden;
  }

  .stage {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1600px;
    height: 900px;
    margin: -450px 0 0 -800px;
    transform: scale(var(--k));
  }

  /* Everything on the stage is placed by its centre. */
  .stage > * {
    position: absolute;
    margin: 0;
    translate: -50% -50%;
  }

  .fade {
    opacity: 0;
    transition: opacity 0.8s var(--ease-out);
  }

  .fade.on {
    opacity: 1;
  }

  /* ---------- captions and places ---------- */

  .caption {
    left: 800px;
    top: 98px;
    color: var(--essence-on-sky);
    font-family: var(--font-hand);
    font-size: 40px;
    white-space: nowrap;
  }

  .warmth {
    left: 410px;
    top: 480px;
    width: 760px;
    height: 520px;
    border-radius: 50%;
    background: radial-gradient(closest-side, var(--candle-glow), transparent);
  }

  .cloud {
    left: 1110px;
    top: 420px;
    width: 560px;
    fill: var(--wisp);
  }

  .cloud.on {
    opacity: 0.22;
  }

  .place {
    top: 284px;
    display: grid;
    justify-items: center;
    gap: 12px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 7px 18px;
    border: 1px solid oklch(0.8 0.04 270 / 0.22);
    border-radius: 999px;
    background: var(--button-bg);
    color: var(--moon);
    font-size: 21px;
    white-space: nowrap;
  }

  .chip {
    padding: 3px 12px;
    border-radius: 8px;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.09em;
  }

  .chip.warm {
    color: var(--flame);
    background: oklch(0.85 0.15 75 / 0.1);
  }

  .chip.cool {
    color: var(--moon);
    background: oklch(0.9 0.02 262 / 0.1);
  }

  /* ---------- the boundary ---------- */

  .line {
    left: 800px;
    top: 470px;
    opacity: 0;
    transition: opacity 0.9s var(--ease-out);
  }

  .line.faint {
    opacity: 0.35;
  }

  .line.firm {
    opacity: 1;
  }

  .line-note {
    left: 800px;
    top: 178px;
    color: var(--ui-soft);
    font-family: var(--font-hand);
    font-size: 22px;
    white-space: nowrap;
  }

  /* Where something meets the line: a soft bloom. */
  .hit {
    left: 800px;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    opacity: 0;
  }

  .hit.warm {
    top: 590px;
    background: radial-gradient(closest-side, var(--window-glow), transparent);
  }

  .hit.cool {
    top: 410px;
    background: radial-gradient(closest-side, oklch(0.88 0.035 262 / 0.5), transparent);
  }

  .hit.warm.go {
    animation: bloom 1.1s var(--ease-out) 1.7s;
  }

  .hit.cool.go {
    animation: bloom 1.2s var(--ease-out) 0.45s;
  }

  @keyframes bloom {
    30% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  /* ---------- act 1 ---------- */

  .card {
    left: 410px;
    top: 460px;
    display: grid;
    padding: 26px 34px 28px;
    border-radius: 16px;
    background-color: var(--paper);
    background-image: var(--grain, none), linear-gradient(172deg, var(--paper) 55%, var(--paper-shade));
    color: var(--ink);
    font-family: var(--font-letter);
    font-size: 22px;
    line-height: 1.6;
    white-space: nowrap;
    box-shadow:
      inset 0 0 40px var(--paper-edge),
      0 14px 30px -10px oklch(0.08 0.04 275 / 0.55),
      0 40px 80px -24px oklch(0.06 0.04 275 / 0.6);
    opacity: 0;
    transform: translateY(14px) rotate(-1deg);
    transition:
      opacity 0.9s var(--ease-out),
      transform 1.1s var(--ease-out);
  }

  .card.on {
    opacity: 1;
    transform: rotate(-1deg);
  }

  /* Sent stays sent, so when act 1 fades it fades where it is, in the cloud. */
  .card.sent {
    transform: translateX(700px) rotate(1.2deg);
  }

  .card.on.sent {
    transition: transform 2.3s cubic-bezier(0.4, 0, 0.15, 1);
  }

  .redact,
  .slip {
    position: relative;
    isolation: isolate;
  }

  /* The model's redaction: a soft ink bar drawn over the word. */
  .redact::after {
    content: '';
    position: absolute;
    inset: 0.2em -0.14em 0.12em;
    border-radius: 5px;
    background: var(--ink);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.7s var(--ease-out);
  }

  .redact.later::after {
    transition-delay: 0.55s;
  }

  .redacted .redact::after {
    transform: none;
  }

  /* The name it missed, glowing as it reaches the cloud. */
  .slip::before {
    content: '';
    position: absolute;
    inset: 0.12em -0.22em 0.04em;
    z-index: -1;
    border-radius: 7px;
    background: var(--leak-mark);
    box-shadow: 0 0 22px 4px var(--burn-glow);
    opacity: 0;
    transition: opacity 0.6s var(--ease-out);
  }

  .slipped .slip::before {
    opacity: 1;
    animation: glint 1.6s ease-in-out 0.6s 2;
  }

  @keyframes glint {
    50% {
      opacity: 0.55;
    }
  }

  .hand-note {
    color: var(--essence-on-sky);
    font-family: var(--font-hand);
    font-size: 26px;
    white-space: nowrap;
  }

  .slip-note {
    left: 1110px;
    top: 620px;
  }

  /* ---------- what we found ---------- */

  .findings {
    left: 800px;
    top: 440px;
    display: grid;
    row-gap: 72px;
    opacity: 0;
    transition: opacity 0.8s var(--ease-out);
  }

  .findings.on {
    opacity: 1;
    transition-delay: 0.6s;
  }

  .findings .row {
    display: grid;
    grid-template-columns: 180px 340px 300px;
    align-items: center;
    column-gap: 40px;
  }

  .what {
    color: var(--ui-soft);
    font-size: 24px;
    text-align: right;
  }

  .result {
    color: var(--ui);
    font-size: 28px;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.8s var(--ease-out);
  }

  .result b {
    color: var(--essence-on-sky);
    font-weight: 700;
  }

  .row.on .result {
    opacity: 1;
    transition-delay: 1.6s;
  }

  .minis {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .mini,
  .strip {
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity 0.6s var(--ease-out),
      transform 0.7s var(--ease-out);
  }

  .row.on .mini,
  .row.on .strip {
    opacity: 1;
    transform: none;
    transition-delay: calc(0.6s + var(--i) * 0.11s);
  }

  .mini {
    position: relative;
    display: grid;
    align-content: start;
    gap: 7px;
    width: 46px;
    height: 58px;
    padding: 12px 9px;
    border-radius: 6px;
    background: var(--paper);
    box-shadow: inset 0 0 12px var(--paper-edge);
  }

  .mini span {
    height: 3px;
    border-radius: 2px;
    background: var(--paper-rule);
  }

  .mini span:nth-child(2) {
    width: 70%;
  }

  /* A leaked name: a warm word on the page, and a glint over it. */
  .mini.leak span:nth-child(2) {
    background: var(--ember);
  }

  .mini.leak::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 21px;
    width: 34px;
    height: 34px;
    margin: -17px 0 0 -17px;
    border-radius: 50%;
    background: radial-gradient(closest-side, var(--burn-glow), transparent);
    opacity: 0;
  }

  .row.on .mini.leak::after {
    animation: glint-in 1.8s ease-in-out calc(1.3s + var(--i) * 0.11s) forwards;
  }

  @keyframes glint-in {
    40% {
      opacity: 1;
    }
    70% {
      opacity: 0.5;
    }
    100% {
      opacity: 0.9;
    }
  }

  .strip {
    width: 26px;
    height: 10px;
    border-radius: 3px;
    background: var(--paper);
    box-shadow: 0 0 10px oklch(0.96 0.03 86 / 0.25);
  }

  /* ---------- act 2: the device ---------- */

  .letter {
    left: 130px;
    top: 590px;
  }

  .sheet {
    display: grid;
    align-content: start;
    gap: 9px;
    width: 92px;
    height: 116px;
    padding: 14px 12px;
    border-radius: 8px;
    background-color: var(--paper);
    background-image: var(--grain, none), linear-gradient(172deg, var(--paper) 55%, var(--paper-shade));
    box-shadow:
      inset 0 0 18px var(--paper-edge),
      0 10px 22px -8px oklch(0.08 0.04 275 / 0.6);
    rotate: -2deg;
    transform-origin: right center;
  }

  .dear {
    color: var(--ink);
    font-family: var(--font-letter);
    font-size: 11px;
    line-height: 1.2;
  }

  .rule {
    height: 2px;
    border-radius: 1px;
    background: var(--paper-rule);
  }

  .rule.short {
    width: 60%;
  }

  /* It tries the line, presses against it, and settles back home. */
  .sheet.bumping {
    animation: bump 3.4s both;
  }

  @keyframes bump {
    0% {
      transform: none;
      animation-timing-function: cubic-bezier(0.45, 0, 0.3, 1);
    }
    48% {
      transform: translateX(612px);
      animation-timing-function: ease-out;
    }
    52% {
      transform: translateX(622px) scaleX(0.93);
      animation-timing-function: ease-out;
    }
    60% {
      transform: translateX(596px) scaleX(1.02);
      animation-timing-function: ease-in-out;
    }
    66% {
      transform: translateX(602px);
      animation-timing-function: cubic-bezier(0.3, 0, 0.2, 1);
    }
    100% {
      transform: none;
    }
  }

  .stays {
    left: 470px;
    top: 690px;
  }

  .stays.on {
    transition-delay: 1.9s;
  }

  .paths {
    left: 800px;
    top: 450px;
  }

  .station {
    top: 428px;
    display: grid;
    justify-items: center;
    gap: 10px;
  }

  .bead {
    position: relative;
    display: grid;
    place-items: center;
    width: 76px;
    height: 76px;
    border: 1px solid var(--ui-line);
    border-radius: 50%;
    background: var(--button-bg);
    color: var(--ui-soft);
  }

  .bead svg {
    position: relative;
  }

  .glow {
    position: absolute;
    inset: -1px;
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.7s var(--ease-out);
  }

  .station.warm .glow {
    background: radial-gradient(closest-side, oklch(0.85 0.13 72 / 0.32), oklch(0.85 0.13 72 / 0.08));
    box-shadow: 0 0 34px 6px oklch(0.8 0.15 65 / 0.3);
  }

  .station.cool .glow {
    background: radial-gradient(closest-side, oklch(0.9 0.03 262 / 0.28), oklch(0.9 0.03 262 / 0.06));
    box-shadow: 0 0 34px 6px oklch(0.88 0.035 262 / 0.24);
  }

  .station.lit .glow {
    opacity: 1;
    transition-delay: var(--d);
  }

  .label {
    color: var(--ui);
    font-size: 21px;
    white-space: nowrap;
  }

  /* The light that carries the work from station to station. */
  .mote {
    left: 0;
    top: 0;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    opacity: 0;
  }

  .mote.device {
    background: var(--flame-core);
    box-shadow:
      0 0 12px 4px var(--flame),
      0 0 30px 10px oklch(0.8 0.15 65 / 0.35);
    animation: through-device 2.4s 0.3s both;
  }

  .mote.cloudward {
    background: var(--moon-light);
    box-shadow:
      0 0 12px 4px var(--moon),
      0 0 30px 10px var(--moon-halo);
    animation: through-cloud 1.4s 1.5s both;
  }

  @keyframes through-device {
    0% {
      transform: translate(130px, 560px);
      opacity: 0;
      animation-timing-function: ease-in-out;
    }
    6% {
      opacity: 1;
    }
    20%,
    26% {
      transform: translate(130px, 410px);
      animation-timing-function: ease-in-out;
    }
    38%,
    44% {
      transform: translate(265px, 410px);
      animation-timing-function: ease-in-out;
    }
    56%,
    62% {
      transform: translate(400px, 410px);
      animation-timing-function: ease-in-out;
    }
    74%,
    80% {
      transform: translate(535px, 410px);
      animation-timing-function: ease-in-out;
    }
    94% {
      transform: translate(690px, 410px);
      opacity: 1;
    }
    100% {
      transform: translate(690px, 410px);
      opacity: 0;
    }
  }

  @keyframes through-cloud {
    0% {
      transform: translate(960px, 410px);
      opacity: 0;
      animation-timing-function: ease-in-out;
    }
    12% {
      opacity: 1;
    }
    43%,
    55% {
      transform: translate(1110px, 410px);
      animation-timing-function: ease-in-out;
    }
    90% {
      transform: translate(1260px, 410px);
      opacity: 1;
    }
    100% {
      transform: translate(1260px, 410px);
      opacity: 0;
    }
  }

  /* ---------- the tag ---------- */

  .tag-at {
    left: 690px;
    top: 410px;
    opacity: 0;
    transform: translateY(-12px);
    transition:
      opacity 0.8s var(--ease-out),
      transform 1s var(--ease-out);
  }

  .tag-at.on {
    opacity: 1;
    transform: none;
    transition-delay: 2.5s;
  }

  .tag {
    position: relative;
    display: grid;
    gap: 8px;
    width: 150px;
    padding: 34px 16px 16px;
    border-radius: 14px;
    background-color: var(--paper);
    background-image: var(--grain, none), linear-gradient(172deg, var(--paper) 55%, var(--paper-shade));
    box-shadow:
      inset 0 0 26px var(--paper-edge),
      0 12px 26px -10px oklch(0.08 0.04 275 / 0.6);
    transform-origin: 50% 18px;
    animation: swing 5.5s ease-in-out infinite;
  }

  @keyframes swing {
    0%,
    100% {
      rotate: -2.2deg;
    }
    50% {
      rotate: 2.2deg;
    }
  }

  /* Through the line, then gently taken in by moderation. */
  .tag.crossed {
    animation:
      swing 5.5s ease-in-out infinite,
      cross 1.5s both;
  }

  @keyframes cross {
    0% {
      transform: none;
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    72% {
      transform: translateX(190px);
      opacity: 1;
      animation-timing-function: ease-in;
    }
    100% {
      transform: translateX(270px) scale(0.3);
      opacity: 0;
    }
  }

  .tie {
    position: absolute;
    top: -26px;
    left: 50%;
    width: 1px;
    height: 44px;
    background: oklch(0.75 0.05 70 / 0.55);
  }

  .hole {
    position: absolute;
    top: 12px;
    left: calc(50% - 5px);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--sky-top);
    box-shadow:
      inset 0 1px 2px oklch(0 0 0 / 0.5),
      0 0 0 3px oklch(0.88 0.03 80);
  }

  .tag .row {
    display: grid;
    gap: 1px;
  }

  .lbl {
    color: var(--ink-faded);
    font-size: 14px;
    letter-spacing: 0.03em;
  }

  .squiggle {
    display: block;
    overflow: visible;
  }

  /* ---------- the sky ---------- */

  .threads {
    left: 800px;
    top: 450px;
    opacity: 0;
    transition: opacity 1.2s var(--ease-out);
  }

  .threads.on {
    opacity: 1;
    transition-delay: 1.9s;
  }

  .kin,
  .ours {
    opacity: 0;
    transition:
      opacity 1s var(--ease-out),
      transform 2.6s var(--ease-out);
  }

  .kin.on {
    opacity: 0.3;
  }

  .kin.on.found {
    opacity: 1;
    transition-delay: 2.1s;
  }

  .ours {
    transform: translate(-140px, 160px) scale(0.55);
  }

  .ours.up {
    opacity: 1;
    transform: none;
  }

  .float {
    position: relative;
    display: block;
    animation: float 14s ease-in-out infinite;
  }

  .halo {
    position: absolute;
    inset: -70% -95%;
    border-radius: 50%;
    background: radial-gradient(closest-side, var(--lantern-glow), transparent 85%);
  }

  .float :global(.lantern) {
    position: relative;
  }

  @keyframes float {
    0%,
    100% {
      transform: translate(0, 0) rotate(-2deg);
    }
    50% {
      transform: translate(4px, -10px) rotate(2deg);
    }
  }

  /* ---------- controls ---------- */

  .paused-note {
    position: fixed;
    left: 50%;
    bottom: 14px;
    margin: 0;
    translate: -50% 0;
    padding: 4px 14px;
    border-radius: 999px;
    background: var(--button-bg);
    color: var(--ui-soft);
    font-size: 0.8rem;
    opacity: 0;
    transition: opacity var(--t-ui) var(--ease-out);
  }

  .paused-note.on {
    opacity: 1;
  }

  /* ---------- calm version: fades where things travelled (DESIGN.md §3) ---------- */

  @media (prefers-reduced-motion: reduce) {
    .card.on.sent {
      transition: transform 0s 0.7s;
      animation: blink 1.4s var(--ease-out);
    }

    .sheet.bumping,
    .mote,
    .tag,
    .float {
      animation: none;
    }

    .mote {
      display: none;
    }

    .tag.crossed {
      animation: fade-out 0.9s 0.3s both;
    }

    .ours,
    .ours.up {
      transform: none;
    }

    .card,
    .tag-at,
    .mini,
    .strip {
      transform: none;
    }

    .card.on {
      transform: rotate(-1deg);
    }

    .card.sent {
      transform: translateX(700px) rotate(1.2deg);
    }
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  @keyframes fade-out {
    to {
      opacity: 0;
    }
  }
</style>
