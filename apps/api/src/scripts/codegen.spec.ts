import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Task 23 — OpenAPI codegen, no shared package.
 *
 * The API exports its openapi.json, and a root-level script copies
 * the generated TS types into each consuming app's local `types/`
 * directory. The apps stay totally independent — no shared npm
 * package, no monorepo import of `@paradis-immo/types`.
 *
 * These tests assert the *artifacts* (file presence + minimal shape)
 * rather than executing the pipeline end-to-end, to keep the test
 * fast and hermetic. The pipeline itself is exercised by hand
 * (pnpm generate:types) and on CI.
 */
const REPO = join(__dirname, '..', '..', '..', '..');
const API = join(REPO, 'apps', 'api');
const WEB = join(REPO, 'apps', 'web', 'types', 'api.ts');
const MOBILE = join(REPO, 'apps', 'mobile', 'types', 'api.ts');
const ROOT_SCRIPT = join(REPO, 'scripts', 'generate-types.mjs');
const EXPORT_SCRIPT = join(API, 'scripts', 'export-openapi.ts');
const OPENAPI_JSON = join(API, 'openapi.json');

describe('Task 23 — OpenAPI codegen (no shared package)', () => {
  it('exposes a root-level generate-types.mjs script', () => {
    expect(existsSync(ROOT_SCRIPT)).toBe(true);
  });

  it('exposes an API export-openapi script (apps/api/scripts/export-openapi.ts)', () => {
    expect(existsSync(EXPORT_SCRIPT)).toBe(true);
  });

  it('exports apps/api/openapi.json (committed for offline codegen)', () => {
    // We commit the snapshot so CI doesn't need to boot the API.
    expect(existsSync(OPENAPI_JSON)).toBe(true);
    const s = statSync(OPENAPI_JSON);
    expect(s.size).toBeGreaterThan(1024);
    const head = JSON.parse(readFileSync(OPENAPI_JSON, 'utf-8')) as {
      openapi?: string;
      info?: { title?: string };
      paths?: Record<string, unknown>;
    };
    expect(head.openapi).toMatch(/^3\./);
    expect(head.info?.title).toContain('Paradis Immo');
    expect(Object.keys(head.paths ?? {}).length).toBeGreaterThan(0);
  });

  it('produces apps/web/types/api.ts (local to the web app, no shared package)', () => {
    expect(existsSync(WEB)).toBe(true);
    const text = readFileSync(WEB, 'utf-8');
    // openapi-typescript emits a paths/component tree; the canonical
    // marker is the `paths` interface.
    expect(text).toMatch(/interface\s+paths\b/);
    // Crucially, the file must NOT import from any monorepo package.
    expect(text).not.toMatch(/@paradis-immo\/types/);
  });

  it('produces apps/mobile/types/api.ts (local to the mobile app)', () => {
    expect(existsSync(MOBILE)).toBe(true);
    const text = readFileSync(MOBILE, 'utf-8');
    expect(text).toMatch(/interface\s+paths\b/);
    expect(text).not.toMatch(/@paradis-immo\/types/);
  });

  it('web and mobile each have their OWN copy of the generated types (not symlinked, not shared)', () => {
    const a = statSync(WEB);
    const b = statSync(MOBILE);
    expect(a.ino).not.toBe(b.ino);
  });

  it('pnpm --filter api export:openapi script is wired in apps/api/package.json', () => {
    const apiPkg = JSON.parse(
      readFileSync(join(API, 'package.json'), 'utf-8'),
    ) as { scripts?: Record<string, string> };
    expect(apiPkg.scripts?.['export:openapi']).toBeDefined();
  });
});
