import { describe, expect, test } from 'bun:test';
import { Priority, SerialQueue } from '../src/lib/engine/queue';

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
    const first = q.enqueue(job('running', Priority.idle, 10)); // starts at once
    const rest = [
      q.enqueue(job('essence', Priority.background)),
      q.enqueue(job('safety', Priority.user)),
      q.enqueue(job('reflection', Priority.user)),
      q.enqueue(job('heartbeat', Priority.idle)),
    ];
    await Promise.all([first, ...rest]);
    expect(order).toEqual(['running', 'safety', 'reflection', 'essence', 'heartbeat']);
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
    priority: Priority.idle,
    stallAfterMs: Number.POSITIVE_INFINITY,
    run: () => new Promise((r) => setTimeout(r, 20)),
  });
  expect(stalled).toEqual([]);
});
