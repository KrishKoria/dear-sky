/**
 * Runs after installing in functions/ (the postinstall script). Windows only.
 *
 * The Firebase CLI looks for exactly `node_modules/.bin/firebase-functions` to read the
 * Functions' definitions, for the emulator and for deploys. On Windows, Bun names its launcher
 * `firebase-functions.exe`, so the CLI fails with "Failed to find location of Firebase
 * Functions SDK". This writes a plain launcher under the expected name. The CLI starts it with
 * cross-spawn, which honours the `#!` line on Windows too.
 *
 * Plain JavaScript run by `node`, not Bun: Google's Cloud Build also runs postinstall when it
 * packages the deployed function, and Bun may not be installed there. Elsewhere than Windows
 * the launcher already has the right name, so this does nothing.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

if (process.platform === 'win32') {
  const bin = fileURLToPath(new URL('../node_modules/.bin/', import.meta.url));
  const target = bin + 'firebase-functions';

  if (!existsSync(target)) {
    mkdirSync(bin, { recursive: true });
    // Works whether Node treats this extensionless file as CommonJS or as an ES module.
    writeFileSync(
      target,
      `#!/usr/bin/env node
const self = 'file:///' + process.argv[1].replace(/\\\\/g, '/').replace(/^\\//, '');
import(new URL('../firebase-functions/lib/bin/firebase-functions.js', self).href);
`,
    );
    console.log('linked node_modules/.bin/firebase-functions for the Firebase CLI');
  }
}
