import { describe, expect, test } from 'bun:test';
import { SLOW_AFTER_MS, reduce, type Readiness, type ReadinessEvent } from '../src/lib/engine/readiness';

const run = (events: ReadinessEvent[], start: Readiness = { state: 'warming' }) => events.reduce(reduce, start);

describe('readiness', () => {
  test('a first-time visitor: download, load, ready', () => {
    expect(
      run([
        { type: 'availability', value: 'downloadable' },
        { type: 'progress', loaded: 0.4 },
        { type: 'progress', loaded: 0.2 }, // progress never goes backwards
      ]),
    ).toEqual({ state: 'downloading', progress: 0.4 });

    expect(
      run([
        { type: 'availability', value: 'downloadable' },
        { type: 'progress', loaded: 1 },
        { type: 'settled', ms: 900, ok: true },
      ]),
    ).toEqual({ state: 'ready' });
  });

  test('slow devices are "slow", not broken', () => {
    expect(run([{ type: 'settled', ms: SLOW_AFTER_MS + 1, ok: true }])).toEqual({ state: 'slow' });
  });

  test('a stall recovers when the prompt finally settles', () => {
    expect(run([{ type: 'stalled' }])).toEqual({ state: 'stalled' });
    expect(run([{ type: 'stalled' }, { type: 'settled', ms: 50_000, ok: true }])).toEqual({ state: 'slow' });
  });

  test('a prompt that fails while stalled sends it back to warming, so work-ahead can resume', () => {
    expect(run([{ type: 'stalled' }, { type: 'settled', ms: 120_000, ok: false }])).toEqual({ state: 'warming' });
  });

  test('a failed prompt does not change the state by itself', () => {
    expect(run([{ type: 'settled', ms: 100, ok: false }], { state: 'ready' })).toEqual({ state: 'ready' });
  });

  test('going idle means the next prompt will warm up again', () => {
    expect(run([{ type: 'idle' }], { state: 'ready' })).toEqual({ state: 'warming' });
    expect(run([{ type: 'idle' }], { state: 'stalled' })).toEqual({ state: 'stalled' });
  });

  test('unavailable sticks until a fresh availability check says otherwise', () => {
    const none = run([{ type: 'availability', value: 'unavailable' }]);
    expect(none).toEqual({ state: 'unavailable' });
    expect(run([{ type: 'settled', ms: 10, ok: true }, { type: 'progress', loaded: 0.5 }], none)).toEqual(none);
    expect(run([{ type: 'availability', value: 'available' }], none)).toEqual({ state: 'warming' });
  });
});
