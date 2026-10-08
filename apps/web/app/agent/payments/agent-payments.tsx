'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import type { PaginatedMeta } from '@/lib/http/types';
import {
  listManagedPayments,
  paymentStatusLabel,
  paymentStatusTone,
  type PublicPayment,
} from '@/lib/owner/payments';
import { AgentPaymentsValidationPage } from '@/app/agent/payments/validation/agent-payments-validation';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

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

type Tab = 'list' | 'validation';

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'PENDING_VALIDATION', label: 'À valider' },
  { value: 'VALIDATED', label: 'Validé' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'FAILED', label: 'Échoué' },
  { value: 'DISPUTED', label: 'En litige' },
  { value: 'REFUNDED', label: 'Remboursé' },
  { value: 'EXPIRED', label: 'Expiré' },
];

/**
 * Spec 05 — /agent/payments : liste et filtres du périmètre, avec la
 * validation existante dans un onglet.
 */
export function AgentPaymentsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [tab, setTab] = useState<Tab>('list');

  const [rows, setRows] = useState<PublicPayment[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listManagedPayments({
        page,
        pageSize,
        ...(status ? { status } : {}),
      });
      setRows(result.data);
      setMeta(result.meta);
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
  }, [page, pageSize, status]);

  useEffect(() => {
    if (!ready || tab !== 'list') return;
    void load();
  }, [load, ready, tab]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.reference.toLowerCase().includes(needle) ||
        row.userId.toLowerCase().includes(needle) ||
        row.amount.includes(needle),
    );
  }, [rows, search]);

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
      },
      {
        key: 'amount',
        label: 'Montant',
        sortable: true,
        render: (_value, row) => formatMoney(row.amount, row.currency),
        getFilterValue: (row) => `${row.amount} ${row.currency}`,
      },
      {
        key: 'method',
        label: 'Méthode',
        sortable: true,
        render: (value) =>
          value === 'CASH' ? (
            <StatusBadge label="Espèces" tone="neutral" />
          ) : (
            <StatusBadge label="Mobile money" tone="accent" />
          ),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
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
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Paiements" />

      <div className="flex gap-1 border-b border-border">
        {(
          [
            { key: 'list', label: 'Liste' },
            { key: 'validation', label: 'Validation' },
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

      {tab === 'validation' ? (
        <AgentPaymentsValidationPage embedded />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">
              <span className="sr-only">Statut</span>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <Link
              href={ROUTES.agent.paymentsValidation}
              className="text-sm font-medium text-accent"
            >
              File de validation →
            </Link>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              {error}
            </div>
          ) : null}

          <ListDataTable
            data={filteredRows}
            columns={columns}
            loading={loading}
            onRefresh={load}
            entityLabel="paiements"
            searchPlaceholder="Rechercher un paiement…"
            emptyMessage="Aucun paiement sur votre portefeuille."
            tableId="agent-payments-table"
            totalCount={meta?.total}
            totalPages={meta?.totalPages}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            actions={(row) => (
              <Link
                href={ROUTES.agent.payment(row.id)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
              >
                Voir
              </Link>
            )}
            serverSide
            search={search}
            onSearchChange={setSearch}
          />
        </>
      )}
    </section>
  );
}
