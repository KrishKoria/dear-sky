/**
 * This browser's own storage (IndexedDB). Nothing here touches the network.
 *   drafts:   the letter being written (PREP.md §2: "stored only on this device")
 *   lanterns: the ids of lanterns this device released, so "yours" are found again in the
 *             sky without the cloud ever linking a lantern to a person (D32)
 *   outbox:   approved words waiting to be sent (offline, or the tab closed before they were
 *             sent), keyed by their lantern id. Never the letter: only `ApprovedWords` (D34)
 */
import { openDB, type IDBPDatabase } from 'idb';

export const DRAFTS = 'drafts';
export const LANTERNS = 'lanterns';
export const OUTBOX = 'outbox';

const VERSION = 3;
/** Long enough for a cold open; short enough that nothing waits on a stuck one. */
const OPEN_MS = 2_500;

let db: Promise<IDBPDatabase> | undefined;

/**
 * Opens the store. An upgrade waits until every other tab has let go of the old version, so:
 * this tab lets go as soon as another asks (`blocking`), and an open that is still stuck after
 * OPEN_MS (an old tab that won't let go) is given up on, so callers carry on without storage.
 */
export function openLocal(): Promise<IDBPDatabase> {
  if (db) return db;
  // Only this open's own failure or loss may clear `db`: after a newer open has replaced it, a
  // stale one finishing late must leave it alone.
  const forget = () => {
    if (db === mine) db = undefined;
  };
  const opening = openDB('dear-sky', VERSION, {
    upgrade(database) {
      for (const store of [DRAFTS, LANTERNS, OUTBOX]) {
        if (!database.objectStoreNames.contains(store)) database.createObjectStore(store);
      }
    },
    blocking(_current, _next, event) {
      (event.target as IDBDatabase).close();
      forget();
    },
    terminated: forget,
  });
  const mine = within(opening, OPEN_MS).catch((e: unknown) => {
    forget(); // try again next time
    // Given up on, but it may still open later: don't leave that connection holding an upgrade.
    opening.then((late) => late.close(), () => {});
    throw e;
  });
  db = mine;
  return mine;
}

function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('local storage is busy')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** How many lanterns wait in the outbox. Zero when the browser's storage can't be read. */
export async function outboxSize(): Promise<number> {
  try {
    return await (await openLocal()).count(OUTBOX);
  } catch {
    return 0;
  }
}
