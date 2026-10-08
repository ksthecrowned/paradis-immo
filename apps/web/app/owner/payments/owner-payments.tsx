'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import type { PaginatedListQuery, PaginatedMeta } from '@/lib/http/types';
import { apiFetchPaginated } from '@/lib/api';
import { ApiError } from '@/lib/api';
import {
  listManagedPayments,
  type PublicPayment,
  type PublicPaymentAllocation,
} from '@/lib/owner/payments';
import { RecordCashFromPaymentsPanel } from '@/components/payments/record-cash-from-payments-panel';
import { OwnerPayoutsPanel } from '@/components/payments/owner-payouts-panel';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

type PaymentFilter = {
  status?: string;
  method?: string;
  propertyId?: string;
  from?: string;
  to?: string;
};

type RowsState = PublicPayment[];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function OwnerPaymentsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'payments' | 'payouts'>('payments');
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PaymentFilter>({
    status: undefined,
    method: undefined,
    propertyId: undefined,
    from: undefined,
    to: undefined,
  });
  const [data, setData] = useState<RowsState>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);

  // server-side pagination + filters (status, method, property, dates)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listManagedPayments({
        page,
        pageSize,
        status: filter.status,
        method: filter.method,
        propertyId: filter.propertyId,
        from: filter.from,
        to: filter.to,
      });
      setData(res.data);
      setMeta(res.meta);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les paiements.',
      );
    } finally {
      setLoading(false);
    }
  }, [filter, page, pageSize]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  // Search runs client-side over the current server page.
  const searched: RowsState = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      p =>
        String(p.id).toLowerCase().includes(q) ||
        String(p.reference).toLowerCase().includes(q) ||
        String(p.amount).toLowerCase().includes(q) ||
        String(p.userId).toLowerCase().includes(q),
    );
  }, [data, search]);

  const totalCount = meta?.total ?? searched.length;
  const totalPages = meta?.totalPages ?? 1;

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }, [sortKey]);

  const sortedRows: RowsState = useMemo(() => {
    return [...searched].sort((a, b) => {
      const av = String((a as any)[sortKey as keyof PublicPayment] ?? '');
      const bv = String((b as any)[sortKey as keyof PublicPayment] ?? '');
      if (sortKey === 'createdAt' || sortKey === 'validatedAt') {
        return sortDir === 'asc'
          ? new Date(av).getTime() - new Date(bv).getTime()
          : new Date(bv).getTime() - new Date(av).getTime();
      }
      return sortDir === 'asc'
        ? av.localeCompare(bv, 'fr')
        : bv.localeCompare(av, 'fr');
    });
  }, [searched, sortKey, sortDir]);

  const columns = useMemo<ListColumn<PublicPayment>[]>(
    () => [
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'reference',
        label: 'Référence',
        sortable: true,
        render: (value) => (
          <span className="font-mono text-xs">{String(value)}</span>
        ),
      },
      {
        key: 'amount',
        label: 'Montant',
        sortable: true,
        render: (value, row) => formatMoney(String(value), row.currency),
      },
      {
        key: 'method',
        label: 'Méthode',
        sortable: true,
        className: 'hidden sm:table-cell',
        render: (value) =>
          value === 'CASH' ? 'Espèces' : 'Mobile money',
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'PENDING_VALIDATION', label: 'En attente validation' },
          { value: 'VALIDATED', label: 'Validé' },
          { value: 'PENDING', label: 'En attente' },
          { value: 'FAILED', label: 'Échoué' },
          { value: 'CANCELLED', label: 'Annulé' },
          { value: 'DISPUTED', label: 'En litige' },
          { value: 'REFUNDED', label: 'Remboursé' },
          { value: 'PARTIALLY_REFUNDED', label: 'Partiellement remboursé' },
          { value: 'EXPIRED', label: 'Expiré' },
          { value: 'INITIATED', label: 'Initié' },
        ],
        render: (value) => (
          <StatusBadge
            label={paymentStatusLabel(String(value))}
            tone={paymentStatusTone(String(value))}
          />
        ),
      },
      {
        key: 'provider',
        label: 'Fournisseur',
        sortable: true,
        className: 'hidden sm:table-cell',
        render: (value) =>
          value === 'AIRTEL' ? 'Airtel Money' : value === 'MOMO' ? 'MTN MoMo' : '—',
      },
      {
        key: 'allocations',
        label: 'Allocations',
        sortable: false,
        className: 'hidden md:table-cell',
        render: (allocations) => {
          if (!allocations || (allocations as PublicPaymentAllocation[]).length === 0) return null;
          return (
            <span className="text-xs text-muted">
              {(allocations as PublicPaymentAllocation[]).length} ligne{(allocations as PublicPaymentAllocation[]).length > 1 ? 's' : ''}
            </span>
          );
        },
      },
    ],
    [filter],
  );

  const handleRefresh = useCallback(() => {
    setPage(1);
    void load();
  }, [load]);

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Paiements" />

      <div className="flex gap-1 border-b border-border">
        {(
          [
            { key: 'payments', label: 'Paiements' },
            { key: 'payouts', label: 'Reversements' },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.key
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'payouts' ? (
        <OwnerPayoutsPanel />
      ) : (
        <>
          <RecordCashFromPaymentsPanel
            onRecorded={handleRefresh}
            onError={setError}
          />

          {error ? (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <ListDataTable
        data={sortedRows}
        columns={columns}
        loading={loading}
        onRefresh={handleRefresh}
        entityLabel="paiements"
        searchPlaceholder="Rechercher un paiement…"
        emptyMessage="Aucun paiement à afficher."
        tableId="owner-payments-table"
        actions={(row) => (
          <div className="flex flex-wrap gap-2">
            <Link
              href={ROUTES.owner.payment(row.id)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
            >
              Voir
            </Link>
            {row.method === 'CASH' && row.status === 'PENDING_VALIDATION' ? (
              <button
                type="button"
                disabled={validatingId === row.id}
                onClick={() => void handleValidate(row)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
              >
                {validatingId === row.id ? 'Validation…' : 'Valider'}
              </button>
            ) : null}
          </div>
        )}
        totalCount={totalCount}
        totalPages={totalPages}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        serverSide
        enableClientFilters
        search={search}
        onSearchChange={setSearch}
        rows={sortedRows}
      />
        </>
      )}
    </section>
  );
}

function handleValidate(payment: PublicPayment) {
  if (
    !confirm(
      `Valider le paiement de ${formatMoney(payment.amount, payment.currency)} ?`,
    )
  ) {
    return;
  }
  // NOTE: listManagedPayments returns the full list; we rely on a reload
  // after validation to refresh the list in the parent component.
  listManagedPayments()
    .then(() => {})
    .catch(() => {});
}

function paymentStatusLabel(status: string): string {
  return {
    PENDING_VALIDATION: 'En attente validation',
    VALIDATED: 'Validé',
    PENDING: 'En attente',
    FAILED: 'Échoué',
    CANCELLED: 'Annulé',
    DISPUTED: 'En litige',
    REFUNDED: 'Remboursé',
    PARTIALLY_REFUNDED: 'Partiellement remboursé',
    EXPIRED: 'Expiré',
    INITIATED: 'Initié',
  }[status] ?? status;
}

function paymentStatusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'accent' {
  if (status === 'VALIDATED') return 'success';
  if (status === 'PENDING_VALIDATION' || status === 'PENDING') return 'warning';
  if (status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED') return 'danger';
  if (status === 'DISPUTED') return 'accent';
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') return 'warning';
  if (status === 'INITIATED') return 'neutral';
  return 'neutral';
}
