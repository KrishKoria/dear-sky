/**
 * The shared sky, from the app's side (PREP.md D32).
 *
 * - `release` keeps the approved words in this device's outbox, then writes them to
 *   `pending/{id}` with this device's anonymous uid, and remembers the id on the device. The
 *   cloud never learns which lanterns are "yours". `sendWaiting` sends any left from before.
 * - `watch` follows that lantern until the Function has moderated it.
 * - `loadSky` returns yours, their kindred, and the newest others, up to SKY_MAX.
 *
 * With VITE_EMULATORS=1 (`bun run dev:emu`), everything talks to the local emulators.
 */
import { connectAuthEmulator, getAuth, signInAnonymously, signOut, type Auth } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  documentId,
  getDoc,
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
import type { IDBPDatabase } from 'idb';
import { LANTERNS, OUTBOX, openLocal } from '../local/db';
import type { ApprovedWords } from '../privacy/release';
import type { SkyLantern } from './lantern';
import { isGlyph, type Glyph } from './recipe';

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

/** The remembered sign-in no longer exists (cleaned up, disabled, or a restarted emulator). */
const GONE = new Set(['auth/invalid-refresh-token', 'auth/user-token-expired', 'auth/user-not-found', 'auth/user-disabled']);

async function signedIn(): Promise<string> {
  const { auth } = connect();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (user) {
    try {
      // Firestore would otherwise wait for a token that can never come, and the lantern with it.
      await user.getIdToken();
      return user.uid;
    } catch (e) {
      if (!GONE.has((e as { code?: string }).code ?? '')) throw e;
      await signOut(auth);
    }
  }
  return (await signInAnonymously(auth)).user.uid;
}

/**
 * What waits in the outbox: the approved words and the picture painted from them (D13), nothing
 * else. Only `release` writes it. Lanterns kept before D38 have no glyph; the Function picks one.
 */
type Waiting = { feeling: ApprovedWords['feeling']; essence: string; motif: string; glyph?: Glyph };
type Sent = 'sent' | 'refused';

/** One delivery per lantern, however many times it's asked for. */
const sending = new Map<string, Promise<Sent>>();

/**
 * Releases the approved words (D34). They go into this device's outbox first, under an id made
 * here, so a lantern is never lost: offline, or with the tab closed before it was sent, it waits
 * for the wind and is sent the next time it can be. Returns the lantern's id at once. The glyph
 * was painted from these same words (D13), so it carries nothing they don't.
 */
export async function release(words: ApprovedWords, glyph: Glyph): Promise<string> {
  const { db } = connect();
  const id = doc(collection(db, 'pending')).id; // made on this device, no network needed
  const waiting: Waiting = { feeling: words.feeling, essence: words.essence, motif: words.motif, glyph };
  await local((s) => s.put(OUTBOX, waiting, id));
  void send(id, waiting);
  return id;
}

/** Sends any lanterns still waiting from an earlier visit. Call once the app has settled. */
export async function sendWaiting(): Promise<void> {
  const found = await local(async (s) => {
    const [ids, words] = await Promise.all([s.getAllKeys(OUTBOX), s.getAll(OUTBOX)]);
    return ids.map((id, i) => [String(id), words[i] as Waiting] as const);
  });
  for (const [id, words] of found ?? []) void send(id, words);
}

function send(id: string, words: Waiting): Promise<Sent> {
  let delivery = sending.get(id);
  if (!delivery) {
    delivery = deliver(id, words);
    sending.set(id, delivery);
  }
  return delivery;
}

/** The network's off days: worth trying again. Anything else is the sky saying no. */
const PASSING = new Set(['auth/network-request-failed', 'auth/timeout', 'unavailable', 'deadline-exceeded']);

async function deliver(id: string, words: Waiting): Promise<Sent> {
  const { db } = connect();
  const ref = doc(db, 'pending', id);
  for (let pause = 2_000; ; pause = Math.min(pause * 2, 60_000)) {
    await online();
    try {
      const uid = await signedIn();
      // Resolves once the server has it; offline, Firestore holds it and keeps trying.
      // Exactly the fields the rules allow; an old outbox entry simply has no glyph.
      const { glyph, ...approved } = words;
      await setDoc(ref, { ...approved, ...(isGlyph(glyph) ? { glyph } : {}), uid, createdAt: serverTimestamp() });
      await arrived(id);
      return 'sent';
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (PASSING.has(code)) {
        await new Promise((r) => setTimeout(r, pause));
        continue;
      }
      // Sent before, and the tab closed before we heard back: the rules refuse a second write.
      if (code === 'permission-denied' && (await alreadyThere(ref))) {
        await arrived(id);
        return 'sent';
      }
      await local((s) => s.delete(OUTBOX, id));
      return 'refused';
    }
  }
}

function online(): Promise<void> {
  if (navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => addEventListener('online', () => resolve(), { once: true }));
}

async function alreadyThere(ref: ReturnType<typeof doc>): Promise<boolean> {
  try {
    return (await getDoc(ref)).exists();
  } catch {
    return false;
  }
}

/** Out of the outbox, and remembered as this device's own. */
async function arrived(id: string): Promise<void> {
  await local(async (s) => {
    const tx = s.transaction([OUTBOX, LANTERNS], 'readwrite');
    await Promise.all([tx.objectStore(OUTBOX).delete(id), tx.objectStore(LANTERNS).put(Date.now(), id), tx.done]);
  });
}

/** `refused`: the sky wouldn't take the words, so nothing was shared. */
export type LanternStatus = 'waiting' | 'risen' | 'held' | 'refused';

/** Follows a released lantern, from the outbox to the sky. Returns the unsubscribe function. */
export function watch(id: string, onStatus: (status: LanternStatus, kindred: string[]) => void): () => void {
  let stop: (() => void) | undefined;
  let stopped = false;
  void (sending.get(id) ?? Promise.resolve<Sent>('sent')).then((sent) => {
    if (stopped) return;
    if (sent === 'refused') return onStatus('refused', []);
    const { db } = connect();
    stop = onSnapshot(
      doc(db, 'pending', id),
      (snap) => {
        const data = snap.data();
        const status = data?.status === 'risen' || data?.status === 'held' ? data.status : 'waiting';
        onStatus(status, Array.isArray(data?.kindred) ? data.kindred : []);
      },
      // It was sent; if we lose sight of it, it keeps waiting for the wind (DESIGN.md §4b).
      () => onStatus('waiting', []),
    );
  });
  return () => {
    stopped = true;
    stop?.();
  };
}

/**
 * Yours first, then their kindred, then the newest others; at most SKY_MAX. `latest` is the
 * lantern this device released most recently, so the sky can gather around it.
 */
export async function loadSky(): Promise<{ lanterns: SkyLantern[]; mine: Set<string>; latest?: string }> {
  const { db } = connect();
  const ids = await myLanternIds();
  const mine = new Set(ids);
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
  return { lanterns: [...byId.values()], mine, latest: ids.find((id) => byId.has(id)) };
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
    glyph: isGlyph(d.glyph) ? d.glyph : undefined,
  };
}

/** This device's lanterns, newest first (each is stored with the time it arrived). */
async function myLanternIds(): Promise<string[]> {
  const found = await local(async (s) => {
    const [ids, times] = await Promise.all([s.getAllKeys(LANTERNS), s.getAll(LANTERNS)]);
    return ids.map((id, i) => ({ id: String(id), at: Number(times[i]) || 0 }));
  });
  return (found ?? []).sort((a, b) => b.at - a.at).map((l) => l.id);
}

/**
 * This device's storage, or nothing if the browser blocks it (private modes can). Then a
 * lantern still rises from this tab; it just can't wait for a later visit or be found again.
 */
async function local<T>(use: (store: IDBPDatabase) => Promise<T>): Promise<T | undefined> {
  try {
    return await use(await openLocal());
  } catch {
    return undefined;
  }
}
