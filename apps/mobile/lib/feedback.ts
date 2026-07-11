import { ApiError } from '@/lib/api';

/** Human-readable message from API / network errors. */
export function getErrorMessage(
  err: unknown,
  fallback = 'Une erreur est survenue',
): string {
  if (err instanceof ApiError) {
    return err.message || fallback;
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return fallback;
}
