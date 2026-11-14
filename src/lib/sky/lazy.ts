/**
 * The shared sky's code, fetched on first use. It carries Firestore and Auth, which the writing
 * page never needs, so it stays out of the first download (the app preloads it once idle).
 */
import { outboxSize } from '../local/db';
import type { LanternStatus } from './lantern';

type SkyModule = typeof import('./sky');

export function lazySky(
  load: () => Promise<SkyModule> = () => import('./sky'),
  waiting: () => Promise<number> = outboxSize,
) {
  return {
    async release(...args: Parameters<SkyModule['release']>): ReturnType<SkyModule['release']> {
      return (await load()).release(...args);
    },

    /** Same as `watch` in sky.ts, but safe to stop before the code has arrived. */
    watch(id: string, onStatus: (status: LanternStatus, kindred: string[]) => void): () => void {
      let stop: (() => void) | undefined;
      let stopped = false;
      void load().then((m) => {
        if (!stopped) stop = m.watch(id, onStatus);
      });
      return () => {
        stopped = true;
        stop?.();
      };
    },

    /** A visit with nothing waiting never loads the sky at all. */
    async sendWaiting(): Promise<void> {
      if ((await waiting()) > 0) await (await load()).sendWaiting();
    },
  };
}

export const sky = lazySky();
