import { apiFetch } from '@/lib/api';
import { ApiError } from '@/lib/api-error';

export { ACCOUNT_DELETED_CODE, isAccountDeletedError } from '@/lib/api-error';

/**
 * Spec 01 — account deletion from the app (also required by the stores).
 *
 * The request is never optimistic: the caller only reports success once the
 * API answered. The account is disabled immediately, sessions are revoked,
 * and the data is anonymised 30 days later unless the user signs back in.
 */
export type AccountDeletionRequestErrorCode =
  | 'ACCOUNT_HAS_ACTIVE_OBLIGATIONS'
  | 'ACCOUNT_DELETED'
  | 'NETWORK'
  | 'UNKNOWN';

export type AccountDeletionRequestError = {
  code: AccountDeletionRequestErrorCode;
  message: string;
  /** Human reasons returned by the API when obligations block the request. */
  blockers: string[];
};

const OBLIGATIONS_MESSAGE =
  'Impossible de supprimer ce compte tant que des obligations sont en cours (bail, séjour, vente ou loyers dus).';

/** DELETE `/users/me/deletion` — the only codes the API can answer (spec 01). */
export type AccountDeletionCancelErrorCode =
  | 'ACCOUNT_DELETION_WINDOW_CLOSED'
  | 'ACCOUNT_ANONYMIZED'
  | 'NETWORK'
  | 'UNKNOWN';

export type AccountDeletionCancelError = {
  code: AccountDeletionCancelErrorCode;
  message: string;
};

/** Read the `code` from a Nest error body (`body.code` or `body.details.code`). */
export function getApiErrorCode(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== 'object') {
    return null;
  }
  const body = err.body as Record<string, unknown>;
  if (typeof body.code === 'string') return body.code;
  const details = body.details;
  if (
    details &&
    typeof details === 'object' &&
    typeof (details as { code?: unknown }).code === 'string'
  ) {
    return (details as { code: string }).code;
  }
  return null;
}

/** Dig blockers out of `{ details: { blockers: string[] } }`. */
export function getApiErrorBlockers(err: unknown): string[] {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== 'object') {
    return [];
  }
  const details = (err.body as Record<string, unknown>).details;
  if (!details || typeof details !== 'object') return [];
  const blockers = (details as { blockers?: unknown }).blockers;
  if (!Array.isArray(blockers)) return [];
  return blockers.filter((b): b is string => typeof b === 'string');
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

/**
 * Cancel a pending deletion during the 30-day recovery window. Only the
 * recovery route accepts a DELETED account, so this call works while every
 * other one answers 403 `ACCOUNT_DELETED`.
 */
export async function cancelAccountDeletion(): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/users/me/deletion', {
    method: 'DELETE',
  });
}

/** French UX copy for DELETE cancellation failures. */
export function mapAccountDeletionCancelError(
  err: unknown,
): AccountDeletionCancelError {
  const code = getApiErrorCode(err);
  if (code === 'ACCOUNT_DELETION_WINDOW_CLOSED') {
    return {
      code,
      message:
        'Le délai de récupération de 30 jours est dépassé : la suppression ne peut plus être annulée.',
    };
  }
  if (code === 'ACCOUNT_ANONYMIZED') {
    return {
      code,
      message:
        'Les données de ce compte ont été anonymisées : l’annulation n’est plus possible.',
    };
  }
  if (err instanceof ApiError && err.status === 0) {
    return {
      code: 'NETWORK',
      message:
        'Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.',
    };
  }
  return {
    code: 'UNKNOWN',
    message:
      'Impossible d’annuler la suppression pour le moment. Réessayez ou contactez le support.',
  };
}

/** French UX copy for POST deletion failures — never shown raw to the user. */
export function mapAccountDeletionRequestError(
  err: unknown,
): AccountDeletionRequestError {
  const code = getApiErrorCode(err);
  if (code === 'ACCOUNT_HAS_ACTIVE_OBLIGATIONS') {
    return {
      code,
      message: OBLIGATIONS_MESSAGE,
      blockers: getApiErrorBlockers(err),
    };
  }
  if (code === 'ACCOUNT_DELETED') {
    return {
      code,
      message: 'Ce compte est déjà supprimé. Reconnectez-vous pour annuler.',
      blockers: [],
    };
  }
  if (err instanceof ApiError && err.status === 0) {
    return {
      code: 'NETWORK',
      message:
        'Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.',
      blockers: [],
    };
  }
  return {
    code: 'UNKNOWN',
    message:
      'Impossible de demander la suppression du compte. Réessayez plus tard.',
    blockers: [],
  };
}
