import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { clearSession, isAuthenticated } from '@/lib/auth';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

const SESSION_CHECK_MS = 8_000;

/**
 * Validates the stored session (token present + `/users/me` succeeds).
 * Mirrors web `useRequireSession` for mobile protected routes.
 */
export function useRequireAuth(): {
  status: AuthStatus;
  ready: boolean;
  authed: boolean;
} {
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const hasToken = await isAuthenticated();
      if (!hasToken) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }

      try {
        await Promise.race([
          apiFetch('/users/me'),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error('SESSION_CHECK_TIMEOUT')),
              SESSION_CHECK_MS,
            );
          }),
        ]);
        if (!cancelled) setStatus('authenticated');
      } catch (err) {
        // Offline / slow API: keep local session rather than hanging forever.
        if (
          err instanceof Error &&
          err.message === 'SESSION_CHECK_TIMEOUT'
        ) {
          if (!cancelled) setStatus('authenticated');
          return;
        }
        await clearSession();
        if (!cancelled) setStatus('unauthenticated');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    status,
    ready: status !== 'loading',
    authed: status === 'authenticated',
  };
}
