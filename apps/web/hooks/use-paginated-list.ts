'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaginatedListQuery, PaginatedResult } from '@/lib/http/types';

type FetchParams<Q> = Q & Required<Pick<PaginatedListQuery, 'page' | 'limit'>>;

type UsePaginatedListOptions<T, Q extends PaginatedListQuery> = {
  fetchFn: (params: FetchParams<Q>) => Promise<PaginatedResult<T>>;
  initialPageSize?: number;
  query?: Q;
  enabled?: boolean;
  onError?: (error: unknown) => void;
};

export function usePaginatedList<
  T,
  Q extends PaginatedListQuery = PaginatedListQuery,
>({
  fetchFn,
  initialPageSize = 20,
  query,
  enabled = true,
  onError,
}: UsePaginatedListOptions<T, Q>) {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [loading, setLoading] = useState(enabled);
  const [refreshKey, setRefreshKey] = useState(0);
  const fetchFnRef = useRef(fetchFn);
  const onErrorRef = useRef(onError);

  fetchFnRef.current = fetchFn;
  onErrorRef.current = onError;

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
  }, []);

  const queryKey = JSON.stringify(query ?? {});

  useEffect(() => {
    setPage(1);
  }, [queryKey]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const result = await fetchFnRef.current({
          ...(query ?? ({} as Q)),
          page,
          limit: pageSize,
        });

        if (!mounted) return;

        setData(result.data);
        setTotal(result.meta.total);
        setTotalPages(Math.max(1, result.meta.totalPages || 1));

        if (result.meta.totalPages > 0 && page > result.meta.totalPages) {
          setPage(result.meta.totalPages);
        }
      } catch (error) {
        if (mounted) {
          onErrorRef.current?.(error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [enabled, page, pageSize, query, refreshKey]);

  return {
    data,
    total,
    totalPages,
    page,
    pageSize,
    loading,
    setPage,
    setPageSize: handlePageSizeChange,
    refresh,
    setData,
  };
}
