/**
 * The letter being written, kept in this browser's IndexedDB only (PREP.md §2: "stored only on
 * this device"). Nothing here touches the network. If storage is blocked (some private modes),
 * writing still works; the draft just won't survive a reload.
 */
import { DRAFTS as STORE, openLocal as open } from '../local/db';

const KEY = 'current';

let persistAsked = false;

export async function loadDraft(): Promise<string> {
  try {
    const value: unknown = await (await open()).get(STORE, KEY);
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

/** Burning: the letter is deleted from this browser's storage instead of being blanked. */
export async function burnDraft(): Promise<void> {
  try {
    await (await open()).delete(STORE, KEY);
  } catch {
    // Storage is unavailable, so the letter only ever lived in the page.
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

interface DraftStore {
  load(): Promise<string>;
  save(text: string): Promise<void>;
  burn(): Promise<void>;
}

/**
 * Saves the letter as it is written, without ever writing over a draft that hasn't been read yet:
 * a slow read finishing after the writer's first keystroke would otherwise be lost for good.
 */
export class DraftKeeper {
  private readonly store: DraftStore;
  private readonly delayMs: number;
  private read = false;
  /** What storage holds, as far as we know. A blank page counts as stored until the read says otherwise. */
  private synced = '';
  private pending: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(store: DraftStore = { load: loadDraft, save: saveDraft, burn: burnDraft }, delayMs = 500) {
    this.store = store;
    this.delayMs = delayMs;
  }

  /** The stored draft ('' if none). Anything the writer typed meanwhile is saved over it. */
  async load(): Promise<string> {
    const stored = await this.store.load();
    this.read = true;
    this.synced = stored;
    // Typed text that matches storage after all (or a blank page) needs no save.
    if (this.pending === stored) this.pending = undefined;
    this.schedule();
    return stored;
  }

  /** The letter changed. Saved once the writer pauses, and once the stored draft has been read. */
  edit(text: string): void {
    this.pending = text === this.synced ? undefined : text;
    this.schedule();
  }

  /** Nothing waiting is saved after a burn, and the blank page that follows isn't written either. */
  burn(): Promise<void> {
    clearTimeout(this.timer);
    this.pending = undefined;
    this.synced = '';
    return this.store.burn();
  }

  /** Saves what is waiting right now: the tab is going away and a timer might not fire. */
  flush(): void {
    clearTimeout(this.timer);
    if (!this.read || this.pending === undefined) return;
    const text = this.pending;
    this.pending = undefined;
    this.synced = text;
    void this.store.save(text);
  }

  private schedule(): void {
    clearTimeout(this.timer);
    if (this.read && this.pending !== undefined) this.timer = setTimeout(() => this.flush(), this.delayMs);
  }
}
