import { describe, expect, test } from 'bun:test';
import { Pacer, pauseAfter, splitWords } from '../src/lib/ui/pacer';

/** A manual clock: run() fires the next scheduled callback. */
function manualClock() {
  const queue: Array<{ fn: () => void; ms: number }> = [];
  return {
    schedule: (fn: () => void, ms: number) => {
      const item = { fn, ms };
      queue.push(item);
      return item;
    },
    cancelSchedule: (h: unknown) => {
      const i = queue.indexOf(h as (typeof queue)[number]);
      if (i >= 0) queue.splice(i, 1);
    },
    run() {
      const next = queue.shift();
      next?.fn();
      return next?.ms;
    },
    get pending() {
      return queue.length;
    },
  };
}

function pacerWith(clock: ReturnType<typeof manualClock>, words: string[], done?: () => void) {
  return new Pacer({
    msPerWord: () => 100,
    onWord: (w) => words.push(w),
    onDone: done,
    schedule: clock.schedule,
    cancelSchedule: clock.cancelSchedule,
  });
}

describe('splitWords', () => {
  test('keeps whitespace with each word', () => {
    expect(splitWords('a b  c')).toEqual(['a ', 'b  ', 'c']);
    expect(splitWords('')).toEqual([]);
  });
});

describe('pauseAfter', () => {
  test('sentences breathe longer than commas, commas longer than words', () => {
    expect(pauseAfter('end. ')).toBeGreaterThan(pauseAfter('pause, '));
    expect(pauseAfter('pause, ')).toBeGreaterThan(pauseAfter('word '));
    expect(pauseAfter('quoted."')).toBe(pauseAfter('end.'));
  });
});

describe('Pacer', () => {
  test('releases one word per tick and never a half-streamed word', () => {
    const clock = manualClock();
    const words: string[] = [];
    const pacer = pacerWith(clock, words);
    pacer.push('you wr');
    expect(words).toEqual(['you ']);
    pacer.push('ite with');
    clock.run();
    expect(words).toEqual(['you ', 'write ']);
    clock.run();
    expect(words).toEqual(['you ', 'write ']); // "with" may still grow
    pacer.push(' care.');
    expect(words).toEqual(['you ', 'write ', 'with ']);
  });

  test('a whole reflection at once is still written word by word', () => {
    const clock = manualClock();
    const words: string[] = [];
    pacerWith(clock, words).push('one two three ');
    expect(words).toEqual(['one ']);
    clock.run();
    clock.run();
    expect(words).toEqual(['one ', 'two ', 'three ']);
  });

  test('end() releases the last word, then reports done once', () => {
    const clock = manualClock();
    const words: string[] = [];
    let done = 0;
    const pacer = pacerWith(clock, words, () => done++);
    pacer.push('last');
    expect(words).toEqual([]);
    pacer.end();
    expect(words).toEqual(['last']);
    clock.run();
    expect(done).toBe(1);
    pacer.end();
    expect(done).toBe(1);
  });

  test('stops after a sentence take longer', () => {
    const clock = manualClock();
    const pacer = pacerWith(clock, []);
    pacer.push('done. next ');
    expect(clock.run()).toBe(260);
    expect(clock.run()).toBe(100);
  });

  test('stop() cancels everything pending', () => {
    const clock = manualClock();
    const words: string[] = [];
    const pacer = pacerWith(clock, words);
    pacer.push('a b c ');
    pacer.stop();
    expect(clock.pending).toBe(0);
    pacer.push('d ');
    expect(words).toEqual(['a ']);
  });
});
