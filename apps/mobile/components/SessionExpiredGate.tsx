import { onSessionEnd } from '@/lib/auth';
import { loginHref } from '@/lib/auth-guard';
import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

function isAuthRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/(auth)') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/otp-verify') ||
    pathname.startsWith('/welcome') ||
    pathname.startsWith('/onboarding')
  );
}

/**
 * Global bridge: when refresh fails and the session is wiped, send the user
 * to login. Intentional logout uses reason `logout` and navigates itself.
 */
export function SessionExpiredGate(): null {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    return onSessionEnd((reason) => {
      if (reason !== 'expired') return;
      if (isAuthRoute(pathname)) return;
      router.replace(loginHref(pathname ?? '/(tabs)'));
    });
  }, [router, pathname]);

  return null;
}
