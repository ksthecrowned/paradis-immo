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
  listManagedInquiries,
  saleStatusLabel,
  saleStatusTone,
  updateInquiryStatus,
  type PublicSaleInquiry,
  type SaleInquiryStatus,
} from '@/lib/agent/sales';
import { useRequireSession } from '@/hooks/use-require-session';

const NEXT_STATUS: Partial<Record<SaleInquiryStatus, SaleInquiryStatus>> = {
  NEW: 'CONTACTED',
  CONTACTED: 'VISIT_SCHEDULED',
  VISIT_SCHEDULED: 'CLOSED',
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function AgentSalesPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicSaleInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedInquiries();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les demandes.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleAdvance = useCallback(
    async (row: PublicSaleInquiry) => {
      const next = NEXT_STATUS[row.status];
      if (!next) return;
      setActionId(row.id);
      try {
        await updateInquiryStatus(row.id, next);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de mettre à jour le statut.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const columns = useMemo<ListColumn<PublicSaleInquiry>[]>(
    () => [
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'propertyId',
        label: 'Bien',
        sortable: true,
        render: (value) => (
          <span className="font-mono text-xs text-muted">{String(value).slice(0, 8)}…</span>
        ),
      },
      {
        key: 'userId',
        label: 'Acheteur',
        className: 'hidden sm:table-cell',
        render: (value) => (
          <span className="font-mono text-xs text-muted">{String(value).slice(0, 8)}…</span>
        ),
      },
      {
        key: 'message',
        label: 'Message',
        className: 'hidden md:table-cell',
        render: (value) => (value ? String(value).slice(0, 60) : '—'),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'NEW', label: 'Nouveau' },
          { value: 'CONTACTED', label: 'Contacté' },
          { value: 'VISIT_SCHEDULED', label: 'Visite planifiée' },
          { value: 'CLOSED', label: 'Clôturé' },
        ],
        render: (value) => (
          <StatusBadge
            label={saleStatusLabel(String(value))}
            tone={saleStatusTone(String(value))}
          />
        ),
      },
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Demandes de vente" />

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
        entityLabel="demandes"
        searchPlaceholder="Rechercher une demande…"
        emptyMessage="Aucune demande de vente."
        tableId="agent-sales-table"
        actions={(row) => {
          const next = NEXT_STATUS[row.status];
          if (!next) return null;
          return (
            <button
              type="button"
              disabled={actionId === row.id}
              onClick={() => void handleAdvance(row)}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              → {saleStatusLabel(next)}
            </button>
          );
        }}
      />
    </section>
  );
}
