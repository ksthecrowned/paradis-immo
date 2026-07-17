'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/primitives';
import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { ApiErrorBanner, StatusPill } from '@/components/forms';
import {
  DetailCard,
  DetailRow,
  DetailHeader,
  DetailSection,
  MediaGallery,
  type MediaGalleryItem,
} from '@/components/detail';
import { useResourceDetail } from '@/hooks/use-resource-detail';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import { PropertyMediaUploader } from '@/components/owner/property-media-uploader';
import { listMedia, type MediaItem } from '@/lib/owner/media';
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

type DetailData = { property: PublicProperty; media: MediaItem[] };

export function OwnerPropertyDetailView({
  propertyId,
}: {
  propertyId: string;
}): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (id: string): Promise<DetailData> => {
      const [property, media] = await Promise.all([
        getProperty(id),
        listMedia(id),
      ]);
      return { property, media };
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
          href={ROUTES.owner.properties}
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <Icon icon="mdi:arrow-left" className="h-4 w-4" />
          Retour à mes biens
        </Link>
      </div>
    );
  }

  const { property, media } = data;

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

  const cover = media.slice().sort((a, b) => a.position - b.position)[0]?.url;
  const galleryItems: MediaGalleryItem[] = media
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ id: m.id, url: m.url }));
  const managingOrganization = property.organization ?? property.ownerOrg;
  const updatedAtLabel = new Date(property.updatedAt).toLocaleDateString(
    'fr-FR',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    },
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={property.title}
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.owner.dashboard },
          { label: 'Mes biens', href: ROUTES.owner.properties },
          { label: property.title.length > 40 ? `${property.title.slice(0, 40)}…` : property.title },
        ]}
      />

      <DetailHeader
        title={property.title}
        subtitle={`${propertyTypeLabel(property.type)} · ${propertyModeLabel(property.mode)}`}
        meta={
          <StatusBadge
            label={propertyStatusLabel(property.status)}
            tone={propertyStatusTone(property.status)}
          />
        }
        avatar={cover}
        actions={
          <>
            <Link href={ROUTES.owner.propertyEdit(propertyId)}>
              <Button icon="mdi:pencil" variant="primary">
                Modifier
              </Button>
            </Link>
            {canPublish ? (
              <Button
                icon="mdi:check-circle-outline"
                variant="secondary"
                loading={actionBusy === 'publish'}
                onClick={() =>
                  runAction('publish', () => publishProperty(propertyId))
                }
              >
                Publier
              </Button>
            ) : null}
            {canPause ? (
              <Button
                icon="mdi:pause-circle-outline"
                variant="secondary"
                loading={actionBusy === 'pause'}
                onClick={() => runAction('pause', () => pauseProperty(propertyId))}
              >
                Mettre en pause
              </Button>
            ) : null}
            {canArchive ? (
              <Button
                icon="mdi:archive-outline"
                variant="danger"
                loading={actionBusy === 'archive'}
                onClick={() => {
                  if (
                    typeof window !== 'undefined' &&
                    !window.confirm('Archiver ce bien ? Il ne sera plus visible sur le marché.')
                  ) {
                    return;
                  }
                  void runAction(
                    'archive',
                    () => archiveProperty(propertyId),
                    ROUTES.owner.properties,
                  );
                }}
              >
                Archiver
              </Button>
            ) : null}
            {property.visitEnabled ? (
              <Link href={ROUTES.owner.visitSlots(property.id)}>
                <Button icon="mdi:calendar-clock" variant="secondary">
                  Créneaux
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <ApiErrorBanner message={actionError} />

      <DetailSection columns={3}>
        <DetailCard title="Informations générales">
          <DetailRow label="Description" value={property.description} />
          <DetailRow
            label="Prix"
            value={formatPropertyPrice(
              property.price,
              property.currency,
              property.priceUnit,
            )}
          />
          <DetailRow label="Devise" value={property.currency} />
          <DetailRow
            label="Chambres"
            value={property.bedrooms ?? '—'}
          />
          <DetailRow
            label="Salles de bain"
            value={property.bathrooms ?? '—'}
          />
          <DetailRow
            label="Surface habitable"
            value={property.surface != null ? `${property.surface} m²` : '—'}
          />
          <DetailRow
            label="Caution"
            value={
              property.depositMonths != null
                ? `${property.depositMonths} mois`
                : '—'
            }
          />
          <DetailRow
            label="Frais d’agence"
            value={
              property.agencyFeeAmount != null
                ? formatPropertyPrice(
                    property.agencyFeeAmount,
                    property.currency,
                    'TOTAL',
                  )
                : '—'
            }
          />
        </DetailCard>

        <DetailCard title="Localisation">
          <DetailRow label="Adresse" value={property.address} />
          <DetailRow label="Ville" value={property.quartier.arrondissement.city.name} />
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

        <DetailCard title="Gestionnaire">
          <DetailRow
            label="Agence"
            value={managingOrganization?.name ?? '—'}
          />
          <DetailRow
            label="Type"
            value={
              managingOrganization?.type === 'AGENCY'
                ? 'Agence immobilière'
                : managingOrganization?.type
            }
          />
          <DetailRow label="Agent" value={property.agent?.name ?? 'Non assigné'} />
          <DetailRow label="Téléphone">
            {property.agent?.phone ? (
              <a
                href={`tel:${property.agent.phone.replace(/\s/g, '')}`}
                className="font-medium text-accent hover:underline"
              >
                {property.agent.phone}
              </a>
            ) : (
              '—'
            )}
          </DetailRow>
          <DetailRow label="Mis à jour le" value={updatedAtLabel} />
        </DetailCard>
      </DetailSection>

      <DetailCard title="Détails du bien">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label="Étage" value={property.floor ?? '—'} />
          <DetailRow
            label="Année de construction"
            value={property.yearBuilt ?? '—'}
          />
          <DetailRow label="État" value={property.condition ?? '—'} />
          <DetailRow
            label="Surface terrain"
            value={property.lotSize != null ? `${property.lotSize} m²` : '—'}
          />
          <DetailRow
            label="Places de parking"
            value={property.parkingSpaces ?? '—'}
          />
          <DetailRow label="Orientation" value={property.orientation ?? '—'} />
          <DetailRow
            label="Titre foncier"
            value={property.landTitle ?? '—'}
            className="sm:col-span-2 lg:col-span-3"
          />
        </div>
      </DetailCard>

      <DetailCard title="Équipements & vues immersives">
        <div className="space-y-5 p-5">
          {property.features && property.features.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium text-muted">Équipements</p>
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
            {property.mapViews && property.mapViews.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {property.mapViews.map((v) => {
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

      <DetailCard title="Statut marketplace">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
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
          {property.availableFrom ? (
            <DetailRow
              label="Disponible à partir du"
              value={new Date(property.availableFrom).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            />
          ) : null}
          <p className="text-xs text-muted">
            Le statut affiché sur le marché public est calculé en fonction du
            mode de location et des éventuelles réservations en cours.
          </p>
        </div>
      </DetailCard>

      <DetailCard title="Visite">
        <DetailRow
          label="Visite activée"
          value={property.visitEnabled ? 'Oui' : 'Non'}
        />
        {property.visitEnabled ? (
          <>
            <DetailRow
              label="Type"
              value={property.visitType === 'PAID' ? 'Payante' : 'Gratuite'}
            />
            <DetailRow
              label="Durée"
              value={property.visitDuration ? `${property.visitDuration} min` : '—'}
            />
            {property.visitType === 'PAID' ? (
              <DetailRow
                label="Tarif"
                value={
                  property.visitPrice != null
                    ? `${property.visitPrice} ${property.currency}`
                    : '—'
                }
              />
            ) : null}
          </>
        ) : null}
      </DetailCard>

      <DetailCard title="Médias">
        <div className="space-y-6 p-5">
          {galleryItems.length > 0 ? (
            <MediaGallery items={galleryItems} />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
              Aucun média.
            </p>
          )}
          <PropertyMediaUploader
            propertyId={propertyId}
            initialMedia={media}
            onMediaChange={() => undefined}
          />
        </div>
      </DetailCard>
    </div>
  );
}
