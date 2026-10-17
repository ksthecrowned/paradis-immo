import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('./config', () => ({
  getApiUrl: () => 'http://test.local',
}));
mock.module('./auth', () => ({
  getAccessToken: async () => 'access-token',
  refreshSession: async () => null,
}));

const { ApiError } = await import('./api-error');
const { apiFetch } = await import('./api');
const { onAccountDeleted } = await import('./account-deleted-signal');

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function respondWith(status: number, body: unknown): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('apiFetch and the DELETED account guard', () => {
  test('403 ACCOUNT_DELETED notifies the recovery gate and keeps the body', async () => {
    respondWith(403, {
      code: 'ACCOUNT_DELETED',
      message: 'Ce compte a été supprimé.',
    });
    let notified = 0;
    const off = onAccountDeleted(() => {
      notified += 1;
    });

    const failure = (await apiFetch('/users/me').catch((err) => err)) as Error & {
      status: number;
      body: unknown;
    };

    expect(notified).toBe(1);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.status).toBe(403);
    expect(failure.body).toEqual({
      code: 'ACCOUNT_DELETED',
      message: 'Ce compte a été supprimé.',
    });
    off();
  });

  test('another 403 code does not trigger the recovery gate', async () => {
    respondWith(403, {
      code: 'ACCOUNT_ANONYMIZED',
      message: 'Données anonymisées.',
    });
    let notified = 0;
    const off = onAccountDeleted(() => {
      notified += 1;
    });

    await apiFetch('/users/me/deletion', { method: 'DELETE' }).catch(
      () => undefined,
    );

    expect(notified).toBe(0);
    off();
  });

  test('a successful call leaves the signal silent', async () => {
    respondWith(200, { id: 'u1' });
    let notified = 0;
    const off = onAccountDeleted(() => {
      notified += 1;
    });

    await apiFetch('/users/me');

    expect(notified).toBe(0);
    off();
  });
});
