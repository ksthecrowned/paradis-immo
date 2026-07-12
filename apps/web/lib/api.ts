/**
 * apiFetch — typed wrapper around the Paradis Immo backend.
 *
 * - Reads the access token from the NextAuth session (cookie JWT).
 * - On 401, forces a session re-read (JWT callback may refresh via refreshToken),
 *   then retries once. If refresh failed, signs out on the client.
 */

import { API_URL } from '@/lib/config';

export { API_URL };

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** When true, skip attaching the Bearer token (public endpoints). */
  anonymous?: boolean;
};

/** Avoid hammering GET /api/auth/session on every parallel apiFetch. */
const TOKEN_CACHE_TTL_MS = 30_000;
let cachedAccessToken: string | null | undefined;
let cachedAccessTokenAt = 0;
let inflightSession: Promise<string | null> | null = null;

function readTokenCache(): string | null | undefined {
  if (cachedAccessToken === undefined) return undefined;
  if (Date.now() - cachedAccessTokenAt > TOKEN_CACHE_TTL_MS) {
    cachedAccessToken = undefined;
    return undefined;
  }
  return cachedAccessToken;
}

function writeTokenCache(token: string | null): void {
  cachedAccessToken = token;
  cachedAccessTokenAt = Date.now();
}

export function invalidateAccessTokenCache(): void {
  cachedAccessToken = undefined;
  cachedAccessTokenAt = 0;
  inflightSession = null;
}

async function resolveAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    const { auth } = await import('@/auth');
    const session = await auth();
    if (session?.error === 'RefreshAccessTokenError') return null;
    return session?.accessToken ?? null;
  }

  const cached = readTokenCache();
  if (cached !== undefined) return cached;

  if (!inflightSession) {
    inflightSession = (async () => {
      const { getSession } = await import('next-auth/react');
      const session = await getSession();
      if (session?.error === 'RefreshAccessTokenError') {
        writeTokenCache(null);
        return null;
      }
      const token = session?.accessToken ?? null;
      writeTokenCache(token);
      return token;
    })().finally(() => {
      inflightSession = null;
    });
  }
  return inflightSession;
}

async function forceSessionRefresh(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return resolveAccessToken();
  }
  invalidateAccessTokenCache();
  const { getSession, signOut } = await import('next-auth/react');
  const session = await getSession();
  if (session?.error === 'RefreshAccessTokenError') {
    await signOut({ callbackUrl: '/login' });
    writeTokenCache(null);
    return null;
  }
  const token = session?.accessToken ?? null;
  writeTokenCache(token);
  return token;
}

function unwrapData<T>(parsed: unknown): T {
  if (
    parsed &&
    typeof parsed === 'object' &&
    'data' in (parsed as Record<string, unknown>) &&
    'statusCode' in (parsed as Record<string, unknown>)
  ) {
    return (parsed as { data: T }).data;
  }
  return parsed as T;
}

function errorMessage(parsed: unknown, statusText: string, status: number): string {
  if (
    parsed &&
    typeof parsed === 'object' &&
    'message' in parsed &&
    typeof (parsed as { message?: unknown }).message === 'string'
  ) {
    return (parsed as { message: string }).message;
  }
  return statusText || `Request failed (${status})`;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, anonymous, headers, ...rest } = options;
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  const buildHeaders = async (token: string | null): Promise<Headers> => {
    const h = new Headers();
    if (body !== undefined) h.set('Content-Type', 'application/json');
    if (!anonymous && token) {
      h.set('Authorization', `Bearer ${token}`);
    }
    if (headers) {
      const incoming = new Headers(headers as HeadersInit);
      incoming.forEach((v, k) => h.set(k, v));
    }
    return h;
  };

  const exec = async (token: string | null): Promise<Response> => {
    return fetch(url, {
      ...rest,
      headers: await buildHeaders(token),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let token = anonymous ? null : await resolveAccessToken();
  let res = await exec(token);

  if (res.status === 401 && !anonymous) {
    token = await forceSessionRefresh();
    if (token) {
      res = await exec(token);
    }
  }

  const parsed = await parseBody(res);

  if (!res.ok) {
    throw new ApiError(errorMessage(parsed, res.statusText, res.status), res.status, parsed);
  }

  return unwrapData<T>(parsed);
}

type PaginatedApiBody<T> = {
  statusCode: number;
  data: T[];
  meta: { total: number; page: number; pageSize: number };
};

/**
 * Paginated list endpoints return `{ statusCode, data, meta }` at the
 * top level. `apiFetch` would drop `meta`, so lists use this helper.
 */
export async function apiFetchPaginated<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<{ data: T[]; meta: PaginatedApiBody<T>['meta'] & { totalPages: number } }> {
  const { body, anonymous, headers, ...rest } = options;
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  const buildHeaders = async (token: string | null): Promise<Headers> => {
    const h = new Headers();
    if (body !== undefined) h.set('Content-Type', 'application/json');
    if (!anonymous && token) {
      h.set('Authorization', `Bearer ${token}`);
    }
    if (headers) {
      const incoming = new Headers(headers as HeadersInit);
      incoming.forEach((v, k) => h.set(k, v));
    }
    return h;
  };

  const exec = async (token: string | null): Promise<Response> => {
    return fetch(url, {
      ...rest,
      headers: await buildHeaders(token),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let token = anonymous ? null : await resolveAccessToken();
  let res = await exec(token);

  if (res.status === 401 && !anonymous) {
    token = await forceSessionRefresh();
    if (token) {
      res = await exec(token);
    }
  }

  const parsed = await parseBody(res);

  if (!res.ok) {
    throw new ApiError(errorMessage(parsed, res.statusText, res.status), res.status, parsed);
  }

  const envelope = parsed as PaginatedApiBody<T>;
  const pageSize = envelope.meta?.pageSize ?? 20;
  const total = envelope.meta?.total ?? 0;

  return {
    data: envelope.data ?? [],
    meta: {
      total,
      page: envelope.meta?.page ?? 1,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    },
  };
}

export function __resetApiForTests(): void {
  invalidateAccessTokenCache();
}
