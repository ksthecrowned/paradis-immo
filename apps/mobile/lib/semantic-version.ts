interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: Array<number | string>;
}

function parseVersion(value: string): ParsedVersion | null {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(
      value.trim(),
    );
  if (!match) return null;

  const prerelease: Array<number | string> = [];
  for (const part of match[4]?.split('.') ?? []) {
    if (/^\d+$/.test(part)) {
      if (part.length > 1 && part.startsWith('0')) return null;
      prerelease.push(Number(part));
    } else {
      prerelease.push(part);
    }
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  };
}

/** Returns null when either version is malformed. */
export function compareSemanticVersions(
  left: string,
  right: string,
): -1 | 0 | 1 | null {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;

  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] < b[key]) return -1;
    if (a[key] > b[key]) return 1;
  }

  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const aPart = a.prerelease[index];
    const bPart = b.prerelease[index];
    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;
    if (aPart === bPart) continue;
    if (typeof aPart === 'number' && typeof bPart === 'string') return -1;
    if (typeof aPart === 'string' && typeof bPart === 'number') return 1;
    return aPart < bPart ? -1 : 1;
  }
  return 0;
}
