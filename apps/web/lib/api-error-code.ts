import { ApiError } from '@/lib/api';

/** Recovery screen path — keep in sync with `proxy.ts` and `apiFetch` redirect. */
export const ACCOUNT_CANCEL_DELETION_PATH = '/account/cancel-deletion';

export const ACCOUNT_DELETED_CODE = 'ACCOUNT_DELETED' as const;

/** True when a parsed API error body is 403 ACCOUNT_DELETED (no ApiError needed). */
export function isAccountDeletedBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  return (body as { code?: unknown }).code === ACCOUNT_DELETED_CODE;
}

/**
 * Nest `HttpExceptionFilter` returns `{ code, message, details }` where
 * `details` is the original exception body (often also containing `code`).
 */
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

/** Dig blockers out of ConflictException `{ details: { blockers } }` nesting. */
export function getApiErrorBlockers(err: unknown): string[] {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== 'object') {
    return [];
  }
  const body = err.body as Record<string, unknown>;
  const from = (value: unknown): string[] => {
    if (!value || typeof value !== 'object') return [];
    const blockers = (value as { blockers?: unknown }).blockers;
    if (!Array.isArray(blockers)) return [];
    return blockers.filter((b): b is string => typeof b === 'string');
  };
  const direct = from(body.details);
  if (direct.length > 0) return direct;
  const nested = body.details;
  if (nested && typeof nested === 'object') {
    return from((nested as { details?: unknown }).details);
  }
  return [];
}
