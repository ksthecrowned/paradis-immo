import * as fs from 'fs';
import * as path from 'path';
import { DOMAIN_EVENTS } from '../events/event.types';
import { INTENTIONALLY_UNHANDLED_DOMAIN_EVENTS } from './domain-events-unhandled.registry';

/**
 * Spec 11 — chaque entrée de `DOMAIN_EVENTS` doit avoir au moins un listener
 * `@OnEvent`, ou figurer dans l'allowlist des écarts documentés.
 *
 * Découverte des handlers : scan statique des sources sous `src/` (hors specs),
 * motif `@OnEvent(DOMAIN_EVENTS.<KEY>)`. Échoue si un nouvel événement est
 * ajouté sans handler ni allowlist, ou si l'allowlist reste pour un événement
 * désormais câblé.
 */
function collectOnEventDomainEventKeys(srcRoot: string): Set<string> {
  const keys = new Set<string>();
  const re = /@OnEvent\(\s*DOMAIN_EVENTS\.([A-Z][A-Z0-9_]*)/g;

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) {
        continue;
      }
      const text = fs.readFileSync(full, 'utf8');
      for (const match of text.matchAll(re)) {
        keys.add(match[1]);
      }
    }
  };

  walk(srcRoot);
  return keys;
}

describe('DOMAIN_EVENTS coverage (spec 11)', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const domainKeys = Object.keys(DOMAIN_EVENTS) as Array<
    keyof typeof DOMAIN_EVENTS
  >;
  const allowlist = new Set<string>(INTENTIONALLY_UNHANDLED_DOMAIN_EVENTS);

  it('allowlist entries are keys of DOMAIN_EVENTS', () => {
    const unknown = INTENTIONALLY_UNHANDLED_DOMAIN_EVENTS.filter(
      (key) => !(key in DOMAIN_EVENTS),
    );
    expect(unknown).toEqual([]);
  });

  it('every DOMAIN_EVENTS key has an @OnEvent listener or is allowlisted', () => {
    const handled = collectOnEventDomainEventKeys(srcRoot);

    const missing: string[] = [];
    for (const key of domainKeys) {
      if (!handled.has(key) && !allowlist.has(key)) {
        missing.push(key);
      }
    }

    const staleAllowlist = INTENTIONALLY_UNHANDLED_DOMAIN_EVENTS.filter(
      (key) => handled.has(key),
    );

    expect({ missing, staleAllowlist }).toEqual({
      missing: [],
      staleAllowlist: [],
    });
  });
});
