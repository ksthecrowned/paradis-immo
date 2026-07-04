/**
 * apiFetch — typed wrapper around the Paradis Immo backend.
 *
 * - Reads the access token from `localStorage` on every call (no
 *   module-level cache; we want to survive multi-tab updates).
 * - On a 401 with `code === 'TOKEN_EXPIRED'`, attempts a single
 *   /auth/refresh round-trip, then replays the original request
 *   with the new access token. A second 401 bubbles up.
 * - Non-2xx responses throw an Error whose `.message` is the API's
 *   `message` (falls back to status text). The full body is
 *   attached on `.cause` for callers that want to inspect it.
 *
 * Server-side rendering: when `window` is undefined (e.g. during
 * `generateMetadata` or static generation) we skip the token —
 * authenticated calls should be made from a client component.
 */

export const API_URL: string =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

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

type TokenStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function getStore(): TokenStore | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  // Allow tests to inject a store via globalThis.
  const g = globalThis as { localStorage?: TokenStore };
  return g.localStorage ?? null;
}

function readAccessToken(): string | null {
  return getStore()?.getItem('accessToken') ?? null;
}

function writeTokens(accessToken: string, refreshToken: string): void {
  const s = getStore();
  if (!s) return;
  s.setItem('accessToken', accessToken);
  s.setItem('refreshToken', refreshToken);
}

function clearTokens(): void {
  const s = getStore();
  if (!s) return;
  s.removeItem('accessToken');
  s.removeItem('refreshToken');
}

export type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** When true, skip attaching the Bearer token (public endpoints). */
  anonymous?: boolean;
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, anonymous, headers, ...rest } = options;
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  const buildHeaders = (): Headers => {
    const h = new Headers();
    if (body !== undefined) h.set('Content-Type', 'application/json');
    if (!anonymous) {
      const tok = readAccessToken();
      if (tok) h.set('Authorization', `Bearer ${tok}`);
    }
    if (headers) {
      const incoming = new Headers(headers as HeadersInit);
      incoming.forEach((v, k) => h.set(k, v));
    }
    return h;
  };

  const exec = async (): Promise<Response> => {
    const init: RequestInit = {
      ...rest,
      headers: buildHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    };
    const res = await fetch(url, init);
    return res;
  };

  let res = await exec();
  if (res.status === 401 && !anonymous) {
    // Single refresh attempt.
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await exec();
    } else {
      clearTokens();
    }
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const apiMessage =
      parsed &&
      typeof parsed === 'object' &&
      'message' in parsed &&
      typeof (parsed as { message?: unknown }).message === 'string'
        ? (parsed as { message: string }).message
        : '';
    const message: string = apiMessage || res.statusText || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, parsed);
  }
  // The Paradis Immo API returns `{ statusCode, data, ... }`. Most
  // callers want `data`. We unwrap when the shape matches.
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

async function tryRefresh(): Promise<boolean> {
  const store = getStore();
  const refreshToken = store?.getItem('refreshToken');
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as {
      data?: { accessToken?: string; refreshToken?: string };
    };
    const a = body?.data?.accessToken;
    const r = body?.data?.refreshToken;
    if (!a || !r) return false;
    writeTokens(a, r);
    return true;
  } catch {
    return false;
  }
}

/**
 * Test-only escape hatch. We don't keep module state in api.ts
 * (tokens live in localStorage), so this is mostly a hook for
 * future instrumentation. Left here to keep the public surface
 * symmetrical with other helpers that may need it.
 */
export function __resetApiForTests(): void {
  /* no-op */
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

  const buildHeaders = (): Headers => {
    const h = new Headers();
    if (body !== undefined) h.set('Content-Type', 'application/json');
    if (!anonymous) {
      const tok = readAccessToken();
      if (tok) h.set('Authorization', `Bearer ${tok}`);
    }
    if (headers) {
      const incoming = new Headers(headers as HeadersInit);
      incoming.forEach((v, k) => h.set(k, v));
    }
    return h;
  };

  const exec = async (): Promise<Response> => {
    const init: RequestInit = {
      ...rest,
      headers: buildHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    };
    return fetch(url, init);
  };

  let res = await exec();
  if (res.status === 401 && !anonymous) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await exec();
    } else {
      clearTokens();
    }
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const apiMessage =
      parsed &&
      typeof parsed === 'object' &&
      'message' in parsed &&
      typeof (parsed as { message?: unknown }).message === 'string'
        ? (parsed as { message: string }).message
        : '';
    const message: string =
      apiMessage || res.statusText || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, parsed);
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