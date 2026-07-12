import { apiFetch } from '@/lib/api';
import {
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveTokens,
  type AuthUser,
} from '@/lib/auth';
import type { SeekerExperience, SeekerIntent } from '@/lib/seeker-setup';

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
  seekerIntent: SeekerIntent | null;
  seekerExperience: SeekerExperience | null;
  budgetMinXaf: number | null;
  budgetMaxXaf: number | null;
  preferredQuartierIds: string[];
  seekerSetupCompletedAt: string | null;
};

export type UpdateMePatch = {
  name?: string;
  email?: string | null;
  avatarUrl?: string | null;
  notificationChannel?: NotificationChannelPreference;
  seekerIntent?: SeekerIntent | null;
  seekerExperience?: SeekerExperience | null;
  budgetMinXaf?: number | null;
  budgetMaxXaf?: number | null;
  preferredQuartierIds?: string[];
  completeSeekerSetup?: boolean;
};

export function toAuthUser(me: PublicUser, fallbackRoles?: string[]): AuthUser {
  return {
    id: me.id,
    phone: me.phone,
    name: me.name,
    email: me.email,
    roles: me.roles?.length ? me.roles : (fallbackRoles ?? []),
    seekerIntent: me.seekerIntent,
    seekerExperience: me.seekerExperience,
    budgetMinXaf: me.budgetMinXaf,
    budgetMaxXaf: me.budgetMaxXaf,
    preferredQuartierIds: me.preferredQuartierIds ?? [],
    seekerSetupCompletedAt: me.seekerSetupCompletedAt,
  };
}

export async function fetchMe(): Promise<PublicUser> {
  return apiFetch<PublicUser>('/users/me');
}

export async function updateMe(patch: UpdateMePatch): Promise<PublicUser> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.email != null && patch.email.trim()) {
    body.email = patch.email.trim();
  }
  if (patch.avatarUrl) body.avatarUrl = patch.avatarUrl;
  if (patch.notificationChannel) {
    body.notificationChannel = patch.notificationChannel;
  }
  if (patch.seekerIntent !== undefined && patch.seekerIntent !== null) {
    body.seekerIntent = patch.seekerIntent;
  }
  if (patch.seekerExperience !== undefined && patch.seekerExperience !== null) {
    body.seekerExperience = patch.seekerExperience;
  }
  if (patch.budgetMinXaf !== undefined && patch.budgetMinXaf !== null) {
    body.budgetMinXaf = patch.budgetMinXaf;
  }
  if (patch.budgetMaxXaf !== undefined && patch.budgetMaxXaf !== null) {
    body.budgetMaxXaf = patch.budgetMaxXaf;
  }
  if (patch.preferredQuartierIds !== undefined) {
    body.preferredQuartierIds = patch.preferredQuartierIds;
  }
  if (patch.completeSeekerSetup === true) {
    body.completeSeekerSetup = true;
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

export async function updateMeAndSync(
  patch: UpdateMePatch,
): Promise<AuthUser> {
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
