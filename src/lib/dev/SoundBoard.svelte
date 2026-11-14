<script lang="ts">
  // Dev only: audition the app's sounds, choose the rise, and tune the mix by ear.
  import { onMount } from 'svelte'
  import {
    LEVEL,
    RISE_DEFAULT,
    installSound,
    onSound,
    pencil,
    play,
    setSound,
    skyMusic,
    typed,
    type Loop,
    type Moment,
    type RiseChoice,
  } from '../sound/sound'

  type Key = keyof typeof LEVEL

  const RISES: RiseChoice[] = ['barn', 'large', 'medium']

  const MOMENTS: { key: Key; label: string; hint: string }[] = [
    { key: 'paper', label: 'paper', hint: 'the page settling' },
    { key: 'pencil', label: 'pencil', hint: 'the margin note being written' },
    { key: 'typing', label: 'typing', hint: 'your own writing' },
    { key: 'burn', label: 'burn', hint: 'letting the letter go' },
    { key: 'light', label: 'light', hint: 'the match' },
    { key: 'rise', label: 'rise', hint: 'the lantern lifting off' },
  ]

  // The order of the "my choices" line: the existing order, with typing after pencil.
  const ORDER: Key[] = ['night', 'music', 'sky', 'paper', 'pencil', 'typing', 'burn', 'light', 'rise']

  // The engine's own mix object is the source of truth; this is a reactive copy of it.
  const levels = $state<Record<Key, number>>({ ...LEVEL })

  function readChoice(): RiseChoice {
    try {
      const saved = localStorage.getItem('dev:rise')
      if (saved === 'barn' || saved === 'large' || saved === 'medium') return saved
    } catch {
      // Use the default.
    }
    return RISE_DEFAULT
  }

  let choice = $state<RiseChoice>(readChoice())
  let soundIsOn = $state(true)
  let pencilLoop = $state<Loop | undefined>()
  let skyOn = $state(false)
  let copied = $state(false)

  function setLevel(key: Key, value: number) {
    levels[key] = value
    LEVEL[key] = value
  }

  function pickRise(next: RiseChoice) {
    choice = next
    try {
      localStorage.setItem('dev:rise', next)
    } catch {
      // It simply won't be remembered.
    }
  }

  function playRise(next: RiseChoice) {
    pickRise(next)
    void play('rise')
  }

  function togglePencil() {
    if (pencilLoop) {
      pencilLoop.stop()
      pencilLoop = undefined
    } else {
      pencilLoop = pencil()
    }
  }

  function toggleSky() {
    skyOn = !skyOn
    skyMusic(skyOn)
  }

  // Trimmed, not rounded to two places, so the sky pad's 0.035 is copied exactly.
  const summary = $derived(
    `chime=${choice} ` + ORDER.map((k) => `${k}=${Number(levels[k].toFixed(3))}`).join(' '),
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary)
      copied = true
      setTimeout(() => (copied = false), 1600)
    } catch {
      // The box is selectable; copying by hand works too.
    }
  }

  onMount(() => {
    const unsubscribe = onSound((on) => (soundIsOn = on))
    const uninstall = installSound()
    return () => {
      unsubscribe()
      uninstall()
      pencilLoop?.stop()
    }
  })
</script>

<main>
  <h1>Dear Sky · sound board</h1>
  <p class="lede">Click anywhere first: browsers only allow sound after a click.</p>

  <section class="card" aria-labelledby="night">
    <div class="row">
      <div class="name">
        <h2 id="night">night</h2>
        <p class="hint">the quiet bed under everything</p>
      </div>
      <button class="btn" class:primary={!soundIsOn} onclick={() => setSound(!soundIsOn)}>
        {soundIsOn ? 'Silence' : 'Play'}
      </button>
      <label class="slider">
        <span class="visually-hidden">night level</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={levels.night}
          oninput={(e) => setLevel('night', Number(e.currentTarget.value))}
        />
        <output>{levels.night.toFixed(2)}</output>
      </label>
    </div>
    <p class="note">
      The night starts itself on your first click. Silencing it turns every sound off (it is the app's global
      switch). The night's level only applies when it restarts: reload this page after changing it.
    </p>
  </section>

  <section class="card" aria-labelledby="music">
    <div class="row quiet">
      <div class="name">
        <h2 id="music">music</h2>
        <p class="hint">the piano under everything</p>
      </div>
      <label class="slider">
        <span class="visually-hidden">music level</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={levels.music}
          oninput={(e) => setLevel('music', Number(e.currentTarget.value))}
        />
        <output>{levels.music.toFixed(2)}</output>
      </label>
    </div>
    <p class="note">
      The music starts with the night on your first click. Its level only applies when it starts: reload this page
      after changing it.
    </p>
  </section>

  <section class="card" aria-labelledby="sky-pad">
    <div class="row">
      <div class="name">
        <h2 id="sky-pad">sky pad</h2>
        <p class="hint">joins the music on the sky</p>
      </div>
      <button class="btn" class:primary={skyOn} onclick={toggleSky}>
        {skyOn ? 'Stop' : 'Start'}
      </button>
      <label class="slider">
        <span class="visually-hidden">sky pad level</span>
        <input
          type="range"
          min="0"
          max="0.2"
          step="0.005"
          value={levels.sky}
          oninput={(e) => setLevel('sky', Number(e.currentTarget.value))}
        />
        <output>{levels.sky.toFixed(3)}</output>
      </label>
    </div>
    <p class="note">
      Start and stop it here to hear it. Its level only applies when it starts: stop and start it again to hear a new
      level.
    </p>
  </section>

  <section class="card" aria-labelledby="moments">
    <h2 id="moments" class="visually-hidden">moments</h2>
    {#each MOMENTS as m (m.key)}
      <div class="row">
        <div class="name">
          <h3>{m.label}</h3>
          <p class="hint">{m.hint}</p>
        </div>
        {#if m.key === 'pencil'}
          <button class="btn" class:primary={!!pencilLoop} onclick={togglePencil}>
            {pencilLoop ? 'Stop' : 'Start'}
          </button>
        {:else if m.key === 'typing'}
          <input
            class="typebox"
            type="text"
            placeholder="type here to hear it"
            aria-label="type here to hear it"
            oninput={() => typed()}
          />
        {:else}
          <button class="btn" onclick={() => void play(m.key as Moment)}>Play</button>
        {/if}
        <label class="slider">
          <span class="visually-hidden">{m.label} level</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={levels[m.key]}
            oninput={(e) => setLevel(m.key, Number(e.currentTarget.value))}
          />
          <output>{levels[m.key].toFixed(2)}</output>
        </label>
      </div>
    {/each}
  </section>

  <section class="card" aria-labelledby="chime">
    <h2 id="chime">the rise: pick a chime</h2>
    <p class="note first">
      Three chime swells for the lantern's rise. Play each in turn to compare, then keep the one you love.
      <strong>barn is the default.</strong> The rise level above applies to all three.
    </p>
    <div class="choices" role="radiogroup" aria-label="rise chime">
      {#each RISES as r (r)}
        <div class="choice" class:chosen={choice === r}>
          <label>
            <input type="radio" name="rise" value={r} checked={choice === r} onchange={() => pickRise(r)} />
            <span>{r}</span>
          </label>
          <button class="btn small" onclick={() => playRise(r)}>Play</button>
        </div>
      {/each}
    </div>
  </section>

  <section class="card" aria-labelledby="mine">
    <h2 id="mine">my choices</h2>
    <p class="note first">Copy this line and paste it to me.</p>
    <div class="copyrow">
      <input
        class="out"
        type="text"
        readonly
        value={summary}
        aria-label="current choices"
        onfocus={(e) => e.currentTarget.select()}
      />
      <button class="btn primary" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  </section>
</main>

<style>
  :global(body) {
    background: linear-gradient(to bottom, var(--sky-top), var(--sky-mid) 60%, var(--sky-low));
    background-attachment: fixed;
  }
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 16px 80px;
  }
  h1 {
    font-family: var(--font-ui);
    font-weight: 500;
    font-size: 2rem;
    margin: 0 0 6px;
    color: var(--ui);
  }
  h2,
  h3 {
    font-family: var(--font-ui);
    font-weight: 500;
    color: var(--ui);
    margin: 0;
  }
  h2 {
    font-size: 1.35rem;
  }
  h3 {
    font-size: 1.15rem;
  }
  .lede {
    margin: 0 0 24px;
    color: var(--essence-on-sky);
    font-family: var(--font-hand);
    font-size: 1.1rem;
  }
  .card {
    padding: 18px 22px;
    margin-bottom: 18px;
    border-radius: 16px;
    background: var(--button-bg);
    border: 1px solid oklch(0.8 0.04 270 / 0.16);
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.2fr);
    align-items: center;
    gap: 16px;
    padding: 10px 0;
  }
  .row + .row {
    border-top: 1px solid oklch(0.8 0.04 270 / 0.12);
  }
  .row.quiet {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  }
  .hint {
    margin: 0;
    color: var(--ui-soft);
    font-size: 0.95rem;
  }
  .note {
    margin: 6px 0 0;
    color: var(--ui-soft);
    font-size: 0.95rem;
    line-height: 1.5;
  }
  .note.first {
    margin: 4px 0 14px;
  }
  .note strong {
    color: var(--essence-on-sky);
    font-weight: 700;
  }
  .btn {
    font-family: var(--font-ui);
    font-size: 1rem;
    min-width: 5.5rem;
    padding: 9px 20px;
    border-radius: 999px;
    border: 1px solid var(--ui-line);
    background: var(--button-bg);
    color: var(--ui);
    cursor: pointer;
    white-space: nowrap;
  }
  .btn:hover {
    border-color: var(--flame);
  }
  .btn.primary {
    background: var(--flame);
    color: oklch(0.25 0.04 50);
    border-color: transparent;
    font-weight: 700;
  }
  .btn.small {
    padding: 6px 16px;
    min-width: 0;
  }
  .slider {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  input[type='range'] {
    flex: 1;
    min-width: 0;
    accent-color: var(--flame);
  }
  .typebox {
    font-family: var(--font-ui);
    font-size: 1rem;
    width: 100%;
    max-width: 14rem;
    padding: 9px 18px;
    border-radius: 999px;
    border: 1px solid var(--ui-line);
    background: var(--button-bg);
    color: var(--ui);
  }
  .typebox:focus-visible {
    outline: 2px solid var(--flame);
    outline-offset: 2px;
  }
  .typebox::placeholder {
    color: var(--ui-soft);
  }
  output {
    min-width: 2.6em;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--ui);
  }
  .choices {
    display: grid;
    gap: 10px;
  }
  .choice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 8px 8px 14px;
    border-radius: 12px;
    border: 1px solid oklch(0.8 0.04 270 / 0.14);
  }
  .choice.chosen {
    border-color: var(--ui-line);
    background: oklch(0.85 0.13 72 / 0.08);
  }
  .choice label {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    cursor: pointer;
    font-size: 1.1rem;
  }
  .choice input {
    accent-color: var(--flame);
    width: 18px;
    height: 18px;
  }
  .copyrow {
    display: flex;
    gap: 10px;
  }
  .out {
    flex: 1;
    min-width: 0;
    font: 1rem ui-monospace, 'Cascadia Code', Consolas, monospace;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--paper-rule);
    border-radius: 10px;
    padding: 10px 12px;
  }
  @media (max-width: 560px) {
    .row {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .row .slider {
      grid-column: 1 / -1;
    }
    .copyrow {
      flex-direction: column;
    }
  }
</style>
