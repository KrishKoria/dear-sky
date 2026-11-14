/**
 * Dear Sky's server side (PREP.md D15, D16, D32).
 *
 * `lightLantern` runs for every new `pending/{id}`: the three approved words, written by the
 * app with the writer's anonymous uid. It checks them again (the app's own check can be
 * skipped by a modified client), finds kindred lanterns, and publishes `sky/{id}` with the
 * words, their glyph (D13), the kindred ids and nothing that points to the writer. Only this
 * Function writes to `sky`; the Firestore rules refuse everyone else.
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { KINDRED_POOL, SEED_UID, isLanternWords, type PendingStatus, type SkyLantern } from '../../src/lib/sky/lantern';
import { isGlyph, matchGlyph } from '../../src/lib/sky/recipe';
import { getJudge } from './judge';

// Firestore is in nam5; its triggers run in us-central1. A few instances are plenty, and cap the cost.
setGlobalOptions({ region: 'us-central1', maxInstances: 5 });

initializeApp();
const db = getFirestore();

/**
 * How long moderation may stay unavailable before the lantern is given up as `unlit`. Retries run
 * about once a minute and each one bills Gemini calls, so a permanent fault (a revoked key, a
 * disabled API) must not loop for the 7 days Cloud Functions retries for. Long enough to ride out
 * a real outage. The emulator's fake outage gives up at once, so tests need not wait.
 */
const GIVE_UP_AFTER_MS = process.env.DEAR_SKY_FAKE_AI === '1' ? 0 : 30 * 60_000;

/** Most of the writer's own lantern ids that are looked up (ids only); see `ownLanterns`. */
const OWN_LOOKUP_MAX = 100;

/** Thrown when Gemini couldn't be reached: the event is retried rather than published unchecked. */
class TryAgainLater extends Error {}

export const lightLantern = onDocumentCreated(
  { document: 'pending/{id}', timeoutSeconds: 60, retry: true },
  async (event) => {
    if (!event.data) return;
    const id = event.params.id;
    // `event.data` is the snapshot as created and never has a status; re-read for a retried event.
    const live = await event.data.ref.get();
    const data = live.data();
    if (!data || data.status) return; // gone, or already handled

    const words = { feeling: data.feeling, essence: data.essence, motif: data.motif };
    if (!isLanternWords(words)) {
      await live.ref.update({ status: 'held' });
      return;
    }

    // "Others carry this too" has to mean others: the writer's own earlier lanterns are never
    // their kindred. Only this Function can tell, from the uid kept privately on `pending`;
    // the sky itself never learns it. Seeds share one uid but are all different voices.
    // Read while the model thinks; the sky only needs these if the words are clear.
    const pool = (async () => {
      const own = data.uid === SEED_UID ? new Set<string>() : await ownLanterns(data.uid);
      const recent = await db
        .collection('sky')
        .orderBy('createdAt', 'desc')
        .limit(KINDRED_POOL + Math.min(own.size, KINDRED_POOL))
        .get();
      return recent.docs
        .filter((d) => d.id !== id && !own.has(d.id))
        .slice(0, KINDRED_POOL)
        .map((d): SkyLantern => {
          const c = d.data();
          return { id: d.id, feeling: c.feeling, essence: c.essence, motif: c.motif, kindred: c.kindred ?? [], seed: !!c.seed };
        });
    })();
    pool.catch(() => {}); // not awaited on the early returns below; the await further down still throws

    const judge = getJudge();
    const verdict = await judge.moderate(words);
    if (verdict === 'held') {
      await live.ref.update({ status: 'held' });
      return;
    }
    if (verdict === 'unchecked') {
      if (Date.now() - live.createTime!.toMillis() >= GIVE_UP_AFTER_MS) {
        logger.error('moderation unavailable for too long; giving up on it', { id });
        await live.ref.update({ status: 'unlit' satisfies PendingStatus });
        return;
      }
      logger.warn('moderation unavailable; will retry', { id });
      throw new TryAgainLater(`moderation unavailable for ${id}`);
    }

    const kindred = await judge.kindred(words, await pool);

    let kindredUp = kindred;
    try {
      await db.collection('sky').doc(id).create({
        feeling: words.feeling,
        essence: words.essence,
        motif: words.motif,
        // The writer's device painted it from these words; a lantern sent without one (seeds,
        // older outboxes) gets the same word match the app would draw.
        glyph: isGlyph(data.glyph) ? data.glyph : matchGlyph(words),
        kindred,
        seed: data.uid === SEED_UID,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      // ALREADY_EXISTS: a retried event got here before; the lantern is already up, with the
      // kindred it was published with, so that is what `pending` must say too.
      if ((e as { code?: number }).code !== 6) throw e;
      kindredUp = (await db.collection('sky').doc(id).get()).data()?.kindred ?? [];
    }
    await live.ref.update({ status: 'risen' satisfies PendingStatus, kindred: kindredUp });
  },
);

/** The ids of every lantern this writer has sent (ids only: no words are read). */
async function ownLanterns(uid: unknown): Promise<Set<string>> {
  if (typeof uid !== 'string' || !uid) return new Set();
  // Only the sky's newest few dozen can be in the pool, but `pending` has no order to pick them
  // by without an index, so this is a generous bound rather than the exact newest.
  const sent = await db.collection('pending').where('uid', '==', uid).limit(OWN_LOOKUP_MAX).select().get();
  return new Set(sent.docs.map((d) => d.id));
}
