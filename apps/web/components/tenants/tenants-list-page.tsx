'use client';

import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  listManagedTenants,
  type ManagedTenantListItem,
} from '@/lib/owner/tenants';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export type TenantsListPageProps = {
  /** Base path for tenant detail pages (e.g. `/owner/tenants`). */
  tenantBasePath: string;
};

export function TenantsListPage({
  tenantBasePath,
}: TenantsListPageProps): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<ManagedTenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedTenants();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les locataires.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const columns = useMemo<ListColumn<ManagedTenantListItem>[]>(
    () => [
      {
        key: 'name',
        label: 'Nom',
        sortable: true,
        render: (_value, row) => (
          <Link
            href={`${tenantBasePath}/${row.id}`}
            className="font-medium text-accent hover:underline"
          >
            {row.name?.trim() || 'Sans nom'}
          </Link>
        ),
      },
      {
        key: 'phone',
        label: 'Téléphone',
        className: 'hidden sm:table-cell',
        render: (value) => (
          <span className="font-mono text-xs">{String(value ?? '—')}</span>
        ),
      },
      {
        key: 'accountCreatedAt',
        label: 'Compte créé le',
        sortable: true,
        className: 'hidden md:table-cell',
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'activeLeaseCount',
        label: 'Baux actifs',
        sortable: true,
        render: (value) => String(value),
      },
      {
        key: 'paymentSummary',
        label: 'Alertes',
        render: (_value, row) => (
          <div className="flex flex-wrap gap-1.5">
            {row.paymentSummary.pendingValidation > 0 ? (
              <StatusBadge
                label={`À valider (${row.paymentSummary.pendingValidation})`}
                tone="warning"
              />
            ) : null}
            {row.paymentSummary.overdueRentLines > 0 ? (
              <StatusBadge
                label={`Retard (${row.paymentSummary.overdueRentLines})`}
                tone="danger"
              />
            ) : null}
            {row.paymentSummary.pendingValidation === 0 &&
            row.paymentSummary.overdueRentLines === 0 ? (
              <span className="text-sm text-muted">—</span>
            ) : null}
          </div>
        ),
      },
    ],
    [tenantBasePath],
  );

  if (!ready) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Locataires" />
      {error ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      <ListDataTable
        data={rows}
        columns={columns}
        loading={loading}
        emptyMessage="Aucun locataire sur vos biens pour le moment."
        entityLabel="locataires"
      />
    </section>
  );
}
