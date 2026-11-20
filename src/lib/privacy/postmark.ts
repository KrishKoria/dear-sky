/**
 * The postmark: where each part of a lantern's making happened, read back from what this app
 * actually did for it (the payload it sent, who chose the picture, how many kindred came back).
 * It's the app's own bookkeeping, shown plainly, so every line must be true by construction.
 */
import type { Painted } from '../engine/types';
import type { ApprovedWords } from './release';

export type Where = 'device' | 'code' | 'cloud' | 'you';

export interface Stamp {
  what: string;
  where: Where;
  /** Where, in words: "on this device", "in the cloud". */
  how: string;
}

export interface Journey {
  letter: string;
  /** Who wrote the lantern's words: the helper on this device, the helper then the writer, or the writer alone. */
  words: 'device' | 'edited' | 'own';
  sent: ApprovedWords;
  paintedBy: Painted['by'];
  kindred: number;
}

const count = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

const COUNT = ['no', 'one', 'two', 'three'];

/** Exactly the words in the payload: the feeling, the line and the small thing it holds. */
export const wordsSent = (sent: ApprovedWords) => count(sent.feeling) + count(sent.essence) + count(sent.motif);

export function postmark(j: Journey): { left: number; stamps: Stamp[] } {
  const letterWords = count(j.letter);
  const stamps: Stamp[] = [
    {
      what: `your letter, all ${letterWords} ${letterWords === 1 ? 'word' : 'words'}`,
      where: 'device',
      how: 'stayed on this device',
    },
    j.words === 'own'
      ? { what: "the lantern's words", where: 'you', how: 'written by you' }
      : j.words === 'edited'
        ? { what: "the lantern's words", where: 'device', how: 'found on this device, then changed by you' }
        : { what: "the lantern's words", where: 'device', how: 'found on this device' },
    { what: 'checked for names, numbers and copied lines', where: 'code', how: 'in code, on this device' },
    j.paintedBy === 'device'
      ? { what: 'its picture', where: 'device', how: 'chosen on this device' }
      : j.paintedBy === 'cloud'
        ? { what: 'its picture', where: 'cloud', how: 'chosen in the cloud, from the words that left' }
        : { what: 'its picture', where: 'code', how: 'matched to its words, in code' },
    { what: "read against the sky's gentle rules", where: 'cloud', how: 'in the cloud' },
  ];
  if (j.kindred > 0) {
    stamps.push({
      what: `found ${COUNT[j.kindred] ?? 'a few'} kindred ${j.kindred === 1 ? 'lantern' : 'lanterns'}`,
      where: 'cloud',
      how: 'in the cloud',
    });
  }
  return { left: wordsSent(j.sent), stamps };
}
