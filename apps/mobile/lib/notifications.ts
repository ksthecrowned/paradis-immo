import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { apiFetch } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import {
  resolveNotificationRoute,
  type NotificationDeepLink,
} from '@/lib/notification-routes';

export type { NotificationDeepLink } from '@/lib/notification-routes';
export { resolveNotificationRoute } from '@/lib/notification-routes';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Paradis Immo',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7065F0',
  });
}

/**
 * Request permission and return the native FCM (Android) / APNs (iOS) token.
 * Throws when the token cannot be obtained on a physical device after grant.
 */
export async function obtainDevicePushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const token = await Notifications.getDevicePushTokenAsync();
  const value =
    typeof token.data === 'string' ? token.data : String(token.data ?? '');
  if (!value.trim()) {
    throw new Error('Jeton FCM vide — vérifiez google-services.json / APNs');
  }
  return value;
}

/** Permission + FCM token → PATCH /users/me. */
export async function registerPushTokenWithApi(): Promise<string | null> {
  if (!(await isAuthenticated())) return null;

  const token = await obtainDevicePushToken();
  if (!token) return null;

  await apiFetch('/users/me', {
    method: 'PATCH',
    body: { fcmToken: token },
  });

  return token;
}

export async function setupNotifications(
  onNavigate: (link: NotificationDeepLink) => void,
): Promise<() => void> {
  const navigateFromResponse = (
    response: Notifications.NotificationResponse | null | undefined,
  ): void => {
    if (!response) return;
    const data = response.notification.request.content.data as
      | Record<string, unknown>
      | undefined;
    const link = resolveNotificationRoute(data);
    if (link) onNavigate(link);
  };

  const last = await Notifications.getLastNotificationResponseAsync();
  navigateFromResponse(last);

  const responseSub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      navigateFromResponse(response);
    },
  );

  return () => {
    responseSub.remove();
  };
}
