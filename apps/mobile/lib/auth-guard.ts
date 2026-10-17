import { router as appRouter } from 'expo-router';
import { isAuthenticated } from '@/lib/auth';
import { sanitizeReturnTo } from '@/lib/auth-return-to';

export { sanitizeReturnTo } from '@/lib/auth-return-to';

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
  router: typeof appRouter,
  returnTo: string,
): Promise<boolean> {
  if (await isAuthenticated()) return true;
  router.push(loginHref(returnTo));
  return false;
}
