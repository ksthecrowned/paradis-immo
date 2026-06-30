/**
 * @jest-environment node
 *
 * Tests for the web auth helpers. The auth module exposes a small
 * surface — requestOtp, verifyOtp, logout, getTokens — which we
 * drive against a mocked fetch and a stubbed localStorage so we
 * don't need jsdom.
 */
import { requestOtp, verifyOtp, logout, getTokens } from '@/lib/auth';

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
  init: { status?: number } = {},
): Response {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

function lastFetch(): FetchCall {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  return { url: String(call[0]), init: (call[1] ?? {}) as RequestInit };
}

describe('auth', () => {
  it('getTokens() returns nulls when nothing is stored', () => {
    expect(getTokens()).toEqual({ accessToken: null, refreshToken: null });
  });

  it('requestOtp POSTs the phone to /auth/otp/request', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ data: { ok: true } }));
    await requestOtp('+242069000000');
    const { url, init } = lastFetch();
    expect(url).toMatch(/\/auth\/otp\/request$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      phone: '+242069000000',
    });
  });

  it('verifyOtp persists the tokens on success', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        data: {
          accessToken: 'acc',
          refreshToken: 'ref',
          user: { id: 'u1', phone: '+242069000000' },
        },
      }),
    );
    const out = await verifyOtp('+242069000000', '1234');
    expect(out.user.id).toBe('u1');
    expect(store['accessToken']).toBe('acc');
    expect(store['refreshToken']).toBe('ref');
  });

  it('verifyOtp throws if the server rejects the code', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ message: 'Code invalide' }, { status: 400 }),
    );
    await expect(verifyOtp('+242069000000', '0000')).rejects.toThrow(
      /Code invalide/,
    );
  });

  it('logout clears both tokens', () => {
    store['accessToken'] = 'a';
    store['refreshToken'] = 'r';
    logout();
    expect(getTokens()).toEqual({ accessToken: null, refreshToken: null });
  });
});