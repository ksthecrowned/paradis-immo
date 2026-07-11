/**
 * Auth helpers on top of NextAuth (OTP credentials + JWT session).
 *
 * - `requestOtp` hits the Nest API (anonymous).
 * - `loginWithOtp` calls NextAuth `signIn('otp')` which stores access + refresh
 *   tokens in the encrypted session JWT and refreshes them in `auth.ts`.
 * - `logout` / `getSessionAccessToken` wrap next-auth/react.
 */
import { signIn, signOut, getSession } from 'next-auth/react';
import { backendRequestOtp } from '@/lib/backend-auth';

export type { BackendAuthUser as AuthUser } from '@/lib/backend-auth';

export async function requestOtp(phone: string): Promise<void> {
  await backendRequestOtp(phone.trim());
}

/**
 * Exchange phone + OTP for a NextAuth session (accessToken + refreshToken).
 */
export async function loginWithOtp(
  phone: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await signIn('otp', {
    phone: phone.trim(),
    code: code.trim(),
    redirect: false,
  });

  if (!result || result.error) {
    return { ok: false, error: 'Code invalide ou expiré' };
  }
  return { ok: true };
}

export async function logout(callbackUrl = '/login'): Promise<void> {
  await signOut({ callbackUrl });
}

/** Client-side access token from the current session (triggers JWT refresh if expired). */
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

/** @deprecated Prefer getSessionAccessToken — kept for gradual migration. */
export function getTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  return { accessToken: null, refreshToken: null };
}
