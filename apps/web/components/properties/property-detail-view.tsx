'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/primitives';
import { DashboardPageHeader } from '@/components/dashboard';
import {
  ActionList,
  ApiErrorBanner,
  FormLayout,
  FormSidebar,
  MetaList,
  StatusPill,
} from '@/components/forms';
import {
  DetailCard,
  DetailRow,
  MediaGallery,
  type MediaGalleryItem,
} from '@/components/detail';
import { useResourceDetail } from '@/hooks/use-resource-detail';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import { listMedia, type MediaItem } from '@/lib/owner/media';
import {
  DOCUMENT_TYPE_LABELS,
  listDocuments,
  type DocumentType,
  type PropertyDocumentItem,
} from '@/lib/owner/documents';
import {
  archiveProperty,
  featureIcon,
  featureLabel,
  formatPropertyPrice,
  listingStatusLabel,
  listingStatusTone,
  MAP_VIEWS,
  pauseProperty,
  propertyModeLabel,
  propertyStatusLabel,
  propertyStatusTone,
  propertyTypeLabel,
  publishProperty,
  getProperty,
  type PublicProperty,
} from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';

type DetailData = {
  property: PublicProperty;
  media: MediaItem[];
  documents: PropertyDocumentItem[];
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function PropertyDetailView({
  propertyId,
  role = 'owner',
}: {
  propertyId: string;
  role?: 'owner' | 'agent';
}): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const paths: {
    dashboard: string;
    list: string;
    listLabel: string;
    edit: (id: string) => string;
    visitSlots?: (id: string) => string;
  } =
    role === 'agent'
      ? {
          dashboard: ROUTES.agent.dashboard,
          list: ROUTES.agent.portfolio,
          listLabel: 'Portefeuille',
          edit: ROUTES.agent.propertyEdit,
          visitSlots: ROUTES.agent.visitSlots,
        }
      : {
          dashboard: ROUTES.owner.dashboard,
          list: ROUTES.owner.properties,
          listLabel: 'Mes biens',
          edit: ROUTES.owner.propertyEdit,
          visitSlots: ROUTES.owner.visitSlots,
        };

  const load = useCallback(
    async (id: string): Promise<DetailData> => {
      const [property, media, documents] = await Promise.all([
        getProperty(id),
        listMedia(id),
        listDocuments(id).catch(() => [] as PropertyDocumentItem[]),
      ]);
      return { property, media, documents };
    },
    [],
  );

  const { data, loading, error, reload } = useResourceDetail<DetailData>(
    propertyId,
    load,
  );

  if (!ready || loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <DashboardPageHeader title="Détail du bien" />
        <ApiErrorBanner message={error ?? 'Bien introuvable.'} />
        <Link
          href={paths.list}
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <Icon icon="mdi:arrow-left" className="h-4 w-4" />
          Retour au portefeuille
        </Link>
      </div>
    );
  }

  const { property, media, documents } = data;

  const runAction = async (
    key: string,
    fn: () => Promise<unknown>,
    redirectOnSuccess?: string,
  ): Promise<void> => {
    setActionBusy(key);
    setActionError(null);
    try {
      await fn();
      if (redirectOnSuccess) {
        router.push(redirectOnSuccess);
        return;
      }
      await reload();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'Action impossible. Veuillez réessayer.',
      );
    } finally {
      setActionBusy(null);
    }
  };

  const canPublish = property.status === 'DRAFT' || property.status === 'PAUSED';
  const canPause = property.status === 'ACTIVE';
  const canArchive = property.status !== 'ARCHIVED';

  const galleryItems: MediaGalleryItem[] = media
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ id: m.id, url: m.url, type: m.type }));
  const managingOrganization = property.organization ?? property.ownerOrg;
  const priceLabel = formatPropertyPrice(
    property.price,
    property.currency,
    property.priceUnit,
  );
  const statusTone = propertyStatusTone(property.status);
  const statusIcon =
    property.status === 'ACTIVE'
      ? 'mdi:check-circle'
      : property.status === 'PAUSED'
        ? 'mdi:pause-circle'
        : property.status === 'ARCHIVED'
          ? 'mdi:archive'
          : 'mdi:pencil-circle';

  const knownMapViews = (property.mapViews ?? []).filter(
    (v) => v === 'neighborhood' || v === 'tour360',
  );

  const sidebar = (
    <div className="space-y-4">
      <FormSidebar
        sections={[
          {
            title: 'Actions',
            icon: 'mdi:lightning-bolt-outline',
            children: (
              <div className="space-y-3">
                <Link
                  href={paths.edit(propertyId)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-light"
                >
                  <Icon icon="mdi:pencil" className="h-4 w-4" />
                  Modifier
                </Link>
                <ActionList
                  actions={[
                    ...(canPublish
                      ? [
                          {
                            label: 'Publier',
                            icon: 'mdi:check-circle-outline',
                            variant: 'secondary' as const,
                            loading: actionBusy === 'publish',
                            onClick: () =>
                              void runAction('publish', () =>
                                publishProperty(propertyId),
                              ),
                          },
                        ]
                      : []),
                    ...(canPause
                      ? [
                          {
                            label: 'Mettre en pause',
                            icon: 'mdi:pause-circle-outline',
                            variant: 'secondary' as const,
                            loading: actionBusy === 'pause',
                            onClick: () =>
                              void runAction('pause', () =>
                                pauseProperty(propertyId),
                              ),
                          },
                        ]
                      : []),
                    ...(canArchive
                      ? [
                          {
                            label: 'Archiver',
                            icon: 'mdi:archive-outline',
                            variant: 'danger' as const,
                            loading: actionBusy === 'archive',
                            onClick: () => {
                              if (
                                typeof window !== 'undefined' &&
                                !window.confirm(
                                  'Archiver ce bien ? Il ne sera plus visible sur le marché.',
                                )
                              ) {
                                return;
                              }
                              void runAction(
                                'archive',
                                () => archiveProperty(propertyId),
                                paths.list,
                              );
                            },
                          },
                        ]
                      : []),
                    ...(property.visitEnabled && paths.visitSlots
                      ? [
                          {
                            label: 'Gérer les créneaux',
                            icon: 'mdi:calendar-clock',
                            variant: 'secondary' as const,
                            onClick: () =>
                              router.push(paths.visitSlots!(property.id)),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            ),
          },
          {
            title: 'Marché',
            icon: 'mdi:storefront-outline',
            children: (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <StatusPill
                    label={propertyStatusLabel(property.status)}
                    tone={statusTone}
                    icon={statusIcon}
                  />
                  <StatusPill
                    label={listingStatusLabel(property.listingStatus)}
                    tone={listingStatusTone(property.listingStatus)}
                    icon="mdi:storefront-outline"
                  />
                  {property.isFeatured ? (
                    <StatusPill
                      label="À la une"
                      tone="accent"
                      icon="mdi:star"
                    />
                  ) : null}
                </div>
                <MetaList
                  rows={[
                    ...(property.availableFrom
                      ? [
                          {
                            label: 'Disponible le',
                            value: formatShortDate(property.availableFrom),
                          },
                        ]
                      : []),
                    {
                      label: 'Vues',
                      value: String(property.viewCount ?? 0),
                    },
                    {
                      label: 'Favoris',
                      value: String(property.favoriteCount ?? 0),
                    },
                    {
                      label: 'Caution',
                      value:
                        property.depositMonths != null
                          ? `${property.depositMonths} mois`
                          : '—',
                    },
                    {
                      label: 'Frais d’agence',
                      value:
                        property.agencyFeeAmount != null
                          ? formatPropertyPrice(
                              property.agencyFeeAmount,
                              property.currency,
                              'TOTAL',
                            )
                          : '—',
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            title: 'Visite',
            icon: 'mdi:calendar-clock',
            children: (
              <MetaList
                rows={[
                  {
                    label: 'Activée',
                    value: property.visitEnabled ? 'Oui' : 'Non',
                  },
                  ...(property.visitEnabled
                    ? [
                        {
                          label: 'Type',
                          value:
                            property.visitType === 'PAID'
                              ? 'Payante'
                              : 'Gratuite',
                        },
                        {
                          label: 'Durée',
                          value: property.visitDuration
                            ? `${property.visitDuration} min`
                            : '—',
                        },
                        ...(property.visitType === 'PAID'
                          ? [
                              {
                                label: 'Tarif',
                                value:
                                  property.visitPrice != null
                                    ? `${property.visitPrice} ${property.currency}`
                                    : '—',
                              },
                            ]
                          : []),
                      ]
                    : []),
                ]}
              />
            ),
          },
          {
            title: 'Gestionnaire',
            icon: 'mdi:account-tie-outline',
            children: (
              <MetaList
                rows={[
                  {
                    label: 'Agence',
                    value: managingOrganization?.name ?? '—',
                  },
                  {
                    label: 'Agent',
                    value: property.agent?.name ?? 'Non assigné',
                  },
                  {
                    label: 'Téléphone',
                    value: property.agent?.phone ? (
                      <a
                        href={`tel:${property.agent.phone.replace(/\s/g, '')}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {property.agent.phone}
                      </a>
                    ) : (
                      '—'
                    ),
                  },
                  {
                    label: 'Mis à jour',
                    value: formatShortDate(property.updatedAt),
                  },
                  {
                    label: 'Créé le',
                    value: formatShortDate(property.createdAt),
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={property.title}
        breadcrumb={[
          { label: 'Paradis Immo', href: paths.dashboard },
          { label: paths.listLabel, href: paths.list },
          {
            label:
              property.title.length > 40
                ? `${property.title.slice(0, 40)}…`
                : property.title,
          },
        ]}
      />

      {/* Header compact — approche hybride */}
      <header className="border-b border-border pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {property.title}
            </h1>
            <p className="text-sm text-muted">
              {propertyTypeLabel(property.type)} ·{' '}
              {propertyModeLabel(property.mode)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={propertyStatusLabel(property.status)}
                tone={statusTone}
                icon={statusIcon}
              />
              <StatusPill
                label={listingStatusLabel(property.listingStatus)}
                tone={listingStatusTone(property.listingStatus)}
                icon="mdi:storefront-outline"
              />
              {property.isFeatured ? (
                <StatusPill label="À la une" tone="accent" icon="mdi:star" />
              ) : null}
            </div>
          </div>
          <p className="shrink-0 text-2xl font-bold text-accent sm:text-right">
            {priceLabel}
          </p>
        </div>
      </header>

      <ApiErrorBanner message={actionError} />

      <FormLayout sidebar={sidebar}>
        <div className="space-y-6">
          <DetailCard
            title="Médias"
            actions={
              <Link href={paths.edit(propertyId)}>
                <Button icon="mdi:image-edit-outline" variant="secondary" size="sm">
                  Gérer les médias
                </Button>
              </Link>
            }
          >
            <div className="p-5">
              {galleryItems.length > 0 ? (
                <MediaGallery items={galleryItems} />
              ) : (
                <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
                  Aucun média. Ajoutez des photos ou une vidéo depuis
                  l’édition du bien.
                </p>
              )}
            </div>
          </DetailCard>

          <DetailCard
            title="Documents"
            actions={
              <Link href={paths.edit(propertyId)}>
                <Button icon="mdi:file-document-edit-outline" variant="secondary" size="sm">
                  Gérer
                </Button>
              </Link>
            }
          >
            <div className="p-5">
              {documents.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
                  Aucun document (titre foncier, plan…).
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3">
                      <span>
                        <span className="font-medium text-foreground">{d.name}</span>
                        <span className="ms-2 text-xs text-muted">
                          {DOCUMENT_TYPE_LABELS[d.type as DocumentType] ?? d.type}
                        </span>
                      </span>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        Ouvrir
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DetailCard>

          <DetailCard title="Description">
            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {property.description || '—'}
              </p>
            </div>
          </DetailCard>

          <DetailCard title="Caractéristiques">
            <DetailRow label="Chambres" value={property.bedrooms ?? '—'} />
            <DetailRow
              label="Salles de bain"
              value={property.bathrooms ?? '—'}
            />
            <DetailRow
              label="Surface habitable"
              value={
                property.surface != null ? `${property.surface} m²` : '—'
              }
            />
            <DetailRow label="Étage" value={property.floor ?? '—'} />
            <DetailRow
              label="Année de construction"
              value={property.yearBuilt ?? '—'}
            />
            <DetailRow label="État" value={property.condition ?? '—'} />
            <DetailRow
              label="Surface terrain"
              value={
                property.lotSize != null ? `${property.lotSize} m²` : '—'
              }
            />
            <DetailRow
              label="Places de parking"
              value={property.parkingSpaces ?? '—'}
            />
            <DetailRow
              label="Orientation"
              value={property.orientation ?? '—'}
            />
            <DetailRow
              label="Titre foncier"
              value={property.landTitle ?? '—'}
            />
          </DetailCard>

          <DetailCard title="Localisation">
            <DetailRow label="Adresse" value={property.address} />
            <DetailRow
              label="Ville"
              value={property.quartier.arrondissement.city.name}
            />
            <DetailRow
              label="Arrondissement"
              value={property.quartier.arrondissement.name}
            />
            <DetailRow label="Quartier" value={property.quartier.name} />
            <DetailRow
              label="Coordonnées GPS"
              value={
                property.lat != null && property.lng != null
                  ? `${property.lat}, ${property.lng}`
                  : '—'
              }
            />
          </DetailCard>

          <DetailCard title="Équipements & vues immersives">
            <div className="space-y-5 p-5">
              {property.features && property.features.length > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted">
                    Équipements
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {property.features.map((f) => (
                      <span
                        key={f}
                        className="inline-flex items-center gap-2 rounded-full border border-input-border bg-card px-3 py-1.5 text-sm text-foreground"
                      >
                        <Icon
                          icon={featureIcon(f)}
                          className="h-4 w-4 text-accent"
                        />
                        {featureLabel(f)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Aucun équipement renseigné pour ce bien.
                </p>
              )}

              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium text-muted">
                  Vues immersives disponibles
                </p>
                {knownMapViews.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {knownMapViews.map((v) => {
                      const def = MAP_VIEWS.find((m) => m.id === v);
                      return (
                        <span
                          key={v}
                          className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/5 px-3 py-1.5 text-sm text-accent"
                        >
                          <Icon
                            icon={def?.icon ?? 'mdi:map-outline'}
                            className="h-4 w-4"
                          />
                          {def?.label ?? v}
                          {v === 'tour360' ? (
                            <span className="rounded-full bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                              Bientôt
                            </span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    Aucune vue immersive activée.
                  </p>
                )}
              </div>
            </div>
          </DetailCard>
        </div>
      </FormLayout>
    </div>
  );
}
