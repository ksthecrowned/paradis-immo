import { describe, expect, test } from 'bun:test';
import { compareSemanticVersions } from './semantic-version';

describe('compareSemanticVersions', () => {
  test('compares numeric version components numerically', () => {
    expect(compareSemanticVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareSemanticVersions('2.0.0', '2.0.0')).toBe(0);
    expect(compareSemanticVersions('1.2.3', '1.2.4')).toBe(-1);
  });

  test('compares prereleases below their stable release', () => {
    expect(compareSemanticVersions('1.0.0-rc.1', '1.0.0')).toBe(-1);
    expect(compareSemanticVersions('1.0.0-alpha.2', '1.0.0-alpha.10')).toBe(
      -1,
    );
    expect(compareSemanticVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
  });

  test('ignores build metadata', () => {
    expect(compareSemanticVersions('1.2.3+build.4', '1.2.3+build.5')).toBe(0);
  });

  test('returns null for malformed versions', () => {
    expect(compareSemanticVersions('1.2', '1.2.0')).toBeNull();
    expect(compareSemanticVersions('1.02.0', '1.2.0')).toBeNull();
    expect(compareSemanticVersions('1.2.0-01', '1.2.0')).toBeNull();
    expect(compareSemanticVersions('1.2.0-alpha.', '1.2.0')).toBeNull();
  });
});
