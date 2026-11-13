/**
 * The shared sky on the Firebase emulators (PREP.md D32). Run with `bun run test:emu`, which
 * builds the Function and starts auth, firestore and functions with the fake judge.
 *
 * Part 1: the Firestore rules. Part 2: a lantern's whole journey through lightLantern.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'hybridai-785bb',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const lantern = (uid: string, extra: Record<string, unknown> = {}) => ({
  feeling: 'longing',
  essence: 'I still keep your number, just in case the phone rings.',
  motif: 'a shawl',
  uid,
  createdAt: serverTimestamp(),
  ...extra,
});

let n = 0;
const fresh = () => `rules-${Date.now()}-${n++}`;

test('only a signed-in writer can send a lantern, as themselves, in exactly the lantern shape', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const nobody = env.unauthenticatedContext().firestore();

  await assertSucceeds(setDoc(doc(alice, 'pending', fresh()), lantern('alice')));
  await assertFails(setDoc(doc(nobody, 'pending', fresh()), lantern('alice')));
  await assertFails(setDoc(doc(alice, 'pending', fresh()), lantern('bob')));
  await assertFails(setDoc(doc(alice, 'pending', fresh()), lantern('seed')));
  await assertFails(setDoc(doc(alice, 'pending', fresh()), lantern('alice', { letter: 'Dear Nani' })));
  await assertFails(setDoc(doc(alice, 'pending', fresh()), lantern('alice', { feeling: 'rage' })));
  await assertFails(setDoc(doc(alice, 'pending', fresh()), lantern('alice', { essence: '' })));
  await assertFails(setDoc(doc(alice, 'pending', fresh()), lantern('alice', { essence: 'x'.repeat(141) })));
  await assertFails(setDoc(doc(alice, 'pending', fresh()), lantern('alice', { status: 'risen' })));
  await assertFails(
    setDoc(doc(alice, 'pending', fresh()), lantern('alice', { createdAt: Timestamp.fromMillis(0) })),
  );
});

test('a waiting lantern is private to its writer, and the writer cannot change it', async () => {
  const id = fresh();
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  await assertSucceeds(setDoc(doc(alice, 'pending', id), lantern('alice')));
  await assertSucceeds(getDoc(doc(alice, 'pending', id)));
  await assertFails(getDoc(doc(bob, 'pending', id)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'pending', id)));
  await assertFails(updateDoc(doc(alice, 'pending', id), { status: 'risen' }));
});

test('anyone may read the sky; no one but the Function may write it', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'sky', 'rules-sky'), { feeling: 'hope', essence: 'x', motif: 'y', kindred: [], seed: false });
  });
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'sky', 'rules-sky')));
  await assertFails(setDoc(doc(env.authenticatedContext('alice').firestore(), 'sky', fresh()), { essence: 'x' }));
});

async function waitFor<T>(read: () => Promise<T | undefined>, ms = 20_000): Promise<T | undefined> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await read();
    if (v !== undefined) return v;
    await new Promise((r) => setTimeout(r, 300));
  }
  return undefined;
}

test('a gentle lantern rises: published without a uid, with kindred of the same feeling', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const reader = env.unauthenticatedContext().firestore();

  const first = fresh();
  await setDoc(doc(alice, 'pending', first), lantern('alice', { feeling: 'gratitude', essence: 'You believed in me first.' }));
  const firstStatus = await waitFor(async () => (await getDoc(doc(alice, 'pending', first))).data()?.status);
  expect(firstStatus).toBe('risen');

  const second = fresh();
  await setDoc(doc(alice, 'pending', second), lantern('alice', { feeling: 'gratitude', essence: 'You fed me when I had nothing.' }));
  expect(await waitFor(async () => (await getDoc(doc(alice, 'pending', second))).data()?.status)).toBe('risen');

  const sky = (await getDoc(doc(reader, 'sky', second))).data();
  expect(sky).toBeDefined();
  expect(Object.keys(sky!).sort()).toEqual(['createdAt', 'essence', 'feeling', 'kindred', 'motif', 'seed']);
  expect(sky!.seed).toBe(false);
  expect(sky!.kindred).toContain(first);
}, 60_000);

test('a lantern the judge declines is held and never reaches the sky', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const id = fresh();
  await setDoc(doc(alice, 'pending', id), lantern('alice', { essence: 'test-hold this should stay down' }));
  expect(await waitFor(async () => (await getDoc(doc(alice, 'pending', id))).data()?.status)).toBe('held');
  expect((await getDoc(doc(env.unauthenticatedContext().firestore(), 'sky', id))).exists()).toBe(false);
}, 60_000);
