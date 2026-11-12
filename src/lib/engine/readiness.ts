/**
 * Readiness of the on-device model, as a pure reducer (PREP.md §4, D9, D17).
 * Every state has a designed look (DESIGN.md §4b). Offline is tracked separately:
 * it changes what the cloud can do, not what the on-device model can do.
 */

export type Readiness =
  | { state: 'unavailable' }
  | { state: 'downloading'; progress: number } // 0..1, real progress from Chrome
  | { state: 'warming' } // on disk, loading (a cold load can take minutes)
  | { state: 'ready' }
  | { state: 'slow' } // works, but slowly: the margin handwriting writes slower
  | { state: 'stalled' }; // a prompt ran past its stall time; it may still finish

/** Chrome's `LanguageModel.availability()` values. */
export type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

export type ReadinessEvent =
  | { type: 'availability'; value: Availability }
  | { type: 'progress'; loaded: number }
  | { type: 'stalled' }
  | { type: 'settled'; ms: number; ok: boolean }
  /** No prompt for a while: Chrome unloads the model about 5 minutes after the last one. */
  | { type: 'idle' };

/** A settled prompt slower than this means the device is "slow". Tune with real data (PREP.md D21). */
export const SLOW_AFTER_MS = 12_000;
/** Chrome unloaded the model ~5 min after the last prompt (PREP.md §3b, §3b-2). */
export const IDLE_UNLOAD_MS = 5 * 60_000;

export const initialReadiness: Readiness = { state: 'warming' };

export function reduce(current: Readiness, event: ReadinessEvent): Readiness {
  if (current.state === 'unavailable') {
    // Only a fresh availability check can bring it back.
    return event.type === 'availability' && event.value !== 'unavailable'
      ? reduce({ state: 'warming' }, event)
      : current;
  }

  switch (event.type) {
    case 'availability':
      switch (event.value) {
        case 'unavailable':
          return { state: 'unavailable' };
        case 'downloadable':
        case 'downloading':
          return current.state === 'downloading' ? current : { state: 'downloading', progress: 0 };
        case 'available':
          return current.state === 'downloading' ? { state: 'warming' } : current;
      }
      return current;

    case 'progress': {
      if (event.loaded >= 1) return { state: 'warming' };
      const before = current.state === 'downloading' ? current.progress : 0;
      return { state: 'downloading', progress: Math.max(before, event.loaded) };
    }

    case 'stalled':
      return { state: 'stalled' };

    case 'settled':
      if (!event.ok) return current; // the engine decides whether a failure means "unavailable"
      return { state: event.ms > SLOW_AFTER_MS ? 'slow' : 'ready' };

    case 'idle':
      return current.state === 'ready' || current.state === 'slow' ? { state: 'warming' } : current;
  }
}
