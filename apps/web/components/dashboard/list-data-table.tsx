'use client';

import { DashIcon } from '@/components/dash-icon';
import {
  Children,
  Fragment,
  isValidElement,
  memo,
  useCallback,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import {
  TableActionMenu,
  type TableActionMenuItem,
} from './table-action-menu';

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

export interface SummaryTableColumn<T> {
  key: keyof T | string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

export function adaptSummaryColumns<T extends object>(
  columns: SummaryTableColumn<T>[],
): ListColumn<T>[] {
  return columns.map(({ header, render, ...column }) => ({
    ...column,
    label: header,
    render: (_value, row) => render(row),
  }));
}

export interface ListDataTableProps<T extends object> {
  data: T[];
  columns: ListColumn<T>[];
  title?: string;
  subtitle?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  compact?: boolean;
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
  /** Click handler on a row. When provided, rows get `cursor-pointer` + hover. */
  onRowClick?: (row: T) => void;
  /** Optional direct link to the row's detail view, rendered as an eye action. */
  viewHref?: (row: T) => string;
  viewLabel?: string;
  /** Highlights the row whose id matches. */
  selectedRowId?: string;
  /** Field used to read each row's id (for `selectedRowId` match). */
  rowIdKey?: keyof T;
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  search?: string;
  onSearchChange?: (search: string) => void;
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

interface NativeActionProps {
  children?: React.ReactNode;
  href?: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  title?: string;
  'aria-label'?: string;
}

interface NativeTableAction {
  label: string;
  href?: string;
  onSelect?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

function actionLabel(node: React.ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child);
      }
      if (isValidElement<{ children?: React.ReactNode }>(child)) {
        return actionLabel(child.props.children);
      }
      return '';
    })
    .join(' ')
    .replace(/[→←]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function actionIcon(label: string): string {
  const normalized = label.toLocaleLowerCase('fr');
  if (/voir|détail|consulter/.test(normalized)) return 'solar:eye-linear';
  if (/suspendre|suspension|bloquer/.test(normalized)) return 'solar:lock-keyhole-linear';
  if (/réactiver|reactiver|débloquer|debloquer/.test(normalized)) return 'solar:check-circle-linear';
  if (/modifier|éditer/.test(normalized)) return 'solar:pen-linear';
  if (/supprimer|retirer/.test(normalized)) return 'solar:trash-bin-trash-linear';
  if (/archiver/.test(normalized)) return 'solar:archive-linear';
  if (/refuser|rejeter|annuler/.test(normalized)) return 'solar:close-circle-linear';
  if (/valider|activer|approuver|confirmer|traité|traite/.test(normalized))
    return 'solar:check-circle-linear';
  if (/pause|suspendre/.test(normalized)) return 'solar:pause-circle-linear';
  if (/paiement|payer|rembourser/.test(normalized)) return 'solar:wallet-money-linear';
  if (/télécharger|exporter/.test(normalized)) return 'solar:download-linear';
  if (/visite|rendez-vous/.test(normalized)) return 'solar:calendar-linear';
  if (/ouvrir|dossier/.test(normalized)) return 'solar:folder-open-linear';
  return 'solar:bolt-linear';
}

function collectTableActions(
  node: React.ReactNode,
  actions: NativeTableAction[],
  passthrough: React.ReactNode[],
): void {
  Children.forEach(node, (child) => {
    if (!isValidElement<NativeActionProps>(child)) {
      if (child !== null && child !== undefined && child !== false) {
        passthrough.push(child);
      }
      return;
    }

    if (child.type === Fragment || child.type === 'div') {
      collectTableActions(child.props.children, actions, passthrough);
      return;
    }

    if (child.type !== 'button' && child.type !== Link) {
      passthrough.push(child);
      return;
    }

    const props = child.props;
    const label =
      props['aria-label']?.trim() || props.title?.trim() || actionLabel(props.children);
    if (!label) {
      passthrough.push(child);
      return;
    }
    actions.push({
      label,
      ...(typeof props.href === 'string' ? { href: props.href } : {}),
      ...(props.onClick
        ? {
            onSelect: (event) => props.onClick?.(event),
          }
        : {}),
      ...(typeof props.disabled === 'boolean'
        ? { disabled: props.disabled }
        : {}),
    });
  });
}

function renderTableActions(
  node: React.ReactNode,
  directViewHref?: string,
  viewLabel = 'Voir les détails',
): React.ReactNode {
  const actions: NativeTableAction[] = [];
  const passthrough: React.ReactNode[] = [];
  collectTableActions(node, actions, passthrough);

  const viewAction = actions.find(
    (action) =>
      action.href &&
      /^(voir|détails?|consulter)$/i.test(action.label.trim()),
  );
  const menuItems: TableActionMenuItem[] = actions
    .filter((action) => action !== viewAction)
    .map((action) => ({
      label: action.label,
      icon: actionIcon(action.label),
      ...(action.href ? { href: action.href } : {}),
      ...(action.onSelect ? { onSelect: action.onSelect } : {}),
      ...(action.disabled ? { disabled: true } : {}),
      ...(/supprimer|retirer|archiver|refuser|rejeter|annuler|suspendre|bloquer/i.test(
        action.label,
      )
        ? { destructive: true }
        : {}),
    }));

  return (
    <>
      {directViewHref || viewAction || menuItems.length > 0 ? (
        <TableActionMenu
          {...(directViewHref
            ? { viewHref: directViewHref, viewLabel }
            : viewAction?.href
              ? { viewHref: viewAction.href, viewLabel: viewAction.label }
              : {})}
          items={menuItems}
        />
      ) : null}
      {passthrough}
    </>
  );
}

function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.trim();
  return String(value);
}

function truncateCellValue(value: unknown, maxLength = MAX_CELL_TEXT_LENGTH): string {
  const text = normalizeCellValue(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

const SKELETON_BAR_WIDTHS = ['w-4/5', 'w-3/5', 'w-2/3', 'w-1/2', 'w-3/4'] as const;

function TableSkeletonRows({
  columnCount,
  hasActions,
  rowCount,
}: {
  columnCount: number;
  hasActions: boolean;
  rowCount: number;
}): React.JSX.Element {
  return (
    <>
      {Array.from({ length: rowCount }, (_, rowIndex) => (
        <tr key={`skeleton-${rowIndex}`} aria-hidden>
          {Array.from({ length: columnCount }, (_, colIndex) => (
            <td key={`skeleton-${rowIndex}-${colIndex}`} className="p-3">
              <div
                className={`h-4 max-w-full animate-pulse rounded bg-muted/30 ${SKELETON_BAR_WIDTHS[(rowIndex + colIndex) % SKELETON_BAR_WIDTHS.length]}`}
              />
            </td>
          ))}
          {hasActions ? (
            <td className="p-3 text-end">
              <div className="ms-auto h-4 w-8 animate-pulse rounded bg-muted/30" />
            </td>
          ) : null}
        </tr>
      ))}
    </>
  );
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
        className={`max-w-65 overflow-hidden p-3 text-sm font-normal text-active [&_a]:no-underline ${col.className ?? ''}`}
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
      className={`max-w-65 overflow-hidden p-3 text-sm font-normal text-active [&_a]:no-underline ${col.className ?? ''}`}
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
  viewHref?: (row: T) => string;
  viewLabel?: string;
  onRowClick?: (row: T) => void;
  isSelected?: boolean;
  rowIdKey?: keyof T;
}

const TableRow = memo(function TableRow<T extends object>({
  row,
  columns,
  rowIndex,
  actions,
  viewHref,
  viewLabel,
  onRowClick,
  isSelected,
  rowIdKey: rowIdKeyProp,
}: TableRowProps<T>) {
  const clickable = typeof onRowClick === 'function';
  const rowClasses = [
    'transition-colors',
    clickable ? 'cursor-pointer' : '',
    isSelected ? 'bg-accent/5' : 'hover:bg-card-hover/40',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <tr
      className={rowClasses}
      onClick={clickable ? () => onRowClick!(row) : undefined}
      aria-current={isSelected ? 'true' : undefined}
      data-row-id={String((row as Record<string, unknown>)[String(rowIdKeyProp ?? 'id')] ?? '')}
    >
      {columns.map((col, colIndex) => (
        <TableCell
          key={`cell-${rowIndex}-${colIndex}`}
          col={col}
          row={row}
          colIndex={colIndex}
          rowIndex={rowIndex}
        />
      ))}
      {actions || viewHref ? (
        <td className="whitespace-nowrap p-3 text-end text-sm font-normal">
          {/* Stop propagation so row-level click does not fire when acting on a row action. */}
          <div
            className="inline-flex gap-x-2"
            onClick={(event) => event.stopPropagation()}
          >
            {renderTableActions(
              actions?.(row),
              viewHref?.(row),
              viewLabel,
            )}
          </div>
        </td>
      ) : null}
    </tr>
  );
}) as <T extends object>(props: TableRowProps<T>) => React.JSX.Element;

export function ListDataTable<T extends object>({
  data,
  columns,
  title,
  subtitle,
  viewAllHref,
  viewAllLabel = 'Voir tout',
  compact = false,
  searchPlaceholder = 'Recherche…',
  pageSize: pageSizeProp = 20,
  emptyMessage = 'Aucune donnée disponible.',
  actions,
  viewHref,
  viewLabel = 'Voir les détails',
  entityLabel = 'entrées',
  tableId = 'table',
  serverSide = false,
  enableClientFilters = false,
  totalCount,
  totalPages: totalPagesProp,
  page: controlledPage,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  loading = false,
  onRowClick,
  selectedRowId,
  rowIdKey = 'id' as keyof T,
  sortKey,
  sortDir,
  onSort,
  search,
  onSearchChange,
}: ListDataTableProps<T>): React.JSX.Element {
  const hasActions = Boolean(actions || viewHref);
  const [internalSearch, setInternalSearch] = useState('');
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDir, setInternalSortDir] = useState<'asc' | 'desc'>('asc');
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(pageSizeProp);
  const [showExport, setShowExport] = useState(false);

  const page = controlledPage ?? internalPage;
  const controlledSortKey = sortKey ?? internalSortKey;
  const controlledSortDir = sortDir ?? internalSortDir;
  const pageSize = serverSide ? pageSizeProp : internalPageSize;
  const searchValue = search ?? internalSearch;

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
    if (!enableClientFilters && !searchValue) {
      return data;
    }

    let rows = data;
    if (searchValue) {
      const q = searchValue.toLowerCase();
      rows = rows.filter((row) => rowMatchesSearch(row, columns, q));
    }
    if (enableClientFilters) {
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
    }
    return rows;
  }, [columns, data, enableClientFilters, searchValue, colFilters]);

  const sorted = useMemo(() => {
    if (!controlledSortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String(getRowFieldValue(a, controlledSortKey) ?? '').trim();
      const bv = String(getRowFieldValue(b, controlledSortKey) ?? '').trim();
      const an = parseFloat(av);
      const bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn)) {
        return controlledSortDir === 'asc' ? an - bn : bn - an;
      }
      return controlledSortDir === 'asc'
        ? av.localeCompare(bv, 'fr')
        : bv.localeCompare(av, 'fr');
    });
  }, [filtered, controlledSortKey, controlledSortDir]);

  const searchingLoadedPage = serverSide && Boolean(searchValue);
  const rowCount =
    serverSide && !searchingLoadedPage ? (totalCount ?? 0) : sorted.length;
  const totalPages = searchingLoadedPage
    ? 1
    : serverSide && totalPagesProp != null
      ? Math.max(1, totalPagesProp)
      : Math.max(1, Math.ceil(rowCount / pageSize) || 1);
  const paginated = serverSide
    ? sorted
    : sorted.slice((page - 1) * pageSize, page * pageSize);
  const from = rowCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, rowCount);

  const handleSort = (key: string) => {
    if (controlledSortKey === key) {
      setInternalSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setInternalSortKey(key);
      setInternalSortDir('asc');
    }
    setPage(1);
    onSort?.(key);
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
    'inline-flex items-center gap-x-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-muted shadow-sm transition-colors hover:bg-card-hover focus:outline-none';

  return (
    <div className="mx-auto flex w-full flex-col rounded-xl border border-border bg-table shadow-sm">
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-heading">{title}</h3>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
            ) : null}
          </div>
          {viewAllHref ? (
            <Link
              href={viewAllHref}
              className="whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:text-active"
            >
              {viewAllLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="px-3 py-4 md:py-5">
        {!compact && (
          <div className="mb-4 flex items-center space-x-2" data-testid="table-top">
            <div className="flex-1">
              <div className="relative max-w-xs">
                <label htmlFor={`${tableId}-search`} className="sr-only">
                  Recherche
                </label>
                <input
                  id={`${tableId}-search`}
                  type="search"
                  value={searchValue}
                  onChange={(e) => {
                    if (onSearchChange) {
                      onSearchChange(e.target.value);
                    } else {
                      setInternalSearch(e.target.value);
                    }
                    setPage(1);
                  }}
                  className="block w-full rounded-lg border border-input-border bg-search py-2 ps-9 pe-3 text-sm text-foreground shadow-sm placeholder:text-placeholder focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                  placeholder={searchPlaceholder}
                />
                <div className="pointer-events-none absolute inset-y-0 inset-s-0 flex items-center ps-3">
                  <DashIcon
                    icon="solar:magnifer-linear"
                    className="size-4 text-muted"
                  />
                </div>
              </div>
            </div>
            <div
              className={
                enableClientFilters
                  ? 'flex flex-1 items-center justify-end space-x-2'
                  : 'flex items-center justify-end space-x-2'
              }
            >
              <button
                type="button"
                className={toolbarBtn}
                aria-label="Actualiser"
                onClick={() => {
                  setInternalSearch('');
                  onSearchChange?.('');
                  setColFilters({});
                  setPage(1);
                  onRefresh?.();
                }}
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
                aria-label="Lignes par page"
                className="rounded-lg border border-border bg-card py-2 pe-8 ps-3 text-sm text-muted shadow-sm hover:bg-card-hover focus:border-accent focus:outline-none"
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
                  data-testid="export-btn"
                >
                  <DashIcon
                    icon="solar:export-linear"
                    className="size-4 shrink-0"
                  />
                  <DashIcon
                    icon="solar:alt-arrow-down-linear"
                    className="size-4"
                  />
                </button>
                {showExport ? (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowExport(false)}
                    />
                    <div className="absolute inset-e-0 top-full z-50 mt-2 w-36 rounded-lg border border-border bg-card shadow-xl">
                      <div className="space-y-0.5 p-1">
                        <button
                          type="button"
                          onClick={() => {
                            exportCSV();
                            setShowExport(false);
                          }}
                          className="flex w-full items-center gap-x-2 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-card-hover"
                        >
                          <DashIcon
                            icon="solar:file-text-linear"
                            className="size-4"
                          />
                          CSV
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden">
              <table id={tableId} className="min-w-full table-fixed">
                <thead className="border-b border-border bg-card">
                  <tr>

                    {columns.map((col, colIndex) => (
                      <th
                        key={`${col.id ?? String(col.key)}-${colIndex}`}
                        scope="col"
                        className="group py-1 text-start text-sm font-normal focus:outline-none"
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
                                className="inline-flex size-7.5 items-center justify-center rounded-lg border border-transparent text-muted hover:border-border focus:outline-none"
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
                                    className="absolute z-20 mt-2 rounded-lg border border-border bg-card p-2 shadow-md"
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
                                        aria-label={
                                          typeof col.label === 'string'
                                            ? col.label
                                            : 'Filtre de colonne'
                                        }
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
                                        aria-label={
                                          typeof col.label === 'string'
                                            ? col.label
                                            : 'Filtre de colonne'
                                        }
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
                            className={`inline-flex items-center rounded-md border border-transparent px-2.5 py-1 text-muted hover:border-border ${col.sortable ? 'cursor-pointer select-none' : ''}`}
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
                    {hasActions ? (
                      <th
                        scope="col"
                        className="px-3 py-2 text-end text-sm font-normal text-muted"
                      >
                        Actions
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody
                  className="divide-y divide-border"
                  aria-busy={loading || undefined}
                >
                  {loading ? (
                    <>
                      <tr className="sr-only">
                        <td colSpan={columns.length + (hasActions ? 1 : 0)}>
                          Chargement…
                        </td>
                      </tr>
                      <TableSkeletonRows
                        columnCount={columns.length}
                        hasActions={hasActions}
                        rowCount={pageSize}
                      />
                    </>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length + (hasActions ? 1 : 0)}
                        className="p-8 text-center text-sm text-muted"
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((row, i) => {
                      const rowId = String(
                        (row as Record<string, unknown>)[String(rowIdKey)] ?? '',
                      );
                      const isSelected =
                        !!onRowClick && !!selectedRowId && rowId === selectedRowId;
                      return (
                        <TableRow
                          key={i}
                          row={row}
                          columns={columns}
                          rowIndex={i}
                          actions={actions}
                          viewHref={viewHref}
                          viewLabel={viewLabel}
                          onRowClick={onRowClick}
                          isSelected={isSelected}
                          rowIdKey={rowIdKey}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {!compact && (
          <div className="mt-4 flex items-center">
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex min-w-10 items-center justify-center rounded-full p-2.5 text-sm text-active hover:bg-card-hover disabled:pointer-events-none disabled:opacity-50"
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
                    className={`inline-flex min-w-10 items-center justify-center rounded-full p-2.5 text-sm ${
                      item === page
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-active hover:bg-card-hover'
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
                className="inline-flex min-w-10 items-center justify-center rounded-full p-2.5 text-sm text-active hover:bg-card-hover disabled:pointer-events-none disabled:opacity-50"
              >
                »
              </button>
            </div>
            <div className="ms-auto text-sm text-muted">
              Page <span className="text-active">{page}</span>{' '}
              sur{' '}
              <span className="text-active">
                {totalPages}
              </span>
              {' · '}
              Affichage{' '}
              <span className="text-active">{from}</span>–
              <span className="text-active">{to}</span> sur{' '}
              <span className="text-active">{rowCount}</span>{' '}
              {entityLabel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
