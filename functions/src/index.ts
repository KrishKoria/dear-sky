/**
 * Dear Sky's server side (PREP.md D15, D16, D32).
 *
 * `lightLantern` runs for every new `pending/{id}`: the three approved words, written by the
 * app with the writer's anonymous uid. It checks them again (the app's own check can be
 * skipped by a modified client), finds kindred lanterns, and publishes `sky/{id}` with the
 * words, the kindred ids and nothing that points to the writer. Only this Function writes
 * to `sky`; the Firestore rules refuse everyone else.
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { KINDRED_POOL, isLanternWords, type SkyLantern } from '../../src/lib/sky/lantern';
import { getJudge } from './judge';

// Firestore is in nam5; its triggers run in us-central1. A few instances are plenty, and cap the cost.
setGlobalOptions({ region: 'us-central1', maxInstances: 5 });

initializeApp();
const db = getFirestore();

/** The uid the seed script writes with. The rules make it impossible for anyone else to use. */
export const SEED_UID = 'seed';

/** Thrown when Gemini couldn't be reached: the event is retried rather than published unchecked. */
class TryAgainLater extends Error {}

export const lightLantern = onDocumentCreated(
  { document: 'pending/{id}', timeoutSeconds: 60, retry: true },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const id = event.params.id;
    const data = snap.data();
    if (data.status) return; // already handled (a retried event)

    const words = { feeling: data.feeling, essence: data.essence, motif: data.motif };
    if (!isLanternWords(words)) {
      await snap.ref.update({ status: 'held' });
      return;
    }

    const judge = getJudge();
    const verdict = await judge.moderate(words);
    if (verdict === 'held') {
      await snap.ref.update({ status: 'held' });
      return;
    }
    if (verdict === 'unchecked') {
      logger.warn('moderation unavailable; will retry', { id });
      throw new TryAgainLater(`moderation unavailable for ${id}`);
    }

    const recent = await db.collection('sky').orderBy('createdAt', 'desc').limit(KINDRED_POOL).get();
    const candidates: SkyLantern[] = recent.docs
      .filter((d) => d.id !== id)
      .map((d) => {
        const c = d.data();
        return { id: d.id, feeling: c.feeling, essence: c.essence, motif: c.motif, kindred: c.kindred ?? [], seed: !!c.seed };
      });
    const kindred = await judge.kindred(words, candidates);

    try {
      await db.collection('sky').doc(id).create({
        feeling: words.feeling,
        essence: words.essence,
        motif: words.motif,
        kindred,
        seed: data.uid === SEED_UID,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      // ALREADY_EXISTS: a retried event got here before; the lantern is already up.
      if ((e as { code?: number }).code !== 6) throw e;
    }
    await snap.ref.update({ status: 'risen', kindred });
  },
);
