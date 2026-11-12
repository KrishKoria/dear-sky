/**
 * On-device prompts, from research/prompts.md (v5, tested 2026-11-12).
 *
 * The lab tested them as follow-ups on one cloned session. Firebase AI Logic makes a
 * new session per call (PREP.md D21), so here every prompt carries the letter itself.
 * Re-test them in that form before tuning further.
 */
import type { LanguageModelMessage } from 'firebase/ai';

export const FEELINGS = [
  'grief',
  'longing',
  'regret',
  'gratitude',
  'love',
  'hope',
  'forgiveness',
  'peace',
] as const;
export type Feeling = (typeof FEELINGS)[number];

export const SYSTEM_PROMPT = `You are the companion inside Dear Sky, a private app where people write unsent letters to someone they lost, hurt, miss, or used to be. The writer is the person who wrote the letter. You answer the writer, never the person the letter is addressed to.
Your margin notes:
- 2 or 3 short sentences, spoken to the writer as "you", in plain, warm words.
- Reflect back what they seem to feel, using one real detail from their letter. Never invent details.
- Never use names of people, places, schools, companies or handles. Say "your mother", "that city", "your old team".
- Never give advice, never ask questions, never praise them. Just show them they were heard.
- Do not begin with "It sounds like" or "You". Avoid: quiet, weight, heavy, courage, strength, palpable, profound, journey, testament.`;

/** Fictional, written by us. Shown to the model once per session as an example. */
const EXAMPLE_LETTER = `Nana, Your watch stopped the week after the funeral. I haven't wound it. Mum says it's just old, but I like that it kept your time and not ours. I still take the long way past the pond where you taught me to skip stones. I'm still bad at it.`;
const EXAMPLE_NOTE = `Leaving the watch unwound lets it keep his time a little longer. Those stones still skip badly, and somehow that keeps him close on the long way past the pond.`;
const EXAMPLE_ESSENCE = `{"feeling":"longing","essence":"I let your watch keep your time instead of ours.","motif":"a stopped wristwatch"}`;

const quoted = (letter: string) => `The letter:\n"""\n${letter}\n"""`;

export const safetyPrompt = (letter: string) =>
  `${quoted(letter)}
First, a safety check only. Does the writer say or hint that they themselves might hurt themselves, end their life, be giving their things away, be saying goodbye for good, or not be here much longer? Grief about someone else's death does not count. Reply in JSON: risk (true or false) and signal (the hint in at most 8 words, or "").`;

export const reflectPrompt = (letter: string) => `${quoted(letter)}\nWrite your margin note.`;

const ESSENCE_INSTRUCTIONS = `Now make a lantern from the letter above. Strangers may read it, so it must not point to anyone. Reply in JSON:
- feeling: the single strongest feeling, one of ${FEELINGS.join(', ')}.
- essence: one complete sentence of 6 to 15 words, in the writer's voice, specific to this letter. A short phrase from the letter is fine; a whole copied sentence is not. No names, nicknames, places, schools, companies, dates, numbers or handles.
- motif: one object or tiny scene that appears in the letter, 2 to 5 lowercase words, that a painter could draw. No names or places.`;

export const essencePrompt = (letter: string) => `${quoted(letter)}\n${ESSENCE_INSTRUCTIONS}`;

const text = (value: string) => [{ type: 'text' as const, value }];

export const SYSTEM_ONLY: LanguageModelMessage[] = [{ role: 'system', content: text(SYSTEM_PROMPT) }];

export const REFLECT_INITIAL: LanguageModelMessage[] = [
  ...SYSTEM_ONLY,
  { role: 'user', content: text(reflectPrompt(EXAMPLE_LETTER)) },
  { role: 'assistant', content: text(EXAMPLE_NOTE) },
];

export const ESSENCE_INITIAL: LanguageModelMessage[] = [
  ...SYSTEM_ONLY,
  { role: 'user', content: text(essencePrompt(EXAMPLE_LETTER)) },
  { role: 'assistant', content: text(EXAMPLE_ESSENCE) },
];

export const SAFETY_SCHEMA = {
  type: 'object',
  properties: { risk: { type: 'boolean' }, signal: { type: 'string' } },
  required: ['risk', 'signal'],
  additionalProperties: false,
} as const;

export const ESSENCE_SCHEMA = {
  type: 'object',
  properties: {
    feeling: { type: 'string', enum: FEELINGS },
    essence: { type: 'string' },
    motif: { type: 'string' },
  },
  required: ['feeling', 'essence', 'motif'],
  additionalProperties: false,
} as const;
