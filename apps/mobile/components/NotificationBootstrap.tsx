import {
  registerPushTokenWithApi,
  setupNotifications,
  type NotificationDeepLink,
} from '@/lib/notifications';
import { isAuthenticated } from '@/lib/auth';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

function navigateToDeepLink(link: NotificationDeepLink): void {
  if (link.params) {
    router.push({
      pathname: link.pathname as never,
      params: link.params,
    });
    return;
  }
  router.push(link.pathname as never);
}

/**
 * Registers FCM token when a session exists and routes taps to in-app screens.
 * Mount once under the root layout.
 */
export function NotificationBootstrap(): null {
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const syncToken = async (): Promise<void> => {
      if (!(await isAuthenticated())) return;
      try {
        await registerPushTokenWithApi();
      } catch {
        // Permission denied / simulator / missing Firebase config — non-fatal.
      }
    };

    void (async () => {
      cleanup = await setupNotifications(navigateToDeepLink);
      if (cancelled) {
        cleanup();
        return;
      }
      await syncToken();
    })();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncToken();
    });

    return () => {
      cancelled = true;
      cleanup?.();
      sub.remove();
    };
  }, []);

  return null;
}
