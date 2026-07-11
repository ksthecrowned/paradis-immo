import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { clearSession, isAuthenticated } from '@/lib/auth';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

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
        await apiFetch('/users/me');
        if (!cancelled) setStatus('authenticated');
      } catch {
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
