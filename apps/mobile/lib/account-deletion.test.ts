import { describe, expect, mock, test } from 'bun:test';
import { ApiError } from './api-error';

// `api` pulls the auth module, which loads native-only modules under Bun.
mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));
mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => undefined,
    multiRemove: async () => undefined,
  },
}));
mock.module('./config', () => ({
  getApiUrl: () => 'http://test.local',
}));

const {
  getApiErrorBlockers,
  getApiErrorCode,
  isAccountDeletedError,
  mapAccountDeletionCancelError,
  mapAccountDeletionRequestError,
} = await import('./account-deletion');

function apiError(status: number, body: unknown): ApiError {
  return new ApiError('api error', status, body);
}

describe('mapAccountDeletionRequestError', () => {
  test('409 obligations → French copy plus the API blockers', () => {
    const mapped = mapAccountDeletionRequestError(
      apiError(409, {
        code: 'ACCOUNT_HAS_ACTIVE_OBLIGATIONS',
        message: 'Impossible de supprimer ce compte tant que ces éléments existent.',
        details: {
          blockers: ['Un bail est toujours actif.', 'Un solde de loyer reste dû.'],
        },
      }),
    );

    expect(mapped.code).toBe('ACCOUNT_HAS_ACTIVE_OBLIGATIONS');
    expect(mapped.blockers).toEqual([
      'Un bail est toujours actif.',
      'Un solde de loyer reste dû.',
    ]);
    expect(mapped.message).toContain('obligations');
  });

  test('409 without blockers still returns a usable message', () => {
    const mapped = mapAccountDeletionRequestError(
      apiError(409, { code: 'ACCOUNT_HAS_ACTIVE_OBLIGATIONS' }),
    );

    expect(mapped.code).toBe('ACCOUNT_HAS_ACTIVE_OBLIGATIONS');
    expect(mapped.blockers).toEqual([]);
    expect(mapped.message.length).toBeGreaterThan(0);
  });

  test('deleted account is reported distinctly', () => {
    const mapped = mapAccountDeletionRequestError(
      apiError(403, { code: 'ACCOUNT_DELETED' }),
    );

    expect(mapped.code).toBe('ACCOUNT_DELETED');
    expect(mapped.message).toContain('déjà supprimé');
  });

  test('network failure (status 0) asks to check the connection', () => {
    const mapped = mapAccountDeletionRequestError(
      new ApiError('Impossible de joindre le serveur.', 0),
    );

    expect(mapped.code).toBe('NETWORK');
    expect(mapped.message).toContain('réseau');
  });

  test('unknown failures never leak the raw API message', () => {
    const mapped = mapAccountDeletionRequestError(
      apiError(500, { code: 'HTTP_500', message: 'Internal server error' }),
    );

    expect(mapped.code).toBe('UNKNOWN');
    expect(mapped.message).not.toContain('Internal');
  });
});

describe('mapAccountDeletionCancelError', () => {
  test('closed recovery window is terminal and explicit', () => {
    const mapped = mapAccountDeletionCancelError(
      apiError(403, { code: 'ACCOUNT_DELETION_WINDOW_CLOSED' }),
    );

    expect(mapped.code).toBe('ACCOUNT_DELETION_WINDOW_CLOSED');
    expect(mapped.message).toContain('30 jours');
  });

  test('already anonymised account cannot be restored', () => {
    const mapped = mapAccountDeletionCancelError(
      apiError(403, { code: 'ACCOUNT_ANONYMIZED' }),
    );

    expect(mapped.code).toBe('ACCOUNT_ANONYMIZED');
    expect(mapped.message).toContain('anonymisées');
  });

  test('network failure asks to check the connection', () => {
    const mapped = mapAccountDeletionCancelError(
      new ApiError('Impossible de joindre le serveur.', 0),
    );

    expect(mapped.code).toBe('NETWORK');
    expect(mapped.message).toContain('réseau');
  });

  test('unknown failures keep a support-oriented message', () => {
    const mapped = mapAccountDeletionCancelError(
      apiError(500, { code: 'HTTP_500', message: 'Internal server error' }),
    );

    expect(mapped.code).toBe('UNKNOWN');
    expect(mapped.message).not.toContain('Internal');
  });
});

describe('isAccountDeletedError', () => {
  test('matches only 403 bodies carrying ACCOUNT_DELETED', () => {
    expect(isAccountDeletedError(apiError(403, { code: 'ACCOUNT_DELETED' }))).toBe(
      true,
    );
    expect(
      isAccountDeletedError(apiError(403, { code: 'ACCOUNT_ANONYMIZED' })),
    ).toBe(false);
    expect(isAccountDeletedError(apiError(401, { code: 'ACCOUNT_DELETED' }))).toBe(
      false,
    );
    expect(isAccountDeletedError(new Error('boom'))).toBe(false);
  });
});

describe('getApiErrorCode / getApiErrorBlockers', () => {
  test('reads a nested details.code', () => {
    expect(
      getApiErrorCode(apiError(403, { details: { code: 'NESTED_CODE' } })),
    ).toBe('NESTED_CODE');
  });

  test('ignores malformed bodies and non-ApiError values', () => {
    expect(getApiErrorCode(new Error('boom'))).toBeNull();
    expect(getApiErrorBlockers(apiError(409, { details: { blockers: 'x' } }))).toEqual(
      [],
    );
  });
});
