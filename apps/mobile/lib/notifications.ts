import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { apiFetch } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationDeepLink = {
  pathname: string;
  params?: Record<string, string>;
};

export function resolveNotificationRoute(
  data: Record<string, unknown> | undefined,
): NotificationDeepLink | null {
  if (!data) return null;

  const propertyId = data.propertyId;
  if (typeof propertyId === 'string' && propertyId.length > 0) {
    return { pathname: '/property/[id]', params: { id: propertyId } };
  }

  const paymentId = data.paymentId;
  if (typeof paymentId === 'string' && paymentId.length > 0) {
    return { pathname: '/payment/[id]', params: { id: paymentId } };
  }

  if (data.screen === 'activity') {
    return { pathname: '/(tabs)/activity' };
  }

  const type = data.type;
  if (
    type === 'VISIT_CONFIRMED' ||
    type === 'RENT_DUE_SOON' ||
    type === 'RENT_OVERDUE' ||
    type === 'PAYMENT_RECEIPT_READY'
  ) {
    return { pathname: '/(tabs)/activity' };
  }

  return null;
}

async function obtainDevicePushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Paradis Immo',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7065F0',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}

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

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateFromResponse(response);
  });

  return () => sub.remove();
}
