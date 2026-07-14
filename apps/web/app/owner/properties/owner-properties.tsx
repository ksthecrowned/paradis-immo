'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { Button } from '@/components/primitives';
import { ApiErrorBanner } from '@/components/forms';
import { ApiError } from '@/lib/api';
import {
  archiveProperty,
  formatPropertyPrice,
  listMyProperties,
  propertyCardBadgeLabel,
  propertyStatusLabel,
  propertyStatusTone,
  publishProperty,
  type PublicProperty,
} from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

export function OwnerPropertiesPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

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

  const handlePublish = useCallback(
    async (id: string) => {
      setActionId(id);
      try {
        await publishProperty(id);
        await load();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de publier le bien.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      if (!confirm('Archiver ce bien ?')) return;
      setActionId(id);
      try {
        await archiveProperty(id);
        await load();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible d’archiver le bien.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const columns = useMemo<ListColumn<PublicProperty>[]>(
    () => [
      {
        key: 'media',
        label: 'Photo',
        className: 'w-16',
        render: (_value, row) => {
          const url = row.media
            ?.slice()
            .sort((a, b) => a.position - b.position)[0]?.url;
          return url ? (
            <Image
              src={url}
              alt=""
              width={40}
              height={40}
              className="size-10 rounded-md object-cover"
            />
          ) : (
            <span className="inline-flex size-10 items-center justify-center rounded-md bg-card-hover text-[10px] text-muted">
              —
            </span>
          );
        },
      },
      {
        key: 'title',
        label: 'Titre',
        sortable: true,
        render: (value, row) => (
          <Link
            href={ROUTES.owner.property(row.id)}
            className="inline-flex items-center gap-2 font-medium text-accent hover:underline"
          >
            {String(value)}
            {row.isFeatured ? (
              <Icon
                icon="mdi:star"
                className="h-4 w-4 text-warning"
                aria-label="À la une"
              />
            ) : null}
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
        render: (_, row) => propertyCardBadgeLabel(row),
      },
      {
        key: 'listingStatus',
        label: 'Marché',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'AVAILABLE', label: 'Disponible' },
          { value: 'AVAILABLE_SOON', label: 'Bientôt disponible' },
          { value: 'UNDER_OFFER', label: 'Sous offre' },
          { value: 'OCCUPIED', label: 'Occupé' },
          { value: 'SOLD', label: 'Vendu' },
        ],
        render: (_, row) =>
          row.listingStatus ? (
            <StatusBadge
              label={row.listingStatus}
              tone={
                row.listingStatus === 'AVAILABLE'
                  ? 'success'
                  : row.listingStatus === 'SOLD'
                    ? 'danger'
                    : 'warning'
              }
            />
          ) : (
            <span className="text-muted">—</span>
          ),
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
          <Link href={ROUTES.owner.propertiesAdd}>
            <Button icon="mdi:plus" variant="primary">
              Ajouter un bien
            </Button>
          </Link>
        }
      />

      <ApiErrorBanner message={error} />

      <ListDataTable
        data={rows}
        columns={columns}
        loading={loading}
        searchPlaceholder="Rechercher un bien…"
        emptyMessage={
          <div className="flex flex-col items-center gap-3 py-6">
            <Icon
              icon="mdi:home-city-outline"
              className="h-12 w-12 text-muted"
            />
            <p className="text-sm text-muted">
              Vous n’avez pas encore de bien.
            </p>
            <Link href={ROUTES.owner.propertiesAdd}>
              <Button icon="mdi:plus" variant="primary">
                Ajouter un bien
              </Button>
            </Link>
          </div>
        }
        entityLabel="biens"
        onRefresh={() => void load()}
        actions={(row) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={ROUTES.owner.property(row.id)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
            >
              Voir
            </Link>
            <Link
              href={ROUTES.owner.propertyEdit(row.id)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
            >
              Éditer
            </Link>
            {row.status === 'DRAFT' || row.status === 'PAUSED' ? (
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={() => void handlePublish(row.id)}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                Publier
              </button>
            ) : null}
            {row.status !== 'ARCHIVED' ? (
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={() => void handleArchive(row.id)}
                className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
              >
                Archiver
              </button>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
