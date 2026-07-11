'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  listManagedPayments,
  paymentStatusLabel,
  paymentStatusTone,
  type PublicPayment,
} from '@/lib/owner/payments';
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

export function OwnerPaymentsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedPayments();
      setRows(data);
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
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

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
        render: (value) => (value === 'CASH' ? 'Espèces' : 'Mobile money'),
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
        ],
        render: (value) => (
          <StatusBadge
            label={paymentStatusLabel(String(value))}
            tone={paymentStatusTone(String(value))}
          />
        ),
      },
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Paiements" />

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <ListDataTable
        data={rows}
        columns={columns}
        loading={loading}
        onRefresh={load}
        entityLabel="paiements"
        searchPlaceholder="Rechercher un paiement…"
        emptyMessage="Aucun paiement à afficher."
        tableId="owner-payments-table"
      />
    </section>
  );
}
