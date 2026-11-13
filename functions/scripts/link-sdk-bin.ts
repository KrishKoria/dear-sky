/**
 * Runs after `bun install` in functions/ (the postinstall script).
 *
 * The Firebase CLI looks for exactly `node_modules/.bin/firebase-functions` to read the
 * Functions' definitions, for the emulator and for deploys. On Windows, Bun names its launcher
 * `firebase-functions.exe`, so the CLI fails with "Failed to find location of Firebase
 * Functions SDK". This writes a plain launcher under the expected name. The CLI starts it with
 * cross-spawn, which honours the `#!` line on Windows too.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const bin = join(import.meta.dir, '..', 'node_modules', '.bin');
const target = join(bin, 'firebase-functions');

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
