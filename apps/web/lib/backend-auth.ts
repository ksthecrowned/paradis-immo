/**
 * Server-side calls to the Nest auth API (no NextAuth session).
 * Used by Credentials authorize + JWT refresh callback.
 */

import { API_URL } from '@/lib/config';

export type BackendAuthUser = {
  id: string;
  phone: string | null;
  name?: string | null;
  email?: string | null;
  roles: string[];
  orgRoles: string[];
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

function errorMessage(
  body: unknown,
  fallback: string,
): string {
  if (
    body &&
    typeof body === 'object' &&
    'message' in body &&
    typeof (body as { message: unknown }).message === 'string'
  ) {
    return (body as { message: string }).message;
  }
  return fallback;
}

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
      phone: user.phone ?? null,
      name: user.name ?? null,
      email: user.email ?? null,
      roles: user.roles ?? [],
      orgRoles: user.orgRoles ?? [],
    },
  };
}

export async function backendWebRegister(email: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/web/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(errorMessage(body, 'Échec de l’inscription'));
  }
}

export async function backendWebMagicConsume(
  token: string,
  password: string,
): Promise<BackendAuthTokens> {
  const res = await fetch(`${API_URL}/auth/web/magic/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const body = (await res.json().catch(() => null)) as TokenEnvelope | null;
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Lien invalide ou expiré'));
  }
  const tokens = unwrapTokens(body as TokenEnvelope);
  if (!tokens) throw new Error('Réponse auth invalide');
  return tokens;
}

export async function backendWebLogin(
  email: string,
  password: string,
): Promise<BackendAuthTokens> {
  const res = await fetch(`${API_URL}/auth/web/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const body = (await res.json().catch(() => null)) as TokenEnvelope | null;
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Email ou mot de passe incorrect'));
  }
  const tokens = unwrapTokens(body as TokenEnvelope);
  if (!tokens) throw new Error('Réponse auth invalide');
  return tokens;
}

export async function backendWebGoogle(
  idToken: string,
): Promise<BackendAuthTokens> {
  const res = await fetch(`${API_URL}/auth/web/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const body = (await res.json().catch(() => null)) as TokenEnvelope | null;
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Connexion Google refusée'));
  }
  const tokens = unwrapTokens(body as TokenEnvelope);
  if (!tokens) throw new Error('Réponse auth invalide');
  return tokens;
}

export async function backendWebSetRole(
  accessToken: string,
  role: 'OWNER' | 'AGENT',
): Promise<BackendAuthTokens> {
  const res = await fetch(`${API_URL}/auth/web/role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ role }),
  });
  const body = (await res.json().catch(() => null)) as TokenEnvelope | null;
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Impossible de définir le rôle'));
  }
  const tokens = unwrapTokens(body as TokenEnvelope);
  if (!tokens) throw new Error('Réponse auth invalide');
  return tokens;
}

/** @deprecated Prefer backendWebLogin */
export async function backendAdminLogin(
  email: string,
  password: string,
): Promise<BackendAuthTokens> {
  return backendWebLogin(email, password);
}

/** @deprecated Prefer backendWebGoogle */
export async function backendAdminGoogle(
  idToken: string,
): Promise<BackendAuthTokens> {
  return backendWebGoogle(idToken);
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
