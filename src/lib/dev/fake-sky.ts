/**
 * Dev only (`?sky=fake`): a stand-in for the shared sky and the cloud check, so the lighting,
 * the rise and the postmark can be walked without sending a test lantern to the real sky.
 * Every release clears, rises a moment later and finds two kindred.
 */
import type { Moderation } from '../cloud/moderation';
import type { LanternStatus } from '../sky/sky';

export const fakeCheck = async (): Promise<Moderation> => 'clear';

export const fakeSky = {
  async release(): Promise<string> {
    await new Promise((r) => setTimeout(r, 300));
    return `fake-${Date.now()}`;
  },
  watch(_id: string, onStatus: (status: LanternStatus, kindred: string[]) => void): () => void {
    const timer = setTimeout(() => onStatus('risen', ['kindred-a', 'kindred-b']), 900);
    return () => clearTimeout(timer);
  },
};
