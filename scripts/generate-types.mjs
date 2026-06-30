#!/usr/bin/env node
/**
 * Task 23 — OpenAPI codegen, no shared package.
 *
 * Reads `apps/api/openapi.json` (committed snapshot, refreshed by
 * `pnpm export:openapi` whenever controllers change) and emits a
 * TypeScript declaration file **per consuming app**, in-place:
 *
 *   apps/web/types/api.ts
 *   apps/mobile/types/api.ts
 *
 * Each app keeps its own copy. There is intentionally no shared
 * npm package — web and mobile stay totally independent.
 *
 * Usage:
 *   pnpm generate:types                       # uses apps/api/openapi.json
 *   pnpm generate:types --openapi <path>      # explicit input file
 *   pnpm generate:types --api <id> --web <id> # explicit targets
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO = resolve(__dirname, '..');

const args = parseArgs(process.argv.slice(2));

const DEFAULT_OPENAPI = join(REPO, 'apps', 'api', 'openapi.json');
const DEFAULT_TARGETS = [
  { app: 'web', out: join(REPO, 'apps', 'web', 'types', 'api.ts') },
  { app: 'mobile', out: join(REPO, 'apps', 'mobile', 'types', 'api.ts') },
];

const openapiPath = resolve(REPO, args.openapi ?? DEFAULT_OPENAPI);
const targets = DEFAULT_TARGETS.filter((t) => !args[t.app] || args[t.app]);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--openapi') {
      out.openapi = argv[++i];
    } else if (a.startsWith('--')) {
      out[a.slice(2)] = argv[++i];
    }
  }
  return out;
}

function log(...parts) {
  // eslint-disable-next-line no-console
  console.log('[generate:types]', ...parts);
}

function fail(msg) {
  // eslint-disable-next-line no-console
  console.error('[generate:types] ERROR:', msg);
  process.exit(1);
}

if (!existsSync(openapiPath)) {
  fail(
    `OpenAPI snapshot not found at ${openapiPath}. ` +
      `Run \`pnpm export:openapi\` first.`,
  );
}

const doc = JSON.parse(readFileSync(openapiPath, 'utf-8'));
if (!doc.openapi || !doc.paths) {
  fail(`${openapiPath} does not look like an OpenAPI 3.x document.`);
}
log(
  `source: ${openapiPath} (${Object.keys(doc.paths).length} paths, ${
    Object.keys(doc.components?.schemas ?? {}).length
  } schemas)`,
);

// Resolve the openapi-typescript binary. It ships its own
// node-only entry; no transpile needed.
const bin = resolveOpenapiTypescriptBin();
log(`codegen: ${bin}`);

for (const t of targets) {
  // Write the spec to a sibling temp file so we can pass it as a
  // positional argument and the import paths in the generated
  // output remain stable (`./api.ts`).
  const tmp = join(REPO, 'apps', 'api', 'openapi.cg.tmp.json');
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, JSON.stringify(doc), 'utf-8');

  const result = spawnSync(process.execPath, [bin, tmp], {
    cwd: REPO,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    rmSync(tmp, { force: true });
    fail(
      `openapi-typescript failed for ${t.app}: ${result.stderr || result.stdout}`,
    );
  }
  mkdirSync(dirname(t.out), { recursive: true });
  writeFileSync(t.out, normalize(result.stdout), 'utf-8');
  rmSync(tmp, { force: true });
  log(`wrote ${t.out} (${result.stdout.length.toLocaleString()} bytes)`);
}

log('done.');

/**
 * Re-shape the emitted header so the file is self-describing and
 * `noEmit` works in TypeScript strict mode (openapi-typescript emits
 * `.ts` already, but we tighten the header).
 */
function normalize(src) {
  const banner =
    '// AUTO-GENERATED — DO NOT EDIT.\n' +
    '// Source: apps/api/openapi.json — regenerate via `pnpm generate:types`.\n' +
    '// Each app keeps its own copy; there is no shared package.\n\n';
  return banner + src.trimStart();
}

function resolveOpenapiTypescriptBin() {
  // openapi-typescript 7.x layout: ./node_modules/openapi-typescript/bin/cli.js
  const candidates = [
    join(REPO, 'node_modules', 'openapi-typescript', 'bin', 'cli.js'),
    join(REPO, 'node_modules', '.pnpm', 'openapi-typescript', 'node_modules', 'openapi-typescript', 'bin', 'cli.js'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  fail(
    'openapi-typescript binary not found. Run `pnpm install` at the repo root.',
  );
}