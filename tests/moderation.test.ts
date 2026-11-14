import { expect, test } from 'bun:test';
import { AIError, AIErrorCode } from 'firebase/ai';
import { moderate, type CloudModel } from '../src/lib/cloud/moderation';
import { wordsJson } from '../src/lib/sky/lantern';
import { approveRelease, type ApprovedWords } from '../src/lib/privacy/release';
import { DEMO_LETTER } from './fixtures';

function approved(): ApprovedWords {
  const v = approveRelease(DEMO_LETTER, { feeling: 'longing', essence: 'I still keep your number, just in case the phone rings.', motif: 'a shawl' });
  if (!v.ok) throw new Error('fixture words should pass');
  return v.words;
}

/** A fake cloud model that records what it was sent. */
function fake(reply: () => string | Promise<string>) {
  const sent: string[] = [];
  const model: CloudModel = {
    async generateContent(request) {
      sent.push(request);
      const text = await reply();
      return { response: { text: () => text } };
    },
  };
  return { model, sent };
}

test('only the three approved fields leave the device', async () => {
  const { model, sent } = fake(() => '{"allowed":true}');
  await moderate(model, approved());
  expect(sent).toHaveLength(1);
  const body = JSON.parse(sent[0]);
  expect(Object.keys(body).sort()).toEqual(['essence', 'feeling', 'motif']);
  for (const fromLetter of ['Lucknow', 'Riya', 'Ananya', 'Nani', 'dal', 'graduation']) {
    expect(sent[0]).not.toContain(fromLetter);
  }
  expect(sent[0]).toBe(wordsJson(approved()));
});

test('allowed → clear, declined → held', async () => {
  expect(await moderate(fake(() => '{"allowed":true}').model, approved())).toBe('clear');
  expect(await moderate(fake(() => '{"allowed":false}').model, approved())).toBe('held');
});

test("Gemini's own safety block counts as held", async () => {
  const blocked = fake(() => {
    throw new AIError(AIErrorCode.RESPONSE_ERROR, 'Response error: SAFETY');
  });
  expect(await moderate(blocked.model, approved())).toBe('held');
});

test('offline, refused or odd replies are unchecked, never clear', async () => {
  const offline = fake(() => {
    throw new AIError(AIErrorCode.FETCH_ERROR, 'network');
  });
  expect(await moderate(offline.model, approved())).toBe('unchecked');
  expect(await moderate(fake(() => 'not json').model, approved())).toBe('unchecked');
  expect(await moderate(fake(() => '{}').model, approved())).toBe('unchecked');
});

test('the request carries a timeout', async () => {
  let seen: number | undefined;
  const model: CloudModel = {
    async generateContent(_request, options) {
      seen = options?.timeout;
      return { response: { text: () => '{"allowed":true}' } };
    },
  };
  await moderate(model, approved(), 1234);
  expect(seen).toBe(1234);
});
