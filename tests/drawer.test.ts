import { expect, test } from 'bun:test';
import { createDrawer, parseKept, type KeptLetter } from '../src/lib/letters/drawer';

const letter = (over: Record<string, unknown> = {}) => ({
  id: 'a',
  text: 'dear nana',
  keptAt: 100,
  note: null,
  revisit: null,
  ...over,
});

/** An in-memory shelf that records writes; `broken` makes every call throw. */
function memoryShelf(records: unknown[] = [], broken = false) {
  const map = new Map<string, unknown>(records.map((r, i) => [String((r as { id?: string })?.id ?? `x${i}`), r]));
  let writes = 0;
  const guard = <T>(fn: () => T) => async () => {
    if (broken) throw new Error('storage is blocked');
    return fn();
  };
  const shelf = {
    all: guard(() => [...map.values()]),
    get: async (id: string) => guard(() => map.get(id))(),
    put: async (l: KeptLetter) => guard(() => (writes++, void map.set(l.id, l)))(),
    delete: async (id: string) => guard(() => void map.delete(id))(),
  };
  return { shelf, map, writes: () => writes };
}

test('parseKept accepts a whole letter, with or without the optional parts', () => {
  expect(parseKept(letter())).toEqual(letter());
  const full = letter({ note: 'you were brave', revisit: { text: 'still true', at: 200 } });
  expect(parseKept(full)).toEqual(full);
  expect(parseKept({ id: 'a', text: 'hi', keptAt: 1 })).toEqual({
    id: 'a',
    text: 'hi',
    keptAt: 1,
    note: null,
    revisit: null,
  });
});

test('parseKept rejects what is not a whole letter', () => {
  for (const bad of [
    null,
    undefined,
    'a letter',
    42,
    [],
    letter({ id: '' }),
    letter({ id: 7 }),
    letter({ text: '   ' }),
    letter({ text: 3 }),
    letter({ keptAt: '100' }),
    letter({ keptAt: NaN }),
    letter({ note: 5 }),
  ]) {
    expect(parseKept(bad)).toBeNull();
  }
});

test('a damaged revisit note is dropped, and the letter stays', () => {
  expect(parseKept(letter({ revisit: { text: 'x' } }))).toEqual(letter());
  expect(parseKept(letter({ revisit: 'later' }))).toEqual(letter());
});

test('list is newest first and skips records that do not parse', async () => {
  const { shelf } = memoryShelf([
    letter({ id: 'old', keptAt: 10 }),
    { id: 'junk' },
    letter({ id: 'new', keptAt: 30 }),
    'not even an object',
    letter({ id: 'mid', keptAt: 20 }),
  ]);
  const ids = (await createDrawer(shelf).list()).map((l) => l.id);
  expect(ids).toEqual(['new', 'mid', 'old']);
});

test('list gives up quietly when storage cannot be read', async () => {
  const d = createDrawer(memoryShelf([letter()], true).shelf);
  expect(await d.list()).toEqual([]);
});

test('keep files the letter, and it can be listed', async () => {
  const { shelf } = memoryShelf();
  const d = createDrawer(shelf);
  const kept = await d.keep('dear nana', 'a note', 500);
  expect(kept).toMatchObject({ text: 'dear nana', keptAt: 500, note: 'a note', revisit: null });
  expect(kept?.id).toBeTruthy();
  expect(await d.list()).toEqual([kept!]);
});

test('keep of blank text writes nothing', async () => {
  const { shelf, writes } = memoryShelf();
  const d = createDrawer(shelf);
  expect(await d.keep('', null)).toBeNull();
  expect(await d.keep('  \n ', 'note')).toBeNull();
  expect(writes()).toBe(0);
});

test('keep returns null when the store throws, so the letter stays on the page', async () => {
  const d = createDrawer(memoryShelf([], true).shelf);
  expect(await d.keep('dear nana', null)).toBeNull();
});

test('revisit saves the note onto the kept letter, and the latest one wins', async () => {
  const d = createDrawer(memoryShelf().shelf);
  const kept = await d.keep('dear nana', null, 1);
  await d.revisit(kept!.id, 'first thought', 2);
  await d.revisit(kept!.id, 'second thought', 3);
  expect((await d.list())[0].revisit).toEqual({ text: 'second thought', at: 3 });
});

test('revisit on a missing id does nothing', async () => {
  const { shelf, writes, map } = memoryShelf();
  await createDrawer(shelf).revisit('nope', 'hello', 1);
  expect(writes()).toBe(0);
  expect(map.size).toBe(0);
});

test('revisit and remove never throw when storage fails', async () => {
  const d = createDrawer(memoryShelf([letter()], true).shelf);
  await d.revisit('a', 'hello', 1);
  await d.remove('a');
});

test('remove takes the letter out for good', async () => {
  const d = createDrawer(memoryShelf().shelf);
  const kept = await d.keep('dear nana', null);
  await d.remove(kept!.id);
  expect(await d.list()).toEqual([]);
});
