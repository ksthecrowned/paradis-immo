import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './config';

const ACCESS_KEY = 'paradisImmo.accessToken';
const REFRESH_KEY = 'paradisImmo.refreshToken';
const USER_KEY = 'paradisImmo.user';

export type AuthUser = {
  id: string;
  phone: string;
  name: string | null;
  email?: string | null;
  roles: string[];
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type TokenEnvelope = {
  accessToken?: string;
  refreshToken?: string;
  user?: AuthUser;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    user?: AuthUser;
  };
};

function unwrapTokens(body: TokenEnvelope): AuthTokens | null {
  const accessToken = body.accessToken ?? body.data?.accessToken;
  const refreshToken = body.refreshToken ?? body.data?.refreshToken;
  const user = body.user ?? body.data?.user;
  if (!accessToken || !refreshToken || !user?.id) return null;
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name ?? null,
      email: user.email ?? null,
      roles: user.roles ?? [],
    },
  };
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS_KEY, tokens.accessToken],
    [REFRESH_KEY, tokens.refreshToken],
    [USER_KEY, JSON.stringify(tokens.user)],
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_KEY);
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function updateStoredUser(
  patch: Partial<Pick<AuthUser, 'name' | 'email'>>,
): Promise<AuthUser | null> {
  const user = await getStoredUser();
  if (!user) return null;
  const next: AuthUser = {
    ...user,
    name: patch.name !== undefined ? patch.name : user.name,
    email: patch.email !== undefined ? patch.email : (user.email ?? null),
  };
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(next));
  return next;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return Boolean(token);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, USER_KEY]);
}

export async function logout(): Promise<void> {
  await clearSession();
}

export async function requestOtp(phone: string): Promise<void> {
  const res = await fetch(`${getApiUrl()}/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Impossible d\'envoyer le code');
  }
}

export async function verifyOtp(phone: string, code: string): Promise<AuthTokens> {
  const res = await fetch(`${getApiUrl()}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const body = (await res.json().catch(() => null)) as TokenEnvelope | { message?: string } | null;
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : 'Code invalide';
    throw new Error(message);
  }
  const tokens = unwrapTokens(body as TokenEnvelope);
  if (!tokens) throw new Error('Réponse auth invalide');
  await saveTokens(tokens);
  return tokens;
}

export async function refreshSession(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const res = await fetch(`${getApiUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const body = (await res.json().catch(() => null)) as TokenEnvelope | null;
  if (!res.ok || !body) {
    await clearSession();
    return null;
  }
  const tokens = unwrapTokens(body);
  if (!tokens) {
    await clearSession();
    return null;
  }
  await saveTokens(tokens);
  return tokens.accessToken;
}
