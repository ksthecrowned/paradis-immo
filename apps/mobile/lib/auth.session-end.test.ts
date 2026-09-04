import { beforeEach, describe, expect, mock, test } from 'bun:test';

const store = new Map<string, string>();

mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    multiSet: async (pairs: [string, string][]) => {
      for (const [key, value] of pairs) store.set(key, value);
    },
    multiRemove: async (keys: string[]) => {
      for (const key of keys) store.delete(key);
    },
  },
}));

mock.module('./config', () => ({
  getApiUrl: () => 'http://test.local',
}));

const { clearSession, logout, onSessionEnd, saveTokens } = await import('./auth');

describe('onSessionEnd', () => {
  beforeEach(() => {
    store.clear();
  });

  test('clearSession emits expired by default', async () => {
    const reasons: string[] = [];
    const unsub = onSessionEnd((reason) => reasons.push(reason));

    await saveTokens({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: 'u1', phone: '+241', name: null, roles: ['SEEKER'] },
    });
    await clearSession();

    expect(reasons).toEqual(['expired']);
    unsub();
  });

  test('logout emits logout (no login redirect)', async () => {
    const reasons: string[] = [];
    const unsub = onSessionEnd((reason) => reasons.push(reason));

    await logout();

    expect(reasons).toEqual(['logout']);
    unsub();
  });

  test('unsubscribe stops further emissions', async () => {
    const reasons: string[] = [];
    const unsub = onSessionEnd((reason) => reasons.push(reason));
    unsub();

    await clearSession('expired');

    expect(reasons).toEqual([]);
  });
});
