#!/usr/bin/env node
/**
 * Bun on Windows can serve a corrupted rxjs from its global cache (missing
 * dist/cjs/internal/*.js). ride-api avoids this with a clean cache; here we
 * refresh only when the local install looks incomplete.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RXJS_ROOT = join(APP_ROOT, 'node_modules', 'rxjs');
const MARKER = join(RXJS_ROOT, 'dist', 'cjs', 'internal', 'config.js');

if (existsSync(MARKER)) {
  process.exit(0);
}

console.warn('[preinstall] incomplete rxjs install detected, refreshing from registry…');
spawnSync('bun', ['pm', 'cache', 'rm', 'rxjs'], { stdio: 'inherit', shell: true });

if (existsSync(RXJS_ROOT)) {
  rmSync(RXJS_ROOT, { recursive: true, force: true });
}
