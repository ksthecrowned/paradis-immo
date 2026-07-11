'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboard';
import { PropertyMediaUploader } from '@/components/owner/property-media-uploader';
import { ApiError } from '@/lib/api';
import { listMedia, type MediaItem } from '@/lib/owner/media';
import {
  archiveProperty,
  formatPropertyPrice,
  getProperty,
  propertyModeLabel,
  propertyStatusLabel,
  propertyStatusTone,
  propertyTypeLabel,
  updateProperty,
  type PublicProperty,
} from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

export interface OwnerPropertyDetailProps {
  propertyId: string;
}

export function OwnerPropertyDetail({
  propertyId,
}: OwnerPropertyDetailProps): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [property, setProperty] = useState<PublicProperty | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [address, setAddress] = useState('');
  const [visitEnabled, setVisitEnabled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prop, items] = await Promise.all([
        getProperty(propertyId),
        listMedia(propertyId),
      ]);
      setProperty(prop);
      setMedia(items);
      setTitle(prop.title);
      setDescription(prop.description);
      setPrice(String(prop.price));
      setAddress(prop.address);
      setVisitEnabled(prop.visitEnabled);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le bien.',
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleSave = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
        const updated = await updateProperty(propertyId, {
          title: title.trim(),
          description: description.trim(),
          price: Number(price),
          address: address.trim(),
          visitEnabled,
        });
        setProperty(updated);
        setEditing(false);
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de mettre à jour le bien.',
        );
      } finally {
        setSaving(false);
      }
    },
    [address, description, price, propertyId, title, visitEnabled],
  );

  const handleArchive = useCallback(async () => {
    if (!confirm('Archiver ce bien ? Il ne sera plus visible sur le marché.')) {
      return;
    }
    setArchiving(true);
    try {
      await archiveProperty(propertyId);
      router.push(ROUTES.owner.properties);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’archiver le bien.',
      );
      setArchiving(false);
    }
  }, [propertyId, router]);

  if (!ready || loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  if (error || !property) {
    return (
      <div>
        <DashboardPageHeader title="Détail du bien" />
        <p className="text-sm text-danger" role="alert">
          {error ?? 'Bien introuvable.'}
        </p>
        <Link
          href={ROUTES.owner.properties}
          className="mt-4 inline-block text-sm text-accent hover:underline"
        >
          ← Retour à mes biens
        </Link>
      </div>
    );
  }

  return (
    <div>
      <DashboardPageHeader
        title={property.title}
        actions={
          <div className="flex flex-wrap gap-2">
            {property.status !== 'ARCHIVED' ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover"
                >
                  {editing ? 'Annuler' : 'Modifier'}
                </button>
                <button
                  type="button"
                  disabled={archiving}
                  onClick={() => void handleArchive()}
                  className="inline-flex items-center rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                  {archiving ? 'Archivage…' : 'Archiver'}
                </button>
              </>
            ) : null}
            {property.visitEnabled ? (
              <Link
                href={ROUTES.owner.visitSlots(property.id)}
                className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover"
              >
                Créneaux de visite
              </Link>
            ) : null}
            <Link
              href={ROUTES.owner.properties}
              className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover"
            >
              Mes biens
            </Link>
          </div>
        }
      />

      {error ? (
        <p className="mb-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {editing ? (
        <form
          onSubmit={(e) => void handleSave(e)}
          className="mb-8 max-w-2xl space-y-4 rounded-md border border-border bg-card p-5"
        >
          <h2 className="text-base font-semibold text-heading">Modifier le bien</h2>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Titre</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Prix</span>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Adresse</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={visitEnabled}
              onChange={(e) => setVisitEnabled(e.target.checked)}
            />
            Visites activées
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      ) : null}

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-md border border-border bg-card p-5">
            <h2 className="mb-3 text-base font-semibold text-heading">Photos</h2>
            <PropertyMediaUploader
              propertyId={property.id}
              initialMedia={media}
              onMediaChange={setMedia}
            />
          </section>

          <section className="rounded-md border border-border bg-card p-5">
            <h2 className="mb-2 text-base font-semibold text-heading">
              Description
            </h2>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {property.description}
            </p>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border border-border bg-card p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge
                label={propertyStatusLabel(property.status)}
                tone={propertyStatusTone(property.status)}
              />
              <span className="text-xs text-muted">
                {propertyModeLabel(property.mode)} ·{' '}
                {propertyTypeLabel(property.type)}
              </span>
            </div>
            <p className="text-2xl font-semibold text-heading">
              {formatPropertyPrice(
                property.price,
                property.currency,
                property.priceUnit,
              )}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-muted">Adresse</dt>
                <dd className="text-foreground">{property.address}</dd>
              </div>
              <div>
                <dt className="text-muted">Quartier</dt>
                <dd className="text-foreground">
                  {property.quartier.name},{' '}
                  {property.quartier.arrondissement.city.name}
                </dd>
              </div>
              {property.bedrooms != null ? (
                <div>
                  <dt className="text-muted">Chambres</dt>
                  <dd className="text-foreground">{property.bedrooms}</dd>
                </div>
              ) : null}
              {property.surface != null ? (
                <div>
                  <dt className="text-muted">Surface</dt>
                  <dd className="text-foreground">{property.surface} m²</dd>
                </div>
              ) : null}
              {property.visitEnabled ? (
                <div>
                  <dt className="text-muted">Visites</dt>
                  <dd className="text-foreground">
                    {property.visitType === 'PAID'
                      ? `Payantes (${property.visitPrice ?? 0} ${property.currency})`
                      : 'Gratuites'}
                    {property.visitDuration
                      ? ` · ${property.visitDuration} min`
                      : ''}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
