/**
 * Auth helpers on top of NextAuth (web password + Google).
 */
import { signIn, signOut, getSession } from 'next-auth/react';
import { backendWebRegister } from '@/lib/backend-auth';

export type { BackendAuthUser as AuthUser } from '@/lib/backend-auth';

export async function registerWeb(email: string): Promise<void> {
  await backendWebRegister(email.trim());
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await signIn('web-password', {
    email: email.trim(),
    password,
    redirect: false,
  });
  if (!result || result.error) {
    return { ok: false, error: 'Email ou mot de passe incorrect' };
  }
  return { ok: true };
}

export async function logout(callbackUrl = '/login'): Promise<void> {
  await signOut({ callbackUrl });
}

export async function getSessionAccessToken(): Promise<string | null> {
  const session = await getSession();
  if (session?.error === 'RefreshAccessTokenError') {
    return null;
  }
  return session?.accessToken ?? null;
}

export async function getClientSession() {
  return getSession();
}
