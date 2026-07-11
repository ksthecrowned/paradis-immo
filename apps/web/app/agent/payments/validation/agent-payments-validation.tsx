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
  listPendingValidationPayments,
  validatePayment,
  type PublicPayment,
} from '@/lib/agent/payments';
import { useRequireSession } from '@/hooks/use-require-session';

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function AgentPaymentsValidationPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPendingValidationPayments();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger la file de validation.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleValidate = useCallback(
    async (payment: PublicPayment) => {
      if (!confirm(`Valider le paiement de ${formatMoney(payment.amount, payment.currency)} ?`)) {
        return;
      }
      setValidatingId(payment.id);
      try {
        await validatePayment(payment.id);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'Impossible de valider le paiement.',
        );
      } finally {
        setValidatingId(null);
      }
    },
    [load],
  );

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
        render: () => <StatusBadge label="Espèces" tone="neutral" />,
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        render: () => <StatusBadge label="À valider" tone="warning" />,
      },
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Validation des paiements" />

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
        emptyMessage="Aucun paiement en attente de validation."
        tableId="agent-payments-validation-table"
        actions={(row) => (
          <button
            type="button"
            disabled={validatingId === row.id}
            onClick={() => void handleValidate(row)}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            Valider
          </button>
        )}
      />
    </section>
  );
}
