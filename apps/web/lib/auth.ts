/**
 * auth — high-level OTP flow.
 *
 *   requestOtp(phone)   → server sends a 4-digit code via WhatsApp
 *   verifyOtp(phone, code) → exchanges the code for a JWT pair
 *   logout()            → clears the local tokens
 *
 * Tokens are stored under `accessToken` / `refreshToken` keys in
 * localStorage so they survive page reloads and stay available
 * to the `apiFetch` helper.
 */
import { apiFetch, type ApiFetchOptions } from './api';

export interface AuthUser {
  id: string;
  phone: string;
  name?: string | null;
  roles?: string[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

function getStore() {
  if (typeof window !== 'undefined' && window.localStorage)
    return window.localStorage;
  const g = globalThis as { localStorage?: Storage };
  return g.localStorage ?? null;
}

export function getTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  const s = getStore();
  return {
    accessToken: s?.getItem('accessToken') ?? null,
    refreshToken: s?.getItem('refreshToken') ?? null,
  };
}

function persistSession(session: AuthSession): void {
  const s = getStore();
  if (!s) return;
  s.setItem('accessToken', session.accessToken);
  s.setItem('refreshToken', session.refreshToken);
}

export async function requestOtp(
  phone: string,
  options: ApiFetchOptions = {},
): Promise<void> {
  await apiFetch<{ data: { ok: true } }>('/auth/otp/request', {
    ...options,
    method: 'POST',
    body: { phone },
    anonymous: true,
  });
}

export async function verifyOtp(
  phone: string,
  code: string,
  options: ApiFetchOptions = {},
): Promise<AuthSession> {
  const session = await apiFetch<AuthSession>('/auth/otp/verify', {
    ...options,
    method: 'POST',
    body: { phone, code },
    anonymous: true,
  });
  persistSession(session);
  return session;
}

export function logout(): void {
  const s = getStore();
  if (!s) return;
  s.removeItem('accessToken');
  s.removeItem('refreshToken');
}