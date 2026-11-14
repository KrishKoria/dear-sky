import { expect, spyOn, test } from 'bun:test';

test('App Check starts once, however many cloud paths ask for it', async () => {
  // No site key in tests, so "starting" is the one warning that it isn't configured.
  const warn = spyOn(console, 'warn').mockImplementation(() => {});
  const { ensureAppCheck, getAi } = await import('../src/lib/firebase');

  expect(warn).not.toHaveBeenCalled();
  ensureAppCheck();
  ensureAppCheck();
  getAi();
  expect(warn).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});
