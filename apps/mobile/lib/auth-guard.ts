import type { Router } from 'expo-router';
import { isAuthenticated } from '@/lib/auth';

const ALLOWED_PREFIXES = ['/(tabs)', '/property/', '/payment/'] as const;

/** Whitelist internal paths used for post-login redirects. */
export function sanitizeReturnTo(path: string | undefined): string {
  if (!path || !path.startsWith('/') || path.includes('..')) {
    return '/(tabs)';
  }
  const allowed = ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
  return allowed ? path : '/(tabs)';
}

export function loginHref(returnTo?: string): {
  pathname: '/(auth)/login';
  params: { returnTo: string };
} {
  return {
    pathname: '/(auth)/login',
    params: { returnTo: sanitizeReturnTo(returnTo) },
  };
}

/**
 * Redirects unauthenticated users to login. Returns true when the caller may proceed.
 */
export async function ensureAuthenticated(
  router: Router,
  returnTo: string,
): Promise<boolean> {
  if (await isAuthenticated()) return true;
  router.push(loginHref(returnTo));
  return false;
}
