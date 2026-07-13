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
import {
  leaseStatusLabel,
  leaseStatusTone,
  listManagedLeases,
  type PublicLease,
} from '@/lib/owner/leases';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function OwnerLeasesPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicLease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedLeases();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les baux.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const columns = useMemo<ListColumn<PublicLease>[]>(
    () => [
      {
        key: 'propertyId',
        label: 'Bien',
        sortable: true,
        render: (value) => (
          <span className="font-mono text-xs text-muted">
            {String(value).slice(0, 8)}…
          </span>
        ),
      },
      {
        key: 'tenantId',
        label: 'Locataire',
        sortable: true,
        className: 'hidden sm:table-cell',
        render: (value) => (
          <span className="font-mono text-xs text-muted">
            {String(value).slice(0, 8)}…
          </span>
        ),
      },
      {
        key: 'startDate',
        label: 'Début',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'endDate',
        label: 'Fin',
        sortable: true,
        className: 'hidden md:table-cell',
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'monthlyRent',
        label: 'Loyer',
        sortable: true,
        render: (value, row) => formatMoney(String(value), row.currency),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'DRAFT', label: 'Brouillon' },
          { value: 'ACTIVE', label: 'Actif' },
          { value: 'TERMINATED', label: 'Terminé' },
          { value: 'CANCELLED', label: 'Annulé' },
        ],
        render: (value) => (
          <StatusBadge
            label={leaseStatusLabel(String(value))}
            tone={leaseStatusTone(String(value))}
          />
        ),
      },
    ],
    [],
  );

  if (!ready) {
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Baux"
        actions={
          <Link
            href={ROUTES.owner.leasesAdd}
            className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Créer un bail
          </Link>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <ListDataTable
        data={rows}
        columns={columns}
        loading={loading}
        onRefresh={load}
        entityLabel="baux"
        searchPlaceholder="Rechercher un bail…"
        emptyMessage={
          <span className="inline-flex flex-col items-center gap-3 py-2">
            <span>Aucun bail à afficher.</span>
            <Link
              href={ROUTES.owner.leasesAdd}
              className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
            >
              Créer un bail
            </Link>
          </span>
        }
        tableId="owner-leases-table"
        actions={(row) => (
          <Link
            href={ROUTES.owner.lease(row.id)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
          >
            Voir
          </Link>
        )}
      />
    </section>
  );
}
