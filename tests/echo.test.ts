import { describe, expect, test } from 'bun:test';
import { echoStream, isNoEcho } from '../src/lib/engine/echo';
import { NO_ECHO, echoPrompt } from '../src/lib/engine/prompts';

function run(chunks: string[]) {
  const shown: string[] = [];
  const stream = echoStream((d) => shown.push(d));
  for (const c of chunks) stream.push(c);
  const result = stream.end(chunks.join(''));
  return { shown: shown.join(''), result };
}

describe('echo stream (D50)', () => {
  test('a real line streams through whole', () => {
    const line = 'Your rasam and their two cups: both keep a place at the table.';
    const { shown, result } = run(['Your ras', 'am and their', ' two cups: both keep', ' a place at the table.']);
    expect(shown).toBe(line);
    expect(result).toBe(line);
  });

  test('"nothing" is never shown, in any chunking or case', () => {
    for (const chunks of [['nothing'], ['no', 'thing'], ['Nothing.'], [' nothing\n'], ['"nothing"']]) {
      const { shown, result } = run(chunks);
      expect(shown).toBe('');
      expect(result).toBe(NO_ECHO);
    }
  });

  test('a short real line held back is let out at the end', () => {
    const { shown, result } = run(['Your tea', ' too.']);
    expect(shown).toBe('Your tea too.');
    expect(result).toBe('Your tea too.');
  });

  test('a line that only starts with the word is still a line', () => {
    expect(isNoEcho('Nothing about your rasam is forgotten, and their cups too.')).toBe(false);
  });

  test('the prompt carries the letter and only the lantern\'s public words', () => {
    const prompt = echoPrompt('Dear A, the kettle.', { feeling: 'grief', essence: 'I still set out two cups.', motif: 'a teacup' });
    expect(prompt).toContain('Dear A, the kettle.');
    expect(prompt).toContain('"I still set out two cups." (grief; a teacup)');
  });
});
