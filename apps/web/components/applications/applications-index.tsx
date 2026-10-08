'use client';

import Link from 'next/link';
import {
  DashboardPageHeader,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import { PaginatedDataTable } from '@/components/dashboard';
import { listManagedProperties, type PublicProperty } from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useCallback, useMemo, useState } from 'react';

/**
 * Spec 04 — entry point of the candidature screen: pick a `RENT_LONG`
 * property, then manage its candidates on the board.
 */
export function ApplicationsIndex({
  scope,
}: {
  scope: 'owner' | 'agent';
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const [error, setError] = useState<string | null>(null);

  const routes = scope === 'owner' ? ROUTES.owner : ROUTES.agent;

  const fetchFn = useCallback(
    async (params: { page: number; limit: number }) => {
      const all = (await listManagedProperties()).filter(
        (property) => property.mode === 'RENT_LONG',
      );
      const start = (params.page - 1) * params.limit;
      return {
        data: all.slice(start, start + params.limit),
        meta: {
          total: all.length,
          page: params.page,
          pageSize: params.limit,
          totalPages: Math.max(1, Math.ceil(all.length / params.limit)),
        },
      };
    },
    [],
  );

  const columns = useMemo<ListColumn<PublicProperty>[]>(
    () => [
      {
        key: 'title',
        label: 'Bien',
        sortable: true,
        render: (value, row) => (
          <Link
            href={routes.applicationsFor(row.id)}
            className="text-sm font-medium text-foreground hover:text-accent hover:underline"
          >
            {String(value)}
          </Link>
        ),
      },
      {
        key: 'mode',
        label: 'Mode',
        sortable: true,
        className: 'hidden sm:table-cell',
        render: (value) => (
          <StatusBadge label="Location longue durée" tone="accent" />
        ),
      },
      {
        key: 'price',
        label: 'Loyer',
        sortable: true,
        render: (_value, row) =>
          new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: row.currency,
            maximumFractionDigits: 0,
          }).format(Number(row.price)),
      },
      {
        key: 'listingStatus',
        label: 'Disponibilité',
        sortable: true,
        className: 'hidden md:table-cell',
        render: (value) => <StatusBadge label={String(value)} tone="neutral" />,
      },
      {
        key: 'id',
        label: 'Candidatures',
        sortable: false,
        render: (_value, row) => (
          <Link
            href={routes.applicationsFor(row.id)}
            className="text-xs font-medium text-accent hover:underline"
          >
            Gérer
          </Link>
        ),
      },
    ],
    [routes],
  );

  if (!ready) {
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Candidatures" />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <PaginatedDataTable
        fetchFn={fetchFn}
        columns={columns}
        entityLabel="biens"
        searchPlaceholder="Rechercher un bien…"
        emptyMessage="Aucun bien en location longue durée."
        tableId={`${scope}-applications-index`}
        onError={(err) =>
          setError(
            err instanceof ApiError
              ? err.message
              : 'Impossible de charger les biens.',
          )
        }
      />
    </section>
  );
}