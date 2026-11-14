import { expect, test } from 'bun:test';
import { DraftKeeper } from '../src/lib/letters/draft';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A store whose read finishes only when the test says so. */
function slowStore() {
  const saved: string[] = [];
  let burned = 0;
  let arrive!: (text: string) => void;
  const loaded = new Promise<string>((resolve) => (arrive = resolve));
  const keeper = new DraftKeeper(
    {
      load: () => loaded,
      save: async (text) => void saved.push(text),
      burn: async () => void burned++,
    },
    5,
  );
  return { keeper, saved, arrive, burned: () => burned };
}

test('a draft that arrives late is returned, and never written back over', async () => {
  const { keeper, saved, arrive } = slowStore();
  keeper.edit(''); // the blank page the writer first sees
  await sleep(15);
  const stored = keeper.load();
  arrive('my letter to nana');
  expect(await stored).toBe('my letter to nana');
  keeper.edit('my letter to nana'); // the page showing what was loaded
  await sleep(15);
  expect(saved).toEqual([]);
});

test('nothing is saved until the stored draft has been read', async () => {
  const { keeper, saved, arrive } = slowStore();
  keeper.edit('d');
  keeper.flush(); // a closing tab, before the read finished
  await sleep(15);
  expect(saved).toEqual([]);

  const stored = keeper.load();
  arrive('older draft');
  await stored;
  await sleep(15);
  expect(saved).toEqual(['d']); // the writer's own words, kept once it is safe to
});

test('saving waits for a pause, and a closing tab saves at once', async () => {
  const { keeper, saved, arrive } = slowStore();
  const stored = keeper.load();
  arrive('');
  await stored;
  keeper.edit('dear');
  keeper.edit('dear nana');
  expect(saved).toEqual([]);
  keeper.flush();
  expect(saved).toEqual(['dear nana']);
  await sleep(15);
  expect(saved).toEqual(['dear nana']); // the timer was cancelled, so nothing is saved twice
});

test('after a burn nothing pending is saved, and the same words written again are', async () => {
  const { keeper, saved, arrive, burned } = slowStore();
  const stored = keeper.load();
  arrive('goodbye');
  await stored;
  keeper.edit('goodbye, again');
  await keeper.burn();
  keeper.edit(''); // the fresh sheet
  await sleep(15);
  expect(saved).toEqual([]);
  expect(burned()).toBe(1);

  keeper.edit('goodbye');
  await sleep(15);
  expect(saved).toEqual(['goodbye']);
});
