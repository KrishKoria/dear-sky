import { describe, expect, test } from 'bun:test';
import { JobTimeoutError, Priority, SerialQueue } from '../src/lib/engine/queue';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('SerialQueue', () => {
  test('runs one job at a time', async () => {
    const q = new SerialQueue();
    let running = 0;
    let maxRunning = 0;
    const job = () => ({
      label: 'j',
      priority: Priority.user,
      stallAfterMs: 1_000,
      run: async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await sleep(5);
        running--;
      },
    });
    await Promise.all([q.enqueue(job()), q.enqueue(job()), q.enqueue(job())]);
    expect(maxRunning).toBe(1);
  });

  test('higher priority jumps the line; same priority stays first come, first served', async () => {
    const q = new SerialQueue();
    const order: string[] = [];
    const job = (label: string, priority: Priority, ms = 0) => ({
      label,
      priority,
      stallAfterMs: 1_000,
      run: async () => {
        order.push(label);
        await sleep(ms);
      },
    });
    const first = q.enqueue(job('running', Priority.background, 10)); // starts at once
    const rest = [
      q.enqueue(job('essence', Priority.background)),
      q.enqueue(job('safety', Priority.user)),
      q.enqueue(job('reflection', Priority.user)),
    ];
    await Promise.all([first, ...rest]);
    expect(order).toEqual(['running', 'safety', 'reflection', 'essence']);
  });

  test('a stall is reported but the result still arrives', async () => {
    const stalls: string[] = [];
    const q = new SerialQueue({ onStall: (l) => stalls.push(l) });
    const result = await q.enqueue({
      label: 'slow',
      priority: Priority.user,
      stallAfterMs: 5,
      run: async () => {
        await sleep(20);
        return 'late but here';
      },
    });
    expect(stalls).toEqual(['slow']);
    expect(result).toBe('late but here');
  });

  test('a prompt that never settles is given up on, and the next job still runs', async () => {
    const settled: [string, boolean][] = [];
    const q = new SerialQueue({ onSettle: (l, _ms, ok) => settled.push([l, ok]) });
    const hung = q.enqueue({
      label: 'hung',
      priority: Priority.user,
      stallAfterMs: 1_000,
      timeoutMs: 15,
      run: () => new Promise<string>(() => {}),
    });
    const after = q.enqueue({ label: 'next', priority: Priority.user, stallAfterMs: 1_000, run: async () => 'fine' });
    await expect(hung).rejects.toBeInstanceOf(JobTimeoutError);
    expect(await after).toBe('fine');
    expect(settled).toEqual([['hung', false], ['next', true]]);
  });

  test('an answer that arrives after the ceiling is dropped', async () => {
    const q = new SerialQueue();
    const late = q.enqueue({
      label: 'late',
      priority: Priority.user,
      stallAfterMs: 1_000,
      timeoutMs: 5,
      run: async () => {
        await sleep(30);
        return 'too late';
      },
    });
    await expect(late).rejects.toThrow('no answer');
    await sleep(40); // nothing else to see: no second settle, no unhandled rejection
  });

  test('failures reach the caller and the queue keeps going', async () => {
    const settled: [string, boolean][] = [];
    const q = new SerialQueue({ onSettle: (l, _ms, ok) => settled.push([l, ok]) });
    const failing = q.enqueue({
      label: 'sync-throw',
      priority: Priority.user,
      stallAfterMs: 1_000,
      run: () => {
        throw new Error('boom');
      },
    });
    const after = q.enqueue({ label: 'next', priority: Priority.user, stallAfterMs: 1_000, run: async () => 42 });
    await expect(failing).rejects.toThrow('boom');
    expect(await after).toBe(42);
    expect(settled).toEqual([['sync-throw', false], ['next', true]]);
  });
});

test('a job that never stalls is never reported as stalled', async () => {
  const stalled: string[] = [];
  const queue = new SerialQueue({ onStall: (label) => stalled.push(label) });
  await queue.enqueue({
    label: 'forever',
    priority: Priority.background,
    stallAfterMs: Number.POSITIVE_INFINITY,
    run: () => new Promise((r) => setTimeout(r, 20)),
  });
  expect(stalled).toEqual([]);
});
