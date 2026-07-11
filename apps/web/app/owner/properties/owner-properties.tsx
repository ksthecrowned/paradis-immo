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
  formatPropertyPrice,
  listMyProperties,
  propertyModeLabel,
  propertyStatusLabel,
  propertyStatusTone,
  type PublicProperty,
} from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

export function OwnerPropertiesPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMyProperties();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger vos biens.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const columns = useMemo<ListColumn<PublicProperty>[]>(
    () => [
      {
        key: 'title',
        label: 'Titre',
        sortable: true,
        render: (value, row) => (
          <Link
            href={ROUTES.owner.property(row.id)}
            className="font-medium text-accent hover:underline"
          >
            {String(value)}
          </Link>
        ),
      },
      {
        key: 'mode',
        label: 'Mode',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'RENT_LONG', label: 'Location longue' },
          { value: 'RENT_SHORT', label: 'Location courte' },
          { value: 'SALE', label: 'Vente' },
        ],
        render: (value) => propertyModeLabel(String(value)),
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
          { value: 'PAUSED', label: 'En pause' },
          { value: 'ARCHIVED', label: 'Archivé' },
        ],
        render: (value) => (
          <StatusBadge
            label={propertyStatusLabel(String(value))}
            tone={propertyStatusTone(String(value))}
          />
        ),
      },
      {
        key: 'price',
        label: 'Prix',
        sortable: true,
        render: (_, row) =>
          formatPropertyPrice(row.price, row.currency, row.priceUnit),
      },
      {
        key: 'quartier',
        label: 'Quartier',
        getFilterValue: (row) =>
          `${row.quartier.name}, ${row.quartier.arrondissement.city.name}`,
        render: (_, row) => (
          <span className="text-muted">
            {row.quartier.name} · {row.quartier.arrondissement.city.name}
          </span>
        ),
      },
    ],
    [],
  );

  if (!ready) {
    return (
      <p className="text-sm text-muted">Chargement de la session…</p>
    );
  }

  return (
    <div>
      <DashboardPageHeader
        title="Mes biens"
        actions={
          <Link
            href={ROUTES.owner.propertiesAdd}
            className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Ajouter un bien
          </Link>
        }
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <ListDataTable
        data={rows}
        columns={columns}
        loading={loading}
        searchPlaceholder="Rechercher un bien…"
        emptyMessage="Vous n'avez pas encore publié de bien."
        entityLabel="biens"
        onRefresh={() => void load()}
        actions={(row) => (
          <Link
            href={ROUTES.owner.property(row.id)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
          >
            Voir
          </Link>
        )}
      />
    </div>
  );
}
