/**
 * Sound (D42 step 3, D46): a quiet night under everything, and a few real sounds at the ritual
 * moments. Real recordings only (CC0, picked by ear; credits in design/sound-shortlist.md),
 * never synthesised.
 *
 * - Nothing plays until the first click or key (Chrome blocks audio before a gesture); then the
 *   night fades in.
 * - One visible switch turns it all on or off, and the choice is remembered on this device.
 * - Every file is at the same loudness (-23 LUFS), so `LEVEL` below is the whole mix: tune by
 *   ear there, not in the files.
 * - The night and the pencil loop by crossfading two copies, so there's never a seam or a gap.
 * - A hidden tab goes quiet.
 * - Music (D47): a soft felt-piano piece under everything, and on the sky a warm pad fades in
 *   beneath it, so the sky "opens up", the way games layer a score. Both are long, so they stream
 *   from <audio> elements (decoding minutes of audio would hold ~80 MB in memory) through the
 *   same switch and levels. They share a key (B major / G# minor), so they never clash.
 */

const FILES = {
  night: 'night.m4a',
  paper: 'paper.m4a',
  pencil: 'pencil.m4a',
  burn: 'burn.m4a',
  light: 'light.m4a',
  'rise-barn': 'rise-barn.m4a',
  'rise-large': 'rise-large.m4a',
  'rise-medium': 'rise-medium.m4a',
} as const;
type File = keyof typeof FILES;

/** Long pieces, streamed rather than decoded. */
const STREAMS = { music: 'music.m4a', sky: 'sky-pad.m4a' } as const;
type Stream = keyof typeof STREAMS;

export type Moment = 'paper' | 'burn' | 'light' | 'rise';
export type RiseChoice = 'barn' | 'large' | 'medium';

/** The mix, set by the user by ear on the sound board (2026-11-14). */
export const LEVEL = {
  night: 0.05,
  paper: 0.15,
  pencil: 0.1,
  burn: 0.25,
  light: 0.25,
  rise: 0.2,
  /** Your own writing: softer than the helper's pencil (user, 2026-11-14). */
  typing: 0.06,
  /** The piano under everything, and the pad that joins it on the sky (the user found both loud). */
  music: 0.08,
  sky: 0.035,
};

/**
 * Where a moment's sound ends, so it ends with its moment (user, 2026-11-14): the burn as the
 * burning edge reaches the top of the page (Burn.svelte's sweep ends at 3.9 s), the chime as the
 * lantern finishes rising (3.2 s). Seconds before the fade starts, and how long it fades.
 */
const SHAPE: Partial<Record<Moment, { fadeAfter: number; fade: number }>> = {
  burn: { fadeAfter: 3.4, fade: 0.8 },
  rise: { fadeAfter: 1.8, fade: 1.4 },
};

/** Which chime swell the rise uses: the barn chime, chosen by ear (dev: localStorage 'dev:rise'). */
export const RISE_DEFAULT: RiseChoice = 'barn';

const STORE = 'dear-sky:sound';
/** How long the night takes to come in, and the crossfade of each loop. */
const NIGHT_IN = 5;
const NIGHT_XFADE = 4;
const PENCIL_XFADE = 1;

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let on = remembered();
const buffers = new Map<File, Promise<AudioBuffer | undefined>>();
const listeners = new Set<(on: boolean) => void>();

function remembered(): boolean {
  try {
    return localStorage.getItem(STORE) !== 'off';
  } catch {
    return true;
  }
}

/** Listens for the first gesture, and quiets a hidden tab. Call once, when the app mounts. */
export function installSound(): () => void {
  const wake = () => {
    window.removeEventListener('pointerdown', wake, true);
    window.removeEventListener('keydown', wake, true);
    start();
  };
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);
  const hide = () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  };
  document.addEventListener('visibilitychange', hide);
  return () => {
    window.removeEventListener('pointerdown', wake, true);
    window.removeEventListener('keydown', wake, true);
    document.removeEventListener('visibilitychange', hide);
  };
}

function start() {
  if (ctx || typeof AudioContext === 'undefined') return;
  try {
    ctx = new AudioContext();
  } catch {
    return; // No audio here; the app is the same without it.
  }
  master = ctx.createGain();
  master.gain.value = on ? 1 : 0;
  master.connect(ctx.destination);
  for (const name of Object.keys(FILES) as File[]) void load(name);
  loop('night', LEVEL.night, NIGHT_XFADE, NIGHT_IN);
  stream('music', LEVEL.music, MUSIC_XFADE, MUSIC_IN);
  if (skyWanted) skyLayer = stream('sky', LEVEL.sky, MUSIC_XFADE, SKY_IN);
}

/** How long the music takes to come in, the pad to join on the sky, and their loop crossfade. */
const MUSIC_IN = 10;
const SKY_IN = 4;
const SKY_OUT = 2.5;
const MUSIC_XFADE = 8;
let skyLayer: Loop | undefined;
let skyWanted = false;

/** The sky's pad: in while the shared sky is open, out as it closes. */
export function skyMusic(open: boolean) {
  skyWanted = open;
  if (open) {
    if (ctx && !skyLayer) skyLayer = stream('sky', LEVEL.sky, MUSIC_XFADE, SKY_IN);
  } else {
    skyLayer?.stop(SKY_OUT);
    skyLayer = undefined;
  }
}

/**
 * A long piece, looped by two <audio> elements taking turns: as one nears its end, the other
 * starts from the top and they crossfade, so there's never a seam.
 */
function stream(name: Stream, level: number, xfade: number, fadeIn: number): Loop {
  if (!ctx || !master) return { stop() {} };
  const audio = ctx;
  const out = master;
  const url = `${import.meta.env.BASE_URL}sounds/${STREAMS[name]}`;
  const pair = [0, 1].map(() => {
    const el = new Audio(url);
    el.preload = 'auto';
    const gain = audio.createGain();
    gain.gain.value = 0;
    audio.createMediaElementSource(el).connect(gain).connect(out);
    return { el, gain };
  });
  let current = 0;

  const ramp = (i: number, to: number, seconds: number) => {
    const g = pair[i].gain.gain;
    const now = audio.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to, now + seconds);
  };
  const begin = (i: number, seconds: number) => {
    pair[i].el.currentTime = 0;
    void pair[i].el.play().catch(() => {});
    ramp(i, level, seconds);
  };
  const rest = (i: number, seconds: number) => {
    ramp(i, 0, seconds);
    setTimeout(() => pair[i].el.pause(), seconds * 1000 + 100);
  };

  begin(0, fadeIn);
  const watch = setInterval(() => {
    const el = pair[current].el;
    if (!Number.isFinite(el.duration) || el.paused) return;
    if (el.duration - el.currentTime <= xfade) {
      rest(current, xfade);
      current = 1 - current;
      begin(current, xfade);
    }
  }, 250);

  return {
    stop(fade = 1.5) {
      clearInterval(watch);
      rest(0, fade);
      rest(1, fade);
    },
  };
}

function load(name: File): Promise<AudioBuffer | undefined> {
  let buffer = buffers.get(name);
  if (!buffer) {
    const audio = ctx!;
    buffer = fetch(`${import.meta.env.BASE_URL}sounds/${FILES[name]}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => audio.decodeAudioData(data))
      .catch(() => undefined);
    buffers.set(name, buffer);
  }
  return buffer;
}

export function soundOn(): boolean {
  return on;
}

/** Follows the switch; called at once with where it is now. */
export function onSound(listener: (on: boolean) => void): () => void {
  listeners.add(listener);
  listener(on);
  return () => listeners.delete(listener);
}

export function setSound(next: boolean) {
  on = next;
  try {
    localStorage.setItem(STORE, next ? 'on' : 'off');
  } catch {
    // Private modes can refuse; it simply won't be remembered.
  }
  if (!ctx) start();
  if (ctx && master) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(next ? 1 : 0, now + (next ? 1.2 : 0.4));
    if (next) void ctx.resume();
  }
  for (const l of listeners) l(next);
}

function riseFile(): File {
  let choice: string | null = null;
  if (import.meta.env.DEV) {
    try {
      choice = localStorage.getItem('dev:rise');
    } catch {
      // Use the default.
    }
  }
  const pick = choice === 'barn' || choice === 'large' || choice === 'medium' ? choice : RISE_DEFAULT;
  return `rise-${pick}`;
}

/**
 * Plays a moment once. `fadeAfter` cuts it short, fading out over `fade` seconds, so a sound
 * ends with its moment. Muted, or before the first gesture, nothing plays.
 */
export async function play(moment: Moment, shape: { fadeAfter?: number; fade?: number } = {}) {
  if (!ctx || !master || !on) return;
  const { fadeAfter, fade = 0.6 } = { ...SHAPE[moment], ...shape };
  const name: File = moment === 'rise' ? riseFile() : moment;
  const buffer = await load(name);
  if (!buffer || !ctx || !master) return;
  const at = ctx.currentTime;
  const level = LEVEL[moment];
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = buffer;
  gain.gain.value = level;
  src.connect(gain).connect(master);
  // Start before stop: a source that hasn't started refuses a stop, and the sound never plays.
  src.start(at);
  if (fadeAfter !== undefined && fadeAfter < buffer.duration) {
    gain.gain.setValueAtTime(level, at + fadeAfter);
    gain.gain.linearRampToValueAtTime(0, at + fadeAfter + fade);
    src.stop(at + fadeAfter + fade + 0.05);
  }
}

export interface Loop {
  /** Fades it out over `fade` seconds, then it's gone. */
  stop(fade?: number): void;
}

/** Quiet this long after the last key, and your pencil lifts. */
const TYPING_REST_MS = 450;
let writing: Loop | undefined;
let restTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Your own pencil: call on every keystroke in the letter. It starts at a different place in the
 * scratch each time, so it never repeats, and lifts softly when you pause.
 */
export function typed() {
  if (!ctx || !on) return;
  writing ??= loop('pencil', LEVEL.typing, PENCIL_XFADE, 0.12, Math.random());
  clearTimeout(restTimer);
  restTimer = setTimeout(() => {
    writing?.stop(0.35);
    writing = undefined;
  }, TYPING_REST_MS);
}

/** The pencil, for as long as the margin note is being written. */
export function pencil(): Loop {
  if (!ctx || !on) return { stop() {} };
  return loop('pencil', LEVEL.pencil, PENCIL_XFADE, 0.3);
}

/**
 * Plays a file over and over, each copy crossfading into the next, so it never seams. Each copy
 * is scheduled on the audio clock just before it's needed.
 */
function loop(name: File, level: number, xfade: number, fadeIn: number, from = 0): Loop {
  const voices = new Set<{ src: AudioBufferSourceNode; gain: GainNode }>();
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | undefined;

  /** `from`: how far into the clip the first copy starts, as a fraction of it. */
  const voice = async (at: number, rampIn: number, from = 0) => {
    const buffer = await load(name);
    if (!alive || !buffer || !ctx || !master) return;
    const start = Math.max(at, ctx.currentTime);
    const offset = Math.min(from, 0.7) * buffer.duration;
    const end = start + buffer.duration - offset;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + rampIn);
    gain.gain.setValueAtTime(level, end - xfade);
    gain.gain.linearRampToValueAtTime(0, end);
    src.connect(gain).connect(master);
    src.start(start, offset);
    src.stop(end);
    const v = { src, gain };
    voices.add(v);
    src.onended = () => voices.delete(v);
    const next = end - xfade;
    timer = setTimeout(() => void voice(next, xfade), Math.max(0, (next - ctx.currentTime - 1) * 1000));
  };
  void voice(ctx?.currentTime ?? 0, fadeIn, from);

  return {
    stop(fade = 0.8) {
      alive = false;
      clearTimeout(timer);
      if (!ctx) return;
      const now = ctx.currentTime;
      for (const { src, gain } of voices) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + fade);
        try {
          src.stop(now + fade + 0.05);
        } catch {
          // Already stopped.
        }
      }
    },
  };
}
