/**
 * This browser's own storage (IndexedDB). Nothing here touches the network.
 *   drafts:   the letter being written (PREP.md §2: "stored only on this device")
 *   lanterns: the ids of lanterns this device released, so "yours" are found again in the
 *             sky without the cloud ever linking a lantern to a person (D32)
 */
import { openDB, type IDBPDatabase } from 'idb';

export const DRAFTS = 'drafts';
export const LANTERNS = 'lanterns';

let db: Promise<IDBPDatabase> | undefined;

export function openLocal(): Promise<IDBPDatabase> {
  db ??= openDB('dear-sky', 2, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(DRAFTS)) database.createObjectStore(DRAFTS);
      if (!database.objectStoreNames.contains(LANTERNS)) database.createObjectStore(LANTERNS);
    },
  });
  return db;
}
