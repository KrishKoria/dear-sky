/**
 * The shared sky, from the app's side (PREP.md D32).
 *
 * - `release` writes only approved words to `pending/{id}`, with this device's anonymous uid,
 *   and remembers the id on the device. The cloud never learns which lanterns are "yours".
 * - `watch` follows that pending lantern until the Function has moderated it.
 * - `loadSky` returns yours, their kindred, and the newest others, up to SKY_MAX.
 *
 * With VITE_EMULATORS=1 (`bun run dev:emu`), everything talks to the local emulators.
 */
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  documentId,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { app } from '../firebase';
import { LANTERNS, openLocal } from '../local/db';
import type { ApprovedWords } from '../privacy/release';
import type { SkyLantern } from './lantern';

export const SKY_MAX = 60;

let services: { auth: Auth; db: Firestore } | undefined;

function connect() {
  if (services) return services;
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (import.meta.env.VITE_EMULATORS === '1') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  services = { auth, db };
  return services;
}

async function signedIn(): Promise<string> {
  const { auth } = connect();
  await auth.authStateReady();
  return (auth.currentUser ?? (await signInAnonymously(auth)).user).uid;
}

/** Sends the approved words to wait for moderation. Returns the lantern's id. */
export async function release(words: ApprovedWords): Promise<string> {
  const uid = await signedIn();
  const { db } = connect();
  const ref = doc(collection(db, 'pending'));
  await setDoc(ref, {
    feeling: words.feeling,
    essence: words.essence,
    motif: words.motif,
    uid,
    createdAt: serverTimestamp(),
  });
  await remember(ref.id);
  return ref.id;
}

export type LanternStatus = 'waiting' | 'risen' | 'held';

/** Follows a released lantern. Returns the unsubscribe function. */
export function watch(id: string, onStatus: (status: LanternStatus, kindred: string[]) => void): () => void {
  const { db } = connect();
  return onSnapshot(
    doc(db, 'pending', id),
    (snap) => {
      const data = snap.data();
      const status = data?.status === 'risen' || data?.status === 'held' ? data.status : 'waiting';
      onStatus(status, Array.isArray(data?.kindred) ? data.kindred : []);
    },
    // Offline or refused: it simply keeps waiting for the wind (DESIGN.md §4b).
    () => onStatus('waiting', []),
  );
}

/** Yours first, then their kindred, then the newest others; at most SKY_MAX. */
export async function loadSky(): Promise<{ lanterns: SkyLantern[]; mine: Set<string> }> {
  const { db } = connect();
  const mine = new Set(await myLanternIds());
  const byId = new Map<string, SkyLantern>();

  const newest = await getDocs(query(collection(db, 'sky'), orderBy('createdAt', 'desc'), limit(SKY_MAX)));
  const recent = newest.docs.map((d) => toLantern(d.id, d.data()));

  // Mine may be older than the newest SKY_MAX: fetch them by id (10 per query is Firestore's `in` limit).
  const missingMine = [...mine].filter((id) => !recent.some((l) => l.id === id));
  for (const l of await byIds(db, missingMine)) byId.set(l.id, l);
  for (const l of recent) if (mine.has(l.id)) byId.set(l.id, l);

  const kindredIds = [...byId.values()].flatMap((l) => l.kindred).filter((id) => !byId.has(id));
  for (const l of await byIds(db, kindredIds, recent)) byId.set(l.id, l);

  for (const l of recent) {
    if (byId.size >= SKY_MAX) break;
    if (!byId.has(l.id)) byId.set(l.id, l);
  }
  return { lanterns: [...byId.values()], mine };
}

async function byIds(db: Firestore, ids: string[], known: SkyLantern[] = []): Promise<SkyLantern[]> {
  const out = known.filter((l) => ids.includes(l.id));
  const rest = [...new Set(ids)].filter((id) => !out.some((l) => l.id === id));
  for (let i = 0; i < rest.length; i += 10) {
    const snap = await getDocs(query(collection(db, 'sky'), where(documentId(), 'in', rest.slice(i, i + 10))));
    out.push(...snap.docs.map((d) => toLantern(d.id, d.data())));
  }
  return out;
}

function toLantern(id: string, d: DocumentData): SkyLantern {
  return {
    id,
    feeling: d.feeling,
    essence: d.essence,
    motif: d.motif,
    kindred: Array.isArray(d.kindred) ? d.kindred : [],
    seed: !!d.seed,
  };
}

async function remember(id: string): Promise<void> {
  try {
    await (await openLocal()).put(LANTERNS, Date.now(), id);
  } catch {
    // Storage blocked: the lantern still rises; this device just won't recognise it later.
  }
}

async function myLanternIds(): Promise<string[]> {
  try {
    return (await (await openLocal()).getAllKeys(LANTERNS)).map(String);
  } catch {
    return [];
  }
}
