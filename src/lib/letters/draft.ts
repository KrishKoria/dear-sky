/**
 * The letter being written, kept in this browser's IndexedDB only (PREP.md §2: "stored only on
 * this device"). Nothing here touches the network. If storage is blocked (some private modes),
 * writing still works; the draft just won't survive a reload.
 */
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'dear-sky';
const STORE = 'drafts';
const KEY = 'current';

let db: Promise<IDBPDatabase> | undefined;
let persistAsked = false;

function open(): Promise<IDBPDatabase> {
  db ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE);
    },
  });
  return db;
}

export async function loadDraft(): Promise<string> {
  try {
    const value: unknown = await (await open()).get(STORE, KEY);
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export async function saveDraft(text: string): Promise<void> {
  try {
    await (await open()).put(STORE, text, KEY);
    if (!persistAsked && text.trim()) {
      persistAsked = true;
      // Asks the browser not to evict the letter under storage pressure. Chrome decides
      // silently from site engagement; it never shows a prompt.
      void navigator.storage?.persist?.().catch(() => {});
    }
  } catch {
    // Storage is unavailable: the letter still lives in the page.
  }
}
