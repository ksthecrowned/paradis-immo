/** Emitted by the API guard on every route but the account-recovery one. */
export const ACCOUNT_DELETED_CODE = 'ACCOUNT_DELETED';

/** True for a Nest error body carrying `code: ACCOUNT_DELETED`. */
export function isAccountDeletedBody(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { code?: unknown }).code === ACCOUNT_DELETED_CODE
  );
}

/**
 * HTTP error raised by `apiFetch`. Kept dependency-free so pure helpers and
 * their tests can rely on it without loading the auth/native stack.
 */
export class ApiError extends Error {
  readonly status: number;
  /** Parsed error body — Nest sends `{ code, message, details }`. */
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** 403 `ACCOUNT_DELETED` — a DELETED account reached a non-recovery route. */
export function isAccountDeletedError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 403 &&
    isAccountDeletedBody(err.body)
  );
}
