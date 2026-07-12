/** Public store links — set in env when apps are published. */
export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() || '';
export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim() || '';

export function hasStoreLinks(): boolean {
  return Boolean(APP_STORE_URL || PLAY_STORE_URL);
}
