'use client';

import {
  isWebPushConfigured,
  registerWebPushWithApi,
  setupForegroundPush,
} from '@/lib/web-push';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

/**
 * Registers this browser as an FCM WEB device when the user is signed in
 * on the management portal. Soft-fails when Firebase is not configured or
 * permission is denied.
 */
export function WebPushBootstrap(): null {
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (!isWebPushConfigured()) return;

    let cancelled = false;
    let stopForeground: (() => void) | undefined;

    void (async () => {
      try {
        await registerWebPushWithApi();
      } catch {
        // Permission / unsupported / missing config — non-fatal.
      }
      if (cancelled) return;

      try {
        stopForeground = await setupForegroundPush((payload) => {
          const title =
            payload.notification?.title ??
            payload.data?.type ??
            'Paradis Immo';
          const body =
            payload.notification?.body ??
            payload.data?.body ??
            payload.data?.message ??
            '';
          if (typeof window === 'undefined' || !('Notification' in window)) {
            return;
          }
          if (Notification.permission === 'granted') {
            new Notification(title, {
              body,
              icon: '/landing/logo.png',
              data: payload.data,
            });
          }
          window.dispatchEvent(
            new CustomEvent('paradis:push', { detail: payload }),
          );
        });
      } catch {
        // Foreground listener optional.
      }
    })();

    return () => {
      cancelled = true;
      stopForeground?.();
    };
  }, [status]);

  return null;
}
