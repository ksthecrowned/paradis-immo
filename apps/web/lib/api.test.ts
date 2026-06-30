/**
 * @jest-environment node
 *
 * Tests for the web apiFetch helper. We mock global.fetch and a
 * minimal localStorage-like object so the module sees a
 * browser-shaped environment without pulling in jsdom.
 */
import {
  apiFetch,
  __resetApiForTests,
  API_URL,
} from '@/lib/api';

type FetchCall = {
  url: string;
  init: RequestInit;
};

const fetchMock = jest.fn() as jest.Mock<
  Promise<Response>,
  [string | URL | Request, RequestInit?]
>;
const store: Record<string, string> = {};

const realFetch = global.fetch;
const realWindow = (global as unknown as { window?: unknown }).window;
const realLocalStorage = (global as unknown as {
  localStorage?: unknown;
}).localStorage;

beforeEach(() => {
  __resetApiForTests();
  fetchMock.mockReset();
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  (global as unknown as { window: { localStorage: typeof store } }).window = {
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  };
  (global as unknown as { localStorage: typeof store }).localStorage =
    (global as unknown as { window: { localStorage: typeof store } }).window
      .localStorage;
  for (const k of Object.keys(store)) delete store[k];
});

afterAll(() => {
  (global as unknown as { fetch: typeof fetch }).fetch = realFetch;
  if (realWindow === undefined) {
    delete (global as unknown as { window?: unknown }).window;
  } else {
    (global as unknown as { window: typeof realWindow }).window = realWindow;
  }
  if (realLocalStorage === undefined) {
    delete (global as unknown as { localStorage?: unknown }).localStorage;
  } else {
    (global as unknown as { localStorage: typeof realLocalStorage }).localStorage =
      realLocalStorage as typeof realLocalStorage;
  }
});

function mockResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(init.headers ?? {}),
  } as unknown as Response;
}

function lastFetch(): FetchCall {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  return { url: String(call[0]), init: (call[1] ?? {}) as RequestInit };
}

describe('apiFetch', () => {
  it('exports a default API_URL that targets /api/v1', () => {
    expect(API_URL).toMatch(/\/api\/v1$/);
  });

  it('hits the API_URL with the path appended', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ statusCode: 200, data: { ok: 1 } }),
    );
    const out = await apiFetch<{ ok: number }>('/health');
    expect(out).toEqual({ ok: 1 });
    const { url, init } = lastFetch();
    expect(url.startsWith(API_URL)).toBe(true);
    expect(url.endsWith('/health')).toBe(true);
    expect(init.method ?? 'GET').toBe('GET');
  });

  it('attaches Bearer token from localStorage when present', async () => {
    store['accessToken'] = 'tok-abc';
    fetchMock.mockResolvedValueOnce(
      mockResponse({ statusCode: 200, data: { ok: 1 } }),
    );
    await apiFetch('/me', { body: { hello: 1 } });
    const { init } = lastFetch();
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get('Authorization')).toBe('Bearer tok-abc');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('does not attach Authorization when no token is stored', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ statusCode: 200, data: { ok: 1 } }),
    );
    await apiFetch('/public');
    const { init } = lastFetch();
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('throws an Error carrying the API message on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(
        { statusCode: 403, message: 'Forbidden' },
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
    );
    await expect(apiFetch('/admin/stats')).rejects.toThrow(/Forbidden/);
  });

  it('retries the request once after a successful refresh on 401', async () => {
    // First call → 401 with TOKEN_EXPIRED, then we hit /auth/refresh,
    // then we replay the original request with the new token.
    store['accessToken'] = 'old-tok';
    store['refreshToken'] = 'refresh-tok';
    fetchMock
      .mockResolvedValueOnce(
        mockResponse(
          { code: 'TOKEN_EXPIRED', message: 'expired' },
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        mockResponse(
          {
            statusCode: 200,
            data: { accessToken: 'new-tok', refreshToken: 'new-refresh' },
          },
        ),
      )
      .mockResolvedValueOnce(
        mockResponse({ statusCode: 200, data: { hello: 'world' } }),
      );
    const out = await apiFetch<{ hello: string }>('/me');
    expect(out).toEqual({ hello: 'world' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const last = lastFetch();
    const lastHeaders = new Headers(last.init.headers as HeadersInit);
    expect(lastHeaders.get('Authorization')).toBe('Bearer new-tok');
    expect(store['accessToken']).toBe('new-tok');
  });
});