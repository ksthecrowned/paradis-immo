/**
 * Client-side cache: agency storefront gate already verified for this user.
 * Avoids re-calling /users/me/organizations on every agent navigation.
 */

const KEY_PREFIX = 'paradisImmo.agencyStorefrontComplete.';

function readStore(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  const g = globalThis as { localStorage?: Storage };
  return g.localStorage ?? null;
}

export function isAgencyStorefrontCompleteCached(userId: string): boolean {
  if (!userId) return false;
  return readStore()?.getItem(`${KEY_PREFIX}${userId}`) === '1';
}

export function setAgencyStorefrontCompleteCached(
  userId: string,
  complete: boolean,
): void {
  if (!userId) return;
  const store = readStore();
  if (!store) return;
  const key = `${KEY_PREFIX}${userId}`;
  if (complete) store.setItem(key, '1');
  else store.removeItem(key);
}

/** Clear all storefront gate cache entries (e.g. on logout). */
export function clearAgencyStorefrontCompleteCache(): void {
  const store = readStore();
  if (!store) return;
  const toRemove: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key?.startsWith(KEY_PREFIX)) toRemove.push(key);
  }
  for (const key of toRemove) store.removeItem(key);
}

export function agencyStorefrontNeedsSetup(
  organizations: Array<{
    type: string;
    memberRole: string;
    shortName: string | null;
  }>,
): boolean {
  return organizations.some(
    (organization) =>
      organization.type === 'AGENCY' &&
      organization.memberRole === 'ADMIN' &&
      !organization.shortName?.trim(),
  );
}
