/**
 * Dev only: walk the real engine's no-model paths in a Chrome that has the model.
 *   ?nano=unavailable  the Prompt API is there but says no (Brave)
 *   ?nano=none         there is no Prompt API at all (Safari, Firefox)
 * Imported first in main.ts: Firebase AI Logic reads `LanguageModel` when each model is made.
 */
if (import.meta.env.DEV) {
  const mode = new URLSearchParams(location.search).get('nano');
  const g = globalThis as { LanguageModel?: { availability: (options?: object) => Promise<string> } };
  if (mode === 'none') delete g.LanguageModel;
  if (mode === 'unavailable' && g.LanguageModel) g.LanguageModel.availability = async () => 'unavailable';
  if (mode) console.info(`[dear sky] dev: on-device model faked as "${mode}"`);
}

export {};
