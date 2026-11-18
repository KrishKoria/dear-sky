/**
 * On-device prompts (v6, tuned on Gemma 4 in the engine lab, 2026-11-16; PREP.md §3b-2, D27).
 * Firebase AI Logic makes a new session per call (PREP.md D21), so every prompt carries the
 * letter itself, after a system prompt and three worked examples.
 */
import type { LanguageModelMessage } from 'firebase/ai';
import { GLYPH_SYSTEM } from '../sky/recipe';

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
First notice who the letter is to and what the writer feels toward them: missing, grief, regret, sorry, thankful, loving, proud or hopeful. Read it generously: a thank-you is gratitude, not hurt.
Keep straight who did what. In the letter, "I" is the writer and "you" is the person it is written to. In your note, always call the writer "you", never "he" or "she". Call the person the letter is for by their role ("your father", "your friend") or "he", "she", "they".
Your margin notes:
- 2 or 3 short sentences in plain, warm words, spoken to the writer as "you".
- Start with one real, concrete thing from the letter (an object, a habit, a moment), then gently name the feeling under it. Never invent details.
- Never use names of people, places, schools, companies or handles. Say "your mother", "that city", "your old team".
- Never give advice, never ask questions, never praise them. Just show them they were heard.
- Avoid these words: seems, sounds, shows, quiet, weight, heavy, courage, strength, palpable, profound, journey, testament.`;

/**
 * Fictional, written by us: one letter for each kind of feeling the model kept missing (grief,
 * thanks, regret), so it doesn't read every letter as a loss. Not shaped like the lab's letters.
 */
const EXAMPLES = [
  {
    letter: `Nana, Your watch stopped the week after the funeral. I haven't wound it. Mum says it's just old, but I like that it kept your time and not ours. I still take the long way past the pond where you taught me to skip stones. I'm still bad at it.`,
    note: `Leaving the watch unwound lets it keep his time a little longer. Those stones still skip badly, and somehow that keeps him close on the long way past the pond.`,
    essence: `{"feeling":"longing","essence":"I let your watch keep your time instead of ours.","motif":"a stopped wristwatch"}`,
  },
  {
    letter: `Mr. Fernandes, You drove the 7:10 school bus for six years. Every morning I was late and every morning you waited at the corner with the door open and that terrible radio on. I never said anything except sorry. I'm thirty now and I still hum the radio jingle when I'm running late. Thank you for waiting.`,
    note: `Six years of that open door at the corner, and all you ever said was sorry. The jingle you still hum when you're late carries the thank-you that never got said.`,
    essence: `{"feeling":"gratitude","essence":"Every late morning, you waited with the door open for me.","motif":"a bus door left open"}`,
  },
  {
    letter: `Ria, I laughed when they read your poem out in class. Everyone did, but I was your friend, and I laughed loudest. You moved schools that summer. I found the poem years later in an old bag, the one about your grandmother's hands. It was beautiful. I'm sorry I was a coward.`,
    note: `The poem about her grandmother's hands waited in that old bag for years before you could read it properly. Laughing loudest is the part that still stings, because you were meant to be on her side.`,
    essence: `{"feeling":"regret","essence":"I laughed with them when I should have stood beside you.","motif":"a poem folded in a bag"}`,
  },
];

const quoted = (letter: string) => `The letter:\n"""\n${letter}\n"""`;

export const safetyPrompt = (letter: string) =>
  `${quoted(letter)}
First, a safety check only. Does the writer say or hint that they themselves might hurt themselves, end their life, be giving their things away, be saying goodbye for good, or not be here much longer? Grief about someone else's death does not count. Reply in JSON: risk (true or false) and signal (the hint in at most 8 words, or "").`;

// The reminder sits right before the task: small models follow what's nearest (v9, PREP D49).
export const reflectPrompt = (letter: string) =>
  `${quoted(letter)}\nWrite your margin note to the writer. In the letter, "you" is the person it was written to; in your note, "you" is the writer. Leave out every name and place.`;

const ESSENCE_INSTRUCTIONS = `Now make a lantern from the letter above. Strangers may read it, so it must not point to anyone. Reply in JSON:
- feeling: the writer's single strongest feeling toward the person: grief (they died), longing (missing them), regret (wishing the writer had done differently), gratitude (thankful for what they did), love, hope, forgiveness or peace.
- essence: one complete sentence of 6 to 15 words, in the writer's voice, spoken to the person the letter is for, holding one concrete thing that only this letter has. A short phrase from the letter is fine; a whole copied sentence is not. No advice. No names, nicknames, places, schools, companies, dates, numbers or handles.
- motif: one object or tiny scene that appears in the letter, 2 to 5 lowercase words, that a painter could draw. No names or places.`;

export const essencePrompt = (letter: string) => `${quoted(letter)}\n${ESSENCE_INSTRUCTIONS}`;

/** Second try after the leak check refused the first essence (PREP.md D25). Says why, never quotes it. */
export const essenceRetryPrompt = (letter: string) =>
  `${essencePrompt(letter)}\nWrite the essence in your own new words: never reuse 5 or more words in a row from the letter, and leave out every name.`;

/**
 * A stranger's lantern, read beside the writer's own letter (D50). The lantern's words are public:
 * they came down from the shared sky, already moderated. The letter never leaves the device.
 */
export interface StrangerWords {
  feeling: string;
  essence: string;
  motif: string;
}

/**
 * A reply the UI never shows: it writes its own gentle line instead. Every unsent letter shares
 * something with another ("others carry this too"), so the prompt doesn't ask for it; a small
 * model asked to judge "nothing" was no better than chance (D50). It stays as a safe way out.
 */
export const NO_ECHO = 'nothing';

const lanternLine = (w: StrangerWords) => `"${w.essence}" (${w.feeling}; ${w.motif})`;

export const echoPrompt = (letter: string, lantern: StrangerWords) =>
  `${quoted(letter)}
A stranger lit a lantern in the shared sky. It says: ${lanternLine(lantern)}
Write one line of at most 18 words for the writer, about what their letter and this lantern share, exactly in this shape:
Your <the thing in the letter most like theirs> and their <the lantern's thing>: both <a short verb phrase for what they share, in plain words>.
Use only things that are really in the letter and the lantern. Never name anyone or anywhere. No advice. Avoid these words: memory, moment, ritual, connection, deeply, acknowledgment.`;

/** Fictional, like EXAMPLES: two lanterns of the same feeling as their letter, one of a different one. */
const ECHO_EXAMPLES = [
  {
    letter: EXAMPLES[1].letter,
    lantern: { feeling: 'gratitude', essence: 'You saved me a seat every single day that winter.', motif: 'an empty seat' },
    echo: 'Your open bus door and their saved seat: both waited for you, day after day, without being asked.',
  },
  {
    letter: EXAMPLES[0].letter,
    lantern: { feeling: 'grief', essence: 'I still say goodnight to your side of the bed.', motif: 'a made bed' },
    echo: "Your unwound watch and their goodnight to an empty side: both keep a little of someone's time going.",
  },
  {
    letter: EXAMPLES[2].letter,
    lantern: { feeling: 'hope', essence: 'The new garden is finally green after the long dry summer.', motif: 'a watering can' },
    echo: 'Your poem in the old bag and their green garden: both took a long time to be seen for what they were.',
  },
];

const text = (value: string) => [{ type: 'text' as const, value }];

export const SYSTEM_ONLY: LanguageModelMessage[] = [{ role: 'system', content: text(SYSTEM_PROMPT) }];

/** The glyph pick (D13) sees only approved words, never the letter, so it has its own short system prompt. */
export const GLYPH_INITIAL: LanguageModelMessage[] = [{ role: 'system', content: text(GLYPH_SYSTEM) }];

export const REFLECT_INITIAL: LanguageModelMessage[] = [
  ...SYSTEM_ONLY,
  ...EXAMPLES.flatMap((e): LanguageModelMessage[] => [
    { role: 'user', content: text(reflectPrompt(e.letter)) },
    { role: 'assistant', content: text(e.note) },
  ]),
];

export const ESSENCE_INITIAL: LanguageModelMessage[] = [
  ...SYSTEM_ONLY,
  ...EXAMPLES.flatMap((e): LanguageModelMessage[] => [
    { role: 'user', content: text(essencePrompt(e.letter)) },
    { role: 'assistant', content: text(e.essence) },
  ]),
];

export const ECHO_INITIAL: LanguageModelMessage[] = [
  ...SYSTEM_ONLY,
  ...ECHO_EXAMPLES.flatMap((e): LanguageModelMessage[] => [
    { role: 'user', content: text(echoPrompt(e.letter, e.lantern)) },
    { role: 'assistant', content: text(e.echo) },
  ]),
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
