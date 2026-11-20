/**
 * The drawer of kept letters, in this browser's IndexedDB only. The whole letter is stored here,
 * so nothing in this module touches the network. If storage is blocked, keeping resolves null and
 * the caller leaves the letter on the page instead of losing it.
 */
import { KEPT as STORE, openLocal as open } from '../local/db';

/** A note written on rereading, epoch ms. */
export interface Revisit {
  text: string;
  at: number;
}

export interface KeptLetter {
  id: string;
  /** The whole letter. */
  text: string;
  /** Epoch ms. */
  keptAt: number;
  /** The margin note the helper wrote before it was kept, if any. */
  note: string | null;
  revisit: Revisit | null;
}

/** Where the records live. The default is IndexedDB; tests bring their own. */
interface Shelf {
  all(): Promise<unknown[]>;
  get(id: string): Promise<unknown>;
  put(letter: KeptLetter): Promise<void>;
  delete(id: string): Promise<void>;
}

const indexedDb: Shelf = {
  all: async () => (await open()).getAll(STORE),
  get: async (id) => (await open()).get(STORE, id),
  put: async (letter) => void (await (await open()).put(STORE, letter, letter.id)),
  delete: async (id) => (await open()).delete(STORE, id),
};

const isTime = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** What storage hands back is `unknown`: a record that isn't a whole letter is skipped, not trusted. */
export function parseKept(value: unknown): KeptLetter | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id, text, keptAt, note, revisit } = value as Record<string, unknown>;
  if (typeof id !== 'string' || !id) return null;
  if (typeof text !== 'string' || !text.trim()) return null;
  if (!isTime(keptAt)) return null;
  if (note != null && typeof note !== 'string') return null;
  return { id, text, keptAt, note: note ?? null, revisit: parseRevisit(revisit) };
}

/** A damaged note costs only itself: the letter beside it is still worth reading. */
function parseRevisit(value: unknown): Revisit | null {
  if (typeof value !== 'object' || value === null) return null;
  const { text, at } = value as Record<string, unknown>;
  return typeof text === 'string' && isTime(at) ? { text, at } : null;
}

let persistAsked = false;

export function createDrawer(shelf: Shelf) {
  return {
    /** Newest first. [] when storage can't be read. Records that don't parse are skipped, never thrown. */
    async list(): Promise<KeptLetter[]> {
      try {
        const letters: KeptLetter[] = [];
        for (const record of await shelf.all()) {
          const letter = parseKept(record);
          if (letter) letters.push(letter);
        }
        return letters.sort((a, b) => b.keptAt - a.keptAt);
      } catch {
        return [];
      }
    },

    /** Files a letter. Resolves null when storage can't be written: the caller then leaves the letter on the page. Blank text resolves null without writing. */
    async keep(text: string, note: string | null, now = Date.now()): Promise<KeptLetter | null> {
      if (!text.trim()) return null;
      const letter: KeptLetter = { id: crypto.randomUUID(), text, keptAt: now, note, revisit: null };
      try {
        await shelf.put(letter);
      } catch {
        return null;
      }
      if (!persistAsked) {
        persistAsked = true;
        // Asks the browser not to evict the drawer under storage pressure. Chrome decides
        // silently from site engagement; it never shows a prompt.
        try {
          void navigator.storage?.persist?.().catch(() => {});
        } catch {
          // No storage manager here; the letter is filed all the same.
        }
      }
      return letter;
    },

    /** Saves the latest revisit note onto a kept letter. Quietly does nothing when the letter is gone or storage fails. */
    async revisit(id: string, text: string, at: number): Promise<void> {
      try {
        const letter = parseKept(await shelf.get(id));
        if (letter) await shelf.put({ ...letter, revisit: { text, at } });
      } catch {
        // Storage is unavailable: the note still lives on the page.
      }
    },

    /** Takes a letter out of the drawer for good (it goes back on the desk, or is burned). Never throws. */
    async remove(id: string): Promise<void> {
      try {
        await shelf.delete(id);
      } catch {
        // Storage is unavailable, so there was nothing to take out.
      }
    },
  };
}

export const drawer = createDrawer(indexedDb);
