'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/primitives';
import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { ApiErrorBanner } from '@/components/forms';
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
  formatPropertyPrice,
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

      <DetailSection>
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
            label="Surface"
            value={property.surface != null ? `${property.surface} m²` : '—'}
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
        </DetailCard>
      </DetailSection>

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
