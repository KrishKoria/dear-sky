/**
 * Dev only: measures the real engine's warm-up from the page's side (PREP.md §6 week 1).
 * Logs `[probe]` lines: readiness changes, the first gesture, main-thread long tasks and
 * frame gaps. Long tasks mean our JS blocked; frame gaps without long tasks mean the
 * compositor/GPU stalled (e.g. the model loading onto the GPU).
 * `?still` in the URL pauses every CSS animation, to compare against the moving sky.
 */
import type { OnDeviceEngine } from '../engine/types';

const GAP_MS = 250;

export function watch(engine: OnDeviceEngine): void {
  const t0 = performance.now();
  const at = () => `+${((performance.now() - t0) / 1000).toFixed(1)}s`;
  const log = (...parts: unknown[]) => console.log('[probe]', at(), ...parts);

  const still = new URLSearchParams(location.search).has('still');
  if (still) {
    const style = document.createElement('style');
    style.textContent = '*, *::before, *::after { animation-play-state: paused !important; }';
    document.head.append(style);
  }
  log(still ? 'animations paused (?still)' : 'animations running');

  let last = '';
  engine.readiness.subscribe((r) => {
    const label = r.state === 'downloading' ? `downloading ${Math.round(r.progress * 100)}%` : r.state;
    if (label !== last) log('readiness', (last = label));
  });

  const firstGesture = (e: Event) => log('first gesture', e.type);
  addEventListener('pointerdown', firstGesture, { once: true, capture: true });
  addEventListener('keydown', firstGesture, { once: true, capture: true });

  let longTotal = 0;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      longTotal += e.duration;
      if (e.duration >= 200) log('long task', Math.round(e.duration), 'ms');
    }
  }).observe({ type: 'longtask', buffered: true });

  let gapTotal = 0;
  let prev = performance.now();
  const frame = (now: number) => {
    // rAF stops in hidden tabs; only gaps while visible are stalls.
    if (document.visibilityState === 'visible' && now - prev > GAP_MS) {
      gapTotal += now - prev;
      log('frame gap', Math.round(now - prev), 'ms');
    }
    prev = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => (prev = performance.now()));

  (window as unknown as { probe: () => void }).probe = () =>
    log('totals: long tasks', Math.round(longTotal), 'ms · frame gaps', Math.round(gapTotal), 'ms');
}
