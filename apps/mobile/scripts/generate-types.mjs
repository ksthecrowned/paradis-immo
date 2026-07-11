#!/usr/bin/env node
/**
 * Generate TypeScript types from the API OpenAPI snapshot.
 * Run from apps/mobile after updating apps/api/openapi.json.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OPENAPI = join(APP_ROOT, '..', 'api', 'openapi.json');
const OUT = join(APP_ROOT, 'types', 'api.ts');

if (!existsSync(OPENAPI)) {
  console.error(
    `[generate:types] Missing ${OPENAPI}. Run \`bun run export:openapi\` in apps/api first.`,
  );
  process.exit(1);
}

const result = spawnSync(
  'bunx',
  ['openapi-typescript', OPENAPI],
  { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  '// AUTO-GENERATED — DO NOT EDIT.\n' +
    '// Source: apps/api/openapi.json — regenerate via `bun run generate:types`.\n\n' +
    result.stdout.trimStart(),
  'utf-8',
);

console.log(`[generate:types] wrote ${OUT}`);
