/**
 * Global bridge between `apiFetch` and the recovery UI.
 *
 * A DELETED account can still sign in (spec 01 recovery window) but the API
 * guard answers 403 `ACCOUNT_DELETED` on every route except the cancellation
 * one. `apiFetch` emits here instead of navigating itself, so the router (and
 * the current route, to avoid a redirect loop) stays the UI's responsibility.
 */
type AccountDeletedListener = () => void;

const listeners = new Set<AccountDeletedListener>();

/** Subscribe to 403 `ACCOUNT_DELETED`. Returns an unsubscribe function. */
export function onAccountDeleted(listener: AccountDeletedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitAccountDeleted(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A listener error must never break the failing request.
    }
  }
}
