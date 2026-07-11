#!/usr/bin/env node
/**
 * Regenerate OpenAPI TypeScript types in web and mobile.
 * Each app runs its own script (no shared node_modules).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const app of ['web', 'mobile']) {
  const cwd = join(ROOT, 'apps', app);
  console.log(`[generate:types] ${app}…`);
  const result = spawnSync('bun', ['run', 'generate:types'], {
    cwd,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('[generate:types] done.');
