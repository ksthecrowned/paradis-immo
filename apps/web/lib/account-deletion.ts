import { ApiError, apiFetch } from '@/lib/api';
import {
  ACCOUNT_CANCEL_DELETION_PATH,
  ACCOUNT_DELETED_CODE,
  getApiErrorBlockers,
  getApiErrorCode,
  isAccountDeletedBody,
} from '@/lib/api-error-code';

export {
  ACCOUNT_CANCEL_DELETION_PATH,
  ACCOUNT_DELETED_CODE,
  isAccountDeletedBody,
};

/** POST `/users/me/deletion` — 409 when obligations remain. */
export type AccountDeletionRequestErrorCode = 'ACCOUNT_HAS_ACTIVE_OBLIGATIONS';

/**
 * DELETE `/users/me/deletion` — 403 when recovery is no longer possible.
 * Verified in `UsersService.cancelAccountDeletion`: only these two codes.
 */
export type AccountDeletionCancelErrorCode =
  | 'ACCOUNT_DELETION_WINDOW_CLOSED'
  | 'ACCOUNT_ANONYMIZED';

export type AccountDeletionErrorCode =
  | typeof ACCOUNT_DELETED_CODE
  | AccountDeletionRequestErrorCode
  | AccountDeletionCancelErrorCode;

const REQUEST_MESSAGES: Record<AccountDeletionRequestErrorCode, string> = {
  ACCOUNT_HAS_ACTIVE_OBLIGATIONS:
    'Impossible de supprimer ce compte tant que des obligations sont en cours (bail, séjour, vente ou loyers dus).',
};

const CANCEL_MESSAGES: Record<AccountDeletionCancelErrorCode, string> = {
  ACCOUNT_DELETION_WINDOW_CLOSED:
    'Le délai de récupération de 30 jours est dépassé : la suppression ne peut plus être annulée.',
  ACCOUNT_ANONYMIZED:
    'Les données de ce compte ont été anonymisées : l’annulation n’est plus possible.',
};

export function isAccountDeletedError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 403 &&
    getApiErrorCode(err) === ACCOUNT_DELETED_CODE
  );
}

export async function requestAccountDeletion(): Promise<{
  message: string;
  deletedAt: string;
}> {
  return apiFetch<{ message: string; deletedAt: string }>(
    '/users/me/deletion',
    { method: 'POST' },
  );
}

export async function cancelAccountDeletion(): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/users/me/deletion', {
    method: 'DELETE',
  });
}

/** French UX copy for POST deletion failures (never rely on raw `err.message` alone). */
export function mapAccountDeletionRequestError(err: unknown): string {
  const code = getApiErrorCode(err);
  if (code === 'ACCOUNT_HAS_ACTIVE_OBLIGATIONS') {
    const blockers = getApiErrorBlockers(err);
    const base = REQUEST_MESSAGES.ACCOUNT_HAS_ACTIVE_OBLIGATIONS;
    if (blockers.length === 0) return base;
    return `${base} ${blockers.join(' ')}`;
  }
  return 'Impossible de demander la suppression du compte. Réessayez plus tard.';
}

/** French UX copy for DELETE cancellation failures. */
export function mapAccountDeletionCancelError(err: unknown): {
  code: AccountDeletionCancelErrorCode | 'UNKNOWN';
  message: string;
} {
  const code = getApiErrorCode(err);
  if (code === 'ACCOUNT_DELETION_WINDOW_CLOSED') {
    return {
      code,
      message: CANCEL_MESSAGES.ACCOUNT_DELETION_WINDOW_CLOSED,
    };
  }
  if (code === 'ACCOUNT_ANONYMIZED') {
    return { code, message: CANCEL_MESSAGES.ACCOUNT_ANONYMIZED };
  }
  return {
    code: 'UNKNOWN',
    message:
      'Impossible d’annuler la suppression pour le moment. Réessayez ou contactez le support.',
  };
}
