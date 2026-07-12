import { apiFetch } from '@/lib/api';
import {
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveTokens,
  type AuthUser,
} from '@/lib/auth';

export type NotificationChannelPreference = 'PUSH' | 'SMS';

export type PublicUser = {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  notificationChannel: NotificationChannelPreference;
  countryId: string;
  roles: string[];
  createdAt: string;
};

export function toAuthUser(me: PublicUser, fallbackRoles?: string[]): AuthUser {
  return {
    id: me.id,
    phone: me.phone,
    name: me.name,
    email: me.email,
    roles: me.roles?.length ? me.roles : (fallbackRoles ?? []),
  };
}

export async function fetchMe(): Promise<PublicUser> {
  return apiFetch<PublicUser>('/users/me');
}

export async function updateMe(patch: {
  name?: string;
  email?: string | null;
  avatarUrl?: string | null;
  notificationChannel?: NotificationChannelPreference;
}): Promise<PublicUser> {
  const body: Record<string, string> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.email != null && patch.email.trim()) {
    body.email = patch.email.trim();
  }
  if (patch.avatarUrl) body.avatarUrl = patch.avatarUrl;
  if (patch.notificationChannel) {
    body.notificationChannel = patch.notificationChannel;
  }
  return apiFetch<PublicUser>('/users/me', {
    method: 'PATCH',
    body,
  });
}

/** Fetch /users/me and refresh the local auth cache. */
export async function syncStoredUserFromApi(): Promise<AuthUser | null> {
  const [accessToken, refreshToken, stored] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
    getStoredUser(),
  ]);
  if (!accessToken || !refreshToken) return null;

  const me = await fetchMe();
  const user = toAuthUser(me, stored?.roles);
  await saveTokens({ accessToken, refreshToken, user });
  return user;
}

export async function updateMeAndSync(patch: {
  name?: string;
  email?: string | null;
  notificationChannel?: NotificationChannelPreference;
}): Promise<AuthUser> {
  const me = await updateMe(patch);
  const [accessToken, refreshToken, stored] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
    getStoredUser(),
  ]);
  const user = toAuthUser(me, stored?.roles);
  if (accessToken && refreshToken) {
    await saveTokens({ accessToken, refreshToken, user });
  }
  return user;
}
