'use client';

import { DashIcon } from '@/components/dash-icon';
import { memo, useCallback, useMemo, useState } from 'react';

export interface ListColumn<T> {
  id?: string;
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select';
  filterOptions?: Array<{ value: string; label: string }>;
  filterPlaceholder?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  getFilterValue?: (row: T) => string;
  className?: string;
}

export interface ListDataTableProps<T> {
  data: T[];
  columns: ListColumn<T>[];
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: React.ReactNode;
  actions?: (row: T) => React.ReactNode;
  entityLabel?: string;
  tableId?: string;
  serverSide?: boolean;
  enableClientFilters?: boolean;
  totalCount?: number;
  totalPages?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

type PageItem = number | 'ellipsis';

function buildPageItems(current: number, total: number): PageItem[] {
  if (total <= 1) return [1];
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const items: PageItem[] = [1];

  if (current > 4) {
    items.push('ellipsis');
  }

  const rangeStart = current <= 4 ? 2 : Math.max(2, current - 1);
  const rangeEnd =
    current >= total - 3 ? total - 1 : current <= 4 ? 6 : current + 1;

  for (let pageNumber = rangeStart; pageNumber <= rangeEnd; pageNumber++) {
    items.push(pageNumber);
  }

  if (current < total - 3) {
    items.push('ellipsis');
  }

  items.push(total);
  return items;
}

function getRowFieldValue<T extends object>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

function getColumnFilterText<T extends object>(col: ListColumn<T>, row: T): string {
  if (col.getFilterValue) return col.getFilterValue(row);
  return String(getRowFieldValue(row, String(col.key)) ?? '');
}

function rowMatchesSearch<T extends object>(
  row: T,
  columns: ListColumn<T>[],
  query: string,
): boolean {
  const q = query.toLowerCase();
  const columnTexts = columns.map((col) =>
    getColumnFilterText(col, row).toLowerCase(),
  );
  if (columnTexts.some((text) => text.includes(q))) return true;
  return Object.values(row).some((value) =>
    String(value ?? '')
      .toLowerCase()
      .includes(q),
  );
}

const MAX_CELL_TEXT_LENGTH = 48;

function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.trim();
  return String(value);
}

function truncateCellValue(value: unknown, maxLength = MAX_CELL_TEXT_LENGTH): string {
  const text = normalizeCellValue(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

interface TableCellProps<T> {
  col: ListColumn<T>;
  row: T;
  colIndex: number;
  rowIndex: number;
}

const TableCell = memo(function TableCell<T extends object>({
  col,
  row,
  colIndex,
  rowIndex,
}: TableCellProps<T>) {
  const rawValue = row[col.key as keyof T];
  const rawText = normalizeCellValue(rawValue);
  const shouldTruncate =
    rawText.length > MAX_CELL_TEXT_LENGTH && rawText !== '—';

  if (col.render) {
    const rendered = col.render(rawValue, row);
    const renderedText =
      typeof rendered === 'string' || typeof rendered === 'number'
        ? normalizeCellValue(rendered)
        : null;

    return (
      <td
        key={`${col.id ?? String(col.key)}-${rowIndex}-${colIndex}`}
        className={`max-w-[260px] overflow-hidden p-3 text-sm text-foreground ${col.className ?? ''}`}
      >
        <span
          className="block truncate"
          title={
            renderedText && renderedText.length > MAX_CELL_TEXT_LENGTH
              ? renderedText
              : undefined
          }
        >
          {rendered}
        </span>
      </td>
    );
  }

  return (
    <td
      key={`${col.id ?? String(col.key)}-${rowIndex}-${colIndex}`}
      className={`max-w-[260px] overflow-hidden p-3 text-sm text-foreground ${col.className ?? ''}`}
    >
      <span className="block truncate" title={shouldTruncate ? rawText : undefined}>
        {truncateCellValue(rawValue)}
      </span>
    </td>
  );
}) as <T extends object>(props: TableCellProps<T>) => React.JSX.Element;

interface TableRowProps<T> {
  row: T;
  columns: ListColumn<T>[];
  rowIndex: number;
  actions?: (row: T) => React.ReactNode;
}

const TableRow = memo(function TableRow<T extends object>({
  row,
  columns,
  rowIndex,
  actions,
}: TableRowProps<T>) {
  return (
    <tr className="transition-colors hover:bg-card-hover/60">
      {columns.map((col, colIndex) => (
        <TableCell
          key={`cell-${rowIndex}-${colIndex}`}
          col={col}
          row={row}
          colIndex={colIndex}
          rowIndex={rowIndex}
        />
      ))}
      {actions ? (
        <td className="whitespace-nowrap p-3 text-end text-sm font-medium">
          <div className="inline-flex gap-x-2">{actions(row)}</div>
        </td>
      ) : null}
    </tr>
  );
}) as <T extends object>(props: TableRowProps<T>) => React.JSX.Element;

export function ListDataTable<T extends object>({
  data,
  columns,
  searchPlaceholder = 'Recherche…',
  pageSize: pageSizeProp = 20,
  emptyMessage = 'Aucune donnée disponible.',
  actions,
  entityLabel = 'entrées',
  tableId = 'table',
  serverSide = false,
  enableClientFilters = true,
  totalCount,
  totalPages: totalPagesProp,
  page: controlledPage,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  loading = false,
}: ListDataTableProps<T>): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(pageSizeProp);
  const [showExport, setShowExport] = useState(false);

  const page = controlledPage ?? internalPage;
  const pageSize = serverSide ? pageSizeProp : internalPageSize;

  const setPage = useCallback(
    (nextPage: number | ((current: number) => number)) => {
      const resolved =
        typeof nextPage === 'function' ? nextPage(page) : nextPage;
      if (onPageChange) {
        onPageChange(resolved);
      } else {
        setInternalPage(resolved);
      }
    },
    [onPageChange, page],
  );

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      if (serverSide) {
        onPageSizeChange?.(nextPageSize);
      } else {
        setInternalPageSize(nextPageSize);
        setInternalPage(1);
      }
    },
    [onPageSizeChange, serverSide],
  );

  const filtered = useMemo(() => {
    if (!enableClientFilters) return data;

    let rows = data;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((row) => rowMatchesSearch(row, columns, q));
    }
    Object.entries(colFilters).forEach(([key, value]) => {
      if (!value) return;
      const column = columns.find((col) => String(col.key) === key);
      rows = rows.filter((row) => {
        const text = column
          ? getColumnFilterText(column, row)
          : String(getRowFieldValue(row, key) ?? '');
        return text.toLowerCase().includes(value.toLowerCase());
      });
    });
    return rows;
  }, [columns, data, enableClientFilters, search, colFilters]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String(getRowFieldValue(a, sortKey) ?? '').trim();
      const bv = String(getRowFieldValue(b, sortKey) ?? '').trim();
      const an = parseFloat(av);
      const bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn)) {
        return sortDir === 'asc' ? an - bn : bn - an;
      }
      return sortDir === 'asc'
        ? av.localeCompare(bv, 'fr')
        : bv.localeCompare(av, 'fr');
    });
  }, [filtered, sortKey, sortDir]);

  const rowCount = serverSide ? (totalCount ?? 0) : sorted.length;
  const totalPages =
    serverSide && totalPagesProp != null
      ? Math.max(1, totalPagesProp)
      : Math.max(1, Math.ceil(rowCount / pageSize) || 1);
  const paginated = serverSide
    ? sorted
    : sorted.slice((page - 1) * pageSize, page * pageSize);
  const from = rowCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, rowCount);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const pageItems = buildPageItems(page, totalPages);

  const exportCSV = useCallback(() => {
    const headers = columns.map((c) => c.label).join(',');
    const rows = sorted
      .map((row) =>
        columns
          .map((c) => {
            const value = getRowFieldValue(row, String(c.key));
            return `"${String(value ?? '').replace(/"/g, '""')}"`;
          })
          .join(','),
      )
      .join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, columns]);

  const toolbarBtn =
    'inline-flex items-center gap-x-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors hover:bg-card-hover focus:outline-none';

  return (
    <div className="mx-auto flex w-full flex-col rounded-md border border-border border-t-4 border-t-accent bg-card shadow-sm">
      <div className="rounded-xl px-3 py-4 md:py-5">
        <div className="mb-4 flex items-center space-x-2">
          {enableClientFilters ? (
            <div className="flex-1">
              <div className="relative max-w-xs">
                <label className="sr-only">Recherche</label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="block w-full rounded-lg border border-input-border bg-search py-2 ps-9 pe-3 text-sm text-foreground shadow-sm placeholder:text-placeholder focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                  placeholder={searchPlaceholder}
                />
                <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
                  <DashIcon
                    icon="solar:magnifer-linear"
                    className="size-4 text-muted"
                  />
                </div>
              </div>
            </div>
          ) : null}
          <div
            className={
              enableClientFilters
                ? 'flex flex-1 items-center justify-end space-x-2'
                : 'flex items-center justify-end space-x-2'
            }
          >
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setColFilters({});
                setPage(1);
                onRefresh?.();
              }}
              className={toolbarBtn}
              aria-label="Actualiser"
            >
              <DashIcon icon="solar:refresh-linear" className="size-4" />
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                if (!serverSide) {
                  setPage(1);
                }
              }}
              className="rounded-lg border border-border bg-card py-2 pe-8 ps-3 text-sm text-foreground shadow-sm hover:bg-card-hover focus:border-accent focus:outline-none"
            >
              {[10, 15, 20, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExport((o) => !o)}
                className={toolbarBtn}
              >
                <DashIcon icon="solar:export-linear" className="size-4 shrink-0" />
                <DashIcon icon="solar:alt-arrow-down-linear" className="size-4" />
              </button>
              {showExport ? (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowExport(false)}
                  />
                  <div className="absolute end-0 top-full z-50 mt-2 w-36 rounded-md border border-border bg-card shadow-xl">
                    <div className="space-y-0.5 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          exportCSV();
                          setShowExport(false);
                        }}
                        className="flex w-full items-center gap-x-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-card-hover"
                      >
                        <DashIcon icon="solar:file-text-linear" className="size-4" />
                        CSV
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-h-[480px] overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <div className="min-h-[480px] overflow-hidden">
              <table id={tableId} className="min-w-full table-fixed">
                <thead className="border-b border-border">
                  <tr>
                    {columns.map((col, colIndex) => (
                      <th
                        key={`${col.id ?? String(col.key)}-${colIndex}`}
                        scope="col"
                        className="group py-1 text-start font-normal focus:outline-none"
                      >
                        {enableClientFilters && col.filterable ? (
                          <div className="flex items-center">
                            <span className="rounded-md px-2.5 py-1 text-sm text-muted">
                              {col.label}
                            </span>
                            <div className="relative ms-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenFilter(
                                    openFilter === String(col.key)
                                      ? null
                                      : String(col.key),
                                  )
                                }
                                className="inline-flex size-[30px] items-center justify-center rounded-lg border border-transparent text-muted hover:border-border focus:outline-none"
                              >
                                <DashIcon icon="solar:filter-linear" className="size-3.5" />
                              </button>
                              {openFilter === String(col.key) ? (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setOpenFilter(null)}
                                  />
                                  <div
                                    className="absolute z-20 mt-2 rounded-md border border-border bg-card p-2 shadow-md"
                                    style={{ minWidth: 160 }}
                                  >
                                    {col.filterType === 'select' ? (
                                      <select
                                        autoFocus
                                        value={colFilters[String(col.key)] ?? ''}
                                        onChange={(e) => {
                                          setColFilters((f) => ({
                                            ...f,
                                            [String(col.key)]: e.target.value,
                                          }));
                                          setPage(1);
                                        }}
                                        className="block w-full rounded-md border border-input-border bg-search px-2.5 py-1 text-[13px] text-foreground focus:border-accent focus:outline-none"
                                      >
                                        <option value="">Tous</option>
                                        {(col.filterOptions ?? []).map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        autoFocus
                                        value={colFilters[String(col.key)] ?? ''}
                                        onChange={(e) => {
                                          setColFilters((f) => ({
                                            ...f,
                                            [String(col.key)]: e.target.value,
                                          }));
                                          setPage(1);
                                        }}
                                        className="block w-full rounded-md border border-input-border bg-search px-2.5 py-1 text-[13px] text-foreground placeholder:text-placeholder focus:border-accent focus:outline-none"
                                        placeholder={
                                          col.filterPlaceholder ??
                                          col.label.toLowerCase()
                                        }
                                      />
                                    )}
                                  </div>
                                </>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`inline-flex items-center rounded-md border border-transparent px-2.5 py-1 text-sm text-muted hover:border-border ${col.sortable ? 'cursor-pointer select-none' : ''}`}
                            onClick={() =>
                              col.sortable && handleSort(String(col.key))
                            }
                          >
                            {col.label}
                            {col.sortable ? (
                              <DashIcon
                                icon="solar:sort-vertical-linear"
                                className="ms-1 -me-0.5 size-3.5 text-muted"
                              />
                            ) : null}
                          </div>
                        )}
                      </th>
                    ))}
                    {actions ? (
                      <th
                        scope="col"
                        className="px-3 py-2 text-end text-sm font-normal text-muted"
                      >
                        Actions
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={columns.length + (actions ? 1 : 0)}
                        className="p-8 text-center text-sm text-muted"
                      >
                        Chargement…
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length + (actions ? 1 : 0)}
                        className="p-8 text-center text-sm text-muted"
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((row, i) => (
                      <TableRow
                        key={i}
                        row={row}
                        columns={columns}
                        rowIndex={i}
                        actions={actions}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center">
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex min-w-[40px] items-center justify-center rounded-full p-2.5 text-sm text-foreground hover:bg-card-hover disabled:pointer-events-none disabled:opacity-50"
            >
              «
            </button>
            {pageItems.map((item, index) =>
              item === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1 text-sm text-muted"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={`inline-flex min-w-[40px] items-center justify-center rounded-full p-2.5 text-sm ${
                    item === page
                      ? 'bg-card-hover text-active'
                      : 'text-foreground hover:bg-card-hover'
                  }`}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex min-w-[40px] items-center justify-center rounded-full p-2.5 text-sm text-foreground hover:bg-card-hover disabled:pointer-events-none disabled:opacity-50"
            >
              »
            </button>
          </div>
          <div className="ms-auto text-xs text-muted">
            Page <span className="font-semibold text-foreground">{page}</span> sur{' '}
            <span className="font-semibold text-foreground">{totalPages}</span>
            {' · '}
            Affichage <span className="font-semibold text-foreground">{from}</span>–
            <span className="font-semibold text-foreground">{to}</span> sur{' '}
            <span className="font-semibold text-foreground">{rowCount}</span>{' '}
            {entityLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
