'use client';

import { useCallback, useEffect, useState } from 'react';

type UseResourceDetailResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setData: (data: T) => void;
};

/**
 * Generic resource detail loader.
 *
 * The `load` callback receives the `id` argument and must remain stable
 * across renders (wrap it in `useCallback(..., [id])` at the call site).
 * Keeping the loader stable prevents the reload effect from re-firing
 * on every parent render, which would otherwise cause infinite reloads
 * and trigger backend throttling.
 */
export function useResourceDetail<T>(
  id: string,
  load: (id: string) => Promise<T>,
): UseResourceDetailResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await load(id);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les données.',
      );
    } finally {
      setLoading(false);
    }
  }, [id, load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
