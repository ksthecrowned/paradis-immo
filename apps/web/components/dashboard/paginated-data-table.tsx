'use client';

import { forwardRef, useImperativeHandle } from 'react';
import {
  ListDataTable,
  type ListColumn,
  type ListDataTableProps,
} from '@/components/dashboard/list-data-table';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import type { PaginatedListQuery, PaginatedResult } from '@/lib/http/types';

export type PaginatedDataTableHandle = {
  refresh: () => void;
};

type PaginatedDataTableProps<T, Q extends PaginatedListQuery> = {
  fetchFn: (
    params: Q & Required<Pick<PaginatedListQuery, 'page' | 'limit'>>,
  ) => Promise<PaginatedResult<T>>;
  query?: Q;
  initialPageSize?: number;
  columns: ListColumn<T>[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  actions?: (row: T) => React.ReactNode;
  entityLabel?: string;
  tableId?: string;
  enabled?: boolean;
  onError?: (error: unknown) => void;
  enableClientFilters?: boolean;
};

function PaginatedDataTableInner<T extends object, Q extends PaginatedListQuery>(
  {
    fetchFn,
    query,
    initialPageSize = 20,
    columns,
    searchPlaceholder,
    emptyMessage,
    actions,
    entityLabel,
    tableId,
    enabled = true,
    onError,
    enableClientFilters,
  }: PaginatedDataTableProps<T, Q>,
  ref: React.Ref<PaginatedDataTableHandle>,
) {
  const {
    data,
    total,
    totalPages,
    page,
    pageSize,
    setPage,
    setPageSize,
    loading,
    refresh,
  } = usePaginatedList<T, Q>({
    fetchFn,
    query,
    initialPageSize,
    enabled,
    onError,
  });

  useImperativeHandle(ref, () => ({ refresh }), [refresh]);

  const tableProps: ListDataTableProps<T> = {
    serverSide: true,
    data,
    columns,
    totalCount: total,
    totalPages,
    page,
    pageSize,
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
    onRefresh: refresh,
    loading,
    searchPlaceholder,
    emptyMessage,
    actions,
    entityLabel,
    tableId,
    enableClientFilters,
  };

  return <ListDataTable {...tableProps} />;
}

export const PaginatedDataTable = forwardRef(PaginatedDataTableInner) as <
  T extends object,
  Q extends PaginatedListQuery = PaginatedListQuery,
>(
  props: PaginatedDataTableProps<T, Q> & {
    ref?: React.Ref<PaginatedDataTableHandle>;
  },
) => React.JSX.Element;

export type { ListColumn };
