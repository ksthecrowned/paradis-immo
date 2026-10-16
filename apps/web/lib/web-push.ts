import { apiFetch } from '@/lib/api';
import {
  getFirebaseMessaging,
  getFirebaseVapidKey,
  isWebPushConfigured,
  readFirebaseWebConfig,
} from '@/lib/firebase';
import { getToken, onMessage, type MessagePayload } from 'firebase/messaging';

const INSTALL_ID_KEY = 'paradisImmo.webInstallId';
const TOKEN_KEY = 'paradisImmo.webFcmToken';

export type WebPushRegistrationResult =
  | { ok: true; token: string; deviceId: string }
  | { ok: false; reason: string };

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable browser install id (localStorage) for UserDevice.deviceId. */
export function getWebInstallId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const existing = window.localStorage.getItem(INSTALL_ID_KEY);
    if (existing && existing.length >= 6) return existing;
    const created = randomId();
    window.localStorage.setItem(INSTALL_ID_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  const config = readFirebaseWebConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });

  return navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${params.toString()}`,
    { scope: '/' },
  );
}

/**
 * Request notification permission, obtain an FCM web token, register the
 * device on the API (platform WEB) and prefer PUSH delivery for this account.
 */
export async function registerWebPushWithApi(): Promise<WebPushRegistrationResult> {
  if (!isWebPushConfigured()) {
    return { ok: false, reason: 'NOT_CONFIGURED' };
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { ok: false, reason: 'UNSUPPORTED' };
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'PERMISSION_DENIED' };
  }

  const messaging = await getFirebaseMessaging();
  const vapidKey = getFirebaseVapidKey();
  if (!messaging || !vapidKey) {
    return { ok: false, reason: 'NOT_CONFIGURED' };
  }

  const sw = await ensureServiceWorker();
  if (!sw) {
    return { ok: false, reason: 'SERVICE_WORKER' };
  }

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: sw,
  });
  if (!token?.trim()) {
    return { ok: false, reason: 'EMPTY_TOKEN' };
  }

  const deviceId = getWebInstallId();

  // Legacy column still used by some send-path checks / older clients.
  await apiFetch('/users/me', {
    method: 'PATCH',
    body: {
      fcmToken: token,
      // Portal users who enable browser push opt into FCM delivery.
      notificationChannel: 'PUSH',
    },
  });

  await apiFetch('/notifications/devices', {
    method: 'POST',
    body: {
      deviceId,
      fcmToken: token,
      platform: 'WEB',
      appVersion:
        typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 32) : undefined,
      locale: typeof navigator !== 'undefined' ? navigator.language : 'fr',
    },
  });

  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore quota
  }

  return { ok: true, token, deviceId };
}

/** Unregister this browser from push (logout). */
export async function unregisterWebPushFromApi(): Promise<void> {
  if (typeof window === 'undefined') return;
  const deviceId = getWebInstallId();
  try {
    await apiFetch(`/notifications/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
  } catch {
    // Best-effort — session may already be invalid.
  }
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export type ForegroundPushHandler = (payload: MessagePayload) => void;

/** Listen for FCM messages while the tab is focused. */
export async function setupForegroundPush(
  onPush: ForegroundPushHandler,
): Promise<() => void> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => undefined;
  return onMessage(messaging, onPush);
}

export { isWebPushConfigured };
