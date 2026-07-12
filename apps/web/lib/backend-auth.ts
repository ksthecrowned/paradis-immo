/**
 * Server-side calls to the Nest auth API (no NextAuth session).
 * Used by Credentials authorize + JWT refresh callback.
 */

import { API_URL } from '@/lib/config';

export type BackendAuthUser = {
  id: string;
  phone: string;
  name?: string | null;
  email?: string | null;
  roles: string[];
};

export type BackendAuthTokens = {
  accessToken: string;
  refreshToken: string;
  user: BackendAuthUser;
};

type TokenEnvelope = {
  accessToken?: string;
  refreshToken?: string;
  user?: BackendAuthUser;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    user?: BackendAuthUser;
  };
};

function unwrapTokens(body: TokenEnvelope): BackendAuthTokens | null {
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

export async function backendAdminLogin(
  email: string,
  password: string,
): Promise<BackendAuthTokens> {
  const res = await fetch(`${API_URL}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const body = (await res.json().catch(() => null)) as
    | TokenEnvelope
    | { message?: string }
    | null;
  if (!res.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'Email ou mot de passe incorrect';
    throw new Error(message);
  }
  const tokens = unwrapTokens(body as TokenEnvelope);
  if (!tokens) throw new Error('Réponse auth invalide');
  return tokens;
}

export async function backendAdminGoogle(
  idToken: string,
): Promise<BackendAuthTokens> {
  const res = await fetch(`${API_URL}/auth/admin/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const body = (await res.json().catch(() => null)) as
    | TokenEnvelope
    | { message?: string }
    | null;
  if (!res.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'Connexion Google refusée';
    throw new Error(message);
  }
  const tokens = unwrapTokens(body as TokenEnvelope);
  if (!tokens) throw new Error('Réponse auth invalide');
  return tokens;
}

export async function backendRequestOtp(
  phone: string,
  purpose: 'LOGIN' | 'REGISTER' = 'LOGIN',
): Promise<void> {
  const res = await fetch(`${API_URL}/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ phone, purpose }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Échec de l\'envoi du code');
  }
}

export async function backendVerifyOtp(
  phone: string,
  code: string,
  purpose: 'LOGIN' | 'REGISTER' = 'LOGIN',
): Promise<BackendAuthTokens> {
  const res = await fetch(`${API_URL}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ phone, code, purpose }),
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
  return tokens;
}

export async function backendRefreshTokens(
  refreshToken: string,
): Promise<BackendAuthTokens> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const body = (await res.json().catch(() => null)) as TokenEnvelope | null;
  if (!res.ok) {
    throw new Error('Refresh token invalide');
  }
  const tokens = unwrapTokens(body as TokenEnvelope);
  if (!tokens) throw new Error('Réponse refresh invalide');
  return tokens;
}

/** Access JWT TTL is 15m on the API — refresh 60s early. */
export const ACCESS_TOKEN_TTL_MS = 14 * 60 * 1000;
