import { isAuthenticated } from '@/lib/auth';
import { onAccountDeleted } from '@/lib/account-deleted-signal';
import { fetchMe } from '@/lib/users';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

/** The only route a DELETED account may use — never redirect away from it. */
const RECOVERY_PATH = '/account/recovery';

function isRecoveryRoute(pathname: string | null): boolean {
  return Boolean(pathname?.startsWith(RECOVERY_PATH));
}

/**
 * Spec 01 — a DELETED account can sign back in during the 30-day window, but
 * the API guard answers 403 `ACCOUNT_DELETED` everywhere except the recovery
 * route. `apiFetch` emits a signal instead of navigating; this gate turns it
 * into one navigation and keeps the user on the recovery screen afterwards.
 *
 * It also probes `GET /users/me` once at boot so a reconnected DELETED account
 * lands on the recovery screen without waiting for a failing feature call.
 */
export function AccountDeletedGate(): null {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef<string | null>(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    return onAccountDeleted(() => {
      if (isRecoveryRoute(pathRef.current)) return;
      router.replace(RECOVERY_PATH);
    });
  }, [router]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!(await isAuthenticated())) return;
      try {
        await fetchMe();
      } catch {
        // 401/403 are handled by the gates and screens that own the session;
        // a successful call needs nothing here.
      }
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, []);

  return null;
}
