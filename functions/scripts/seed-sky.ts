/**
 * Sends the seed lanterns through the same path as everyone's: each becomes a `pending`
 * lantern with uid "seed", and the lightLantern Function moderates it and publishes it.
 * They go one at a time, so later seeds can find earlier ones as kindred.
 *
 *   Emulators: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 bun scripts/seed-sky.ts
 *   Production: only with the user's say-so (PREP.md D32), with Admin credentials for the project.
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { SEED_UID, isLanternWords } from '../../src/lib/sky/lantern';
import { SEEDS } from './seeds';

const project = process.env.GCLOUD_PROJECT ?? 'hybridai-785bb';

if (!process.env.FIRESTORE_EMULATOR_HOST && process.env.DEAR_SKY_SEED_PRODUCTION !== '1') {
  console.error('Refusing to seed production. Set FIRESTORE_EMULATOR_HOST, or DEAR_SKY_SEED_PRODUCTION=1 on purpose.');
  process.exit(1);
}

initializeApp({ projectId: project });
const db = getFirestore();

const existing = await db.collection('sky').where('seed', '==', true).get();
const already = new Set(existing.docs.map((d) => d.data().essence as string));

let sent = 0;
for (const seed of SEEDS) {
  if (!isLanternWords(seed)) throw new Error(`seed does not fit the lantern shape: ${seed.essence}`);
  if (already.has(seed.essence)) continue;
  const ref = db.collection('pending').doc();
  await ref.set({ ...seed, uid: SEED_UID, createdAt: FieldValue.serverTimestamp() });
  // Wait until the Function has handled it, so the next seed can find it as kindred.
  let status: unknown;
  for (let i = 0; i < 60 && !status; i++) {
    status = (await ref.get()).data()?.status;
    if (!status) await new Promise((r) => setTimeout(r, 500));
  }
  if (status === 'risen') sent++;
  else console.warn(`${status ?? 'no answer for'}: ${seed.essence}`);
}
console.log(`seeded ${sent} lantern(s); ${already.size} were already up`);
