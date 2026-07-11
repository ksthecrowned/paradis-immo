'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Redirects to /login when unauthenticated or when refresh failed.
 * Returns session status for loading gates.
 */
export function useRequireSession(): {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  ready: boolean;
} {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (status === 'authenticated' && session?.error === 'RefreshAccessTokenError') {
      router.replace('/login');
    }
  }, [status, session?.error, router]);

  return {
    status,
    ready: status === 'authenticated' && session?.error !== 'RefreshAccessTokenError',
  };
}
