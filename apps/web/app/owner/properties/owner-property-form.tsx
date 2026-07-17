'use client';

import { Icon } from '@iconify/react';
import { DashboardPageHeader } from '@/components/dashboard';
import {
  ApiErrorBanner,
  DateField,
  DropZone,
  FeatureChips,
  FormCard,
  FormField,
  FormFooter,
  FormLayout,
  FormSidebar,
  FormTabs,
  Input,
  MetaList,
  NumberInput,
  Select,
  SelectSearch,
  StatusPill,
  Switcher,
  Textarea,
  TipBox,
  ActionList,
  type FormTab,
} from '@/components/forms';
import { useRequireSession } from '@/hooks/use-require-session';
import { useResourceForm } from '@/hooks/use-resource-form';
import { ApiError } from '@/lib/api';
import {
  listArrondissements,
  listCities,
  listQuartiers,
  type PublicArrondissement,
  type PublicCity,
  type PublicQuartier,
} from '@/lib/owner/locations';
import { uploadMedia, type MediaItem } from '@/lib/owner/media';
import { MediaGallery, type MediaGalleryItem } from '@/components/detail/MediaGallery';
import {
  archiveProperty,
  createProperty,
  defaultPriceUnit,
  getProperty,
  listingStatusLabel,
  listingStatusTone,
  MAP_VIEWS,
  pauseProperty,
  PROPERTY_FEATURES,
  propertyModeLabel,
  propertyStatusLabel,
  propertyStatusTone,
  propertyTypeLabel,
  publishProperty,
  updateProperty,
  type CreatePropertyInput,
  type ListingStatus,
  type MapViewId,
  type PriceUnit,
  type PropertyFeatureId,
  type PropertyMode,
  type PropertyStatus,
  type PropertyType,
  type UpdatePropertyInput,
  type VisitType,
} from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  parseCurrency,
  parseNumeric,
  validateCurrency,
  validateNumeric,
  validateRequired,
} from '@/lib/validation';

type FormValues = {
  title: string;
  description: string;
  type: PropertyType;
  mode: PropertyMode;
  price: string;
  currency: string;
  priceUnit: PriceUnit;
  address: string;
  bedrooms: string;
  bathrooms: string;
  surface: string;
  // Building / lot details
  floor: string;
  yearBuilt: string;
  condition: string;
  lotSize: string;
  parkingSpaces: string;
  orientation: string;
  landTitle: string;
  // Equipment / map views
  features: PropertyFeatureId[];
  mapViews: MapViewId[];
  // Marketplace
  listingStatus: ListingStatus;
  availableFrom: string;
  isFeatured: boolean;
  // Visit configuration
  visitEnabled: boolean;
  visitType: VisitType;
  visitPrice: string;
  visitDuration: string;
  countryId: string;
  cityId: string;
  arrondissementId: string;
  quartierId: string;
};

const PROPERTY_MODES: PropertyMode[] = ['RENT_LONG', 'RENT_SHORT', 'SALE'];
const PROPERTY_TYPES: PropertyType[] = [
  'APARTMENT',
  'HOUSE',
  'LAND',
  'COMMERCIAL',
];
const PRICE_UNITS: PriceUnit[] = ['NIGHT', 'WEEK', 'MONTH', 'TOTAL'];

const defaultValues = (): FormValues => ({
  title: '',
  description: '',
  type: 'APARTMENT',
  mode: 'RENT_LONG',
  price: '',
  currency: 'XAF',
  priceUnit: 'MONTH',
  address: '',
  bedrooms: '',
  bathrooms: '',
  surface: '',
  floor: '',
  yearBuilt: '',
  condition: '',
  lotSize: '',
  parkingSpaces: '',
  orientation: '',
  landTitle: '',
  features: [],
  mapViews: [],
  listingStatus: 'AVAILABLE',
  availableFrom: '',
  isFeatured: false,
  visitEnabled: false,
  visitType: 'FREE',
  visitPrice: '',
  visitDuration: '30',
  countryId: '',
  cityId: '',
  arrondissementId: '',
  quartierId: '',
});

const validate = (v: FormValues): Record<string, string> => {
  const e: Record<string, string> = {};
  e.title = validateRequired(v.title, 'Le titre') ?? '';
  if (!e.title && v.title.trim().length < 3) e.title = 'Minimum 3 caractères.';
  e.description = validateRequired(v.description, 'La description') ?? '';
  if (!e.description && v.description.trim().length < 10)
    e.description = 'Minimum 10 caractères.';
  e.price = validateRequired(v.price, 'Le prix') ?? validateCurrency(v.price) ?? '';
  if (!e.price) {
    const n = parseCurrency(v.price);
    if (n <= 0) e.price = 'Le prix doit être supérieur à 0.';
  }
  e.address = validateRequired(v.address, 'L’adresse') ?? '';
  e.bedrooms = validateNumeric(v.bedrooms, { min: 0 }) ?? '';
  e.bathrooms = validateNumeric(v.bathrooms, { min: 0 }) ?? '';
  e.surface = validateNumeric(v.surface, { min: 0 }) ?? '';
  e.quartierId = validateRequired(v.quartierId, 'Le quartier') ?? '';
  e.yearBuilt =
    v.yearBuilt === ''
      ? ''
      : (validateNumeric(v.yearBuilt, { min: 1800, max: 2100 }) ?? '');
  e.lotSize = v.lotSize === '' ? '' : (validateNumeric(v.lotSize, { min: 0 }) ?? '');
  e.parkingSpaces =
    v.parkingSpaces === ''
      ? ''
      : (validateNumeric(v.parkingSpaces, { min: 0 }) ?? '');
  e.visitDuration = validateNumeric(v.visitDuration, { min: 5, max: 240 }) ?? '';
  e.visitPrice =
    v.visitEnabled && v.visitType === 'PAID'
      ? validateRequired(v.visitPrice, 'Le tarif de visite') ??
        validateCurrency(v.visitPrice) ??
        ''
      : '';
  return e;
};

const toCreateInput = (v: FormValues): CreatePropertyInput => {
  const bedrooms = parseNumeric(v.bedrooms);
  const bathrooms = parseNumeric(v.bathrooms);
  const surface = parseNumeric(v.surface);
  const yearBuilt = parseNumeric(v.yearBuilt);
  const lotSize = parseNumeric(v.lotSize);
  const parkingSpaces = parseNumeric(v.parkingSpaces);
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    type: v.type,
    mode: v.mode,
    price: parseCurrency(v.price),
    currency: v.currency.trim().toUpperCase(),
    priceUnit: v.priceUnit,
    quartierId: v.quartierId,
    address: v.address.trim(),
    countryId: v.countryId,
    ...(bedrooms !== null ? { bedrooms } : {}),
    ...(bathrooms !== null ? { bathrooms } : {}),
    ...(surface !== null ? { surface } : {}),
    ...(v.floor.trim() ? { floor: v.floor.trim() } : {}),
    ...(yearBuilt !== null ? { yearBuilt } : {}),
    ...(v.condition.trim() ? { condition: v.condition.trim() } : {}),
    ...(lotSize !== null ? { lotSize } : {}),
    ...(parkingSpaces !== null ? { parkingSpaces } : {}),
    ...(v.orientation.trim() ? { orientation: v.orientation.trim() } : {}),
    ...(v.landTitle.trim() ? { landTitle: v.landTitle.trim() } : {}),
    ...(v.features.length > 0 ? { features: v.features } : {}),
    ...(v.mapViews.length > 0 ? { mapViews: v.mapViews } : {}),
    listingStatus: v.listingStatus,
    ...(v.availableFrom ? { availableFrom: v.availableFrom } : {}),
    isFeatured: v.isFeatured,
    visitEnabled: v.visitEnabled,
    ...(v.visitEnabled
      ? {
          visitType: v.visitType,
          visitDuration: parseNumeric(v.visitDuration) ?? 30,
          ...(v.visitType === 'PAID' && v.visitPrice
            ? { visitPrice: parseCurrency(v.visitPrice) }
            : {}),
        }
      : {}),
  };
};

const toUpdateInput = (v: FormValues): UpdatePropertyInput => {
  const yearBuilt = parseNumeric(v.yearBuilt);
  const lotSize = parseNumeric(v.lotSize);
  const parkingSpaces = parseNumeric(v.parkingSpaces);
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    price: parseCurrency(v.price),
    address: v.address.trim(),
    ...(v.floor.trim() ? { floor: v.floor.trim() } : { floor: null }),
    ...(yearBuilt !== null ? { yearBuilt } : { yearBuilt: null }),
    ...(v.condition.trim() ? { condition: v.condition.trim() } : { condition: null }),
    ...(lotSize !== null ? { lotSize } : { lotSize: null }),
    ...(parkingSpaces !== null ? { parkingSpaces } : { parkingSpaces: null }),
    ...(v.orientation.trim() ? { orientation: v.orientation.trim() } : { orientation: null }),
    ...(v.landTitle.trim() ? { landTitle: v.landTitle.trim() } : { landTitle: null }),
    features: v.features,
    mapViews: v.mapViews,
    listingStatus: v.listingStatus,
    availableFrom: v.availableFrom ? v.availableFrom : null,
    isFeatured: v.isFeatured,
    visitEnabled: v.visitEnabled,
    ...(v.visitEnabled
      ? {
          visitType: v.visitType,
          visitDuration: parseNumeric(v.visitDuration) ?? 30,
          ...(v.visitType === 'PAID' && v.visitPrice
            ? { visitPrice: parseCurrency(v.visitPrice) }
            : {}),
        }
      : {}),
  };
};

export type OwnerPropertyFormProps = {
  initial?: Partial<FormValues>;
  propertyId?: string;
  submitLabel: string;
  onCancel?: () => void;
  initialStatus?: PropertyStatus;
  initialUpdatedAt?: string;
  initialCreatedAt?: string;
};

export function OwnerPropertyForm({
  initial,
  propertyId,
  submitLabel,
  onCancel,
  initialStatus,
  initialUpdatedAt,
  initialCreatedAt,
}: OwnerPropertyFormProps): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [cities, setCities] = useState<PublicCity[]>([]);
  const [arrondissements, setArrondissements] = useState<PublicArrondissement[]>([]);
  const [quartiers, setQuartiers] = useState<PublicQuartier[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  // Files queued for upload. On add, they're held until the property is
  // created, then uploaded in order. On edit, they upload immediately.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingMedia, setExistingMedia] = useState<MediaItem[]>(
    initial && 'media' in initial ? ((initial as { media?: MediaItem[] }).media ?? []) : [],
  );
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [status, setStatus] = useState<PropertyStatus>(initialStatus ?? 'DRAFT');
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(initialUpdatedAt);
  const [createdAt] = useState<string | undefined>(initialCreatedAt);
  const [sideActionBusy, setSideActionBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // On edit, fetch the existing media for the gallery tab.
  useEffect(() => {
    if (!ready || !propertyId) return;
    let cancelled = false;
    import('@/lib/owner/media')
      .then(({ listMedia }) => listMedia(propertyId))
      .then((items) => {
        if (cancelled) return;
        setExistingMedia(items);
      })
      .catch((err) => {
        if (cancelled) return;
        setMediaError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de charger les médias.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [ready, propertyId]);

  const uploadAllPending = async (targetId: string): Promise<void> => {
    for (let i = 0; i < pendingFiles.length; i++) {
      try {
        await uploadMedia(targetId, pendingFiles[i], i);
      } catch (err) {
        setMediaError(
          err instanceof ApiError
            ? err.message
            : `Échec de l'upload de « ${pendingFiles[i].name} »`,
        );
      }
    }
    setPendingFiles([]);
  };

  // Build preview items from queued files. Object URLs are stable across
  // renders (memoized by index) and revoked when the user removes a file
  // or the component unmounts.
  const pendingPreviews: MediaGalleryItem[] = useMemo(() => {
    const urls = pendingFiles.map((f) => URL.createObjectURL(f));
    return pendingFiles.map((f, idx) => ({
      id: `pending-${idx}-${f.name}-${f.size}`,
      url: urls[idx],
      alt: f.name,
      caption: `${f.name} — ${(f.size / 1024).toFixed(0)} Ko`,
      type: f.type.startsWith('video/') ? 'VIDEO' : 'PHOTO',
    }));
    // We only rebuild when the queue length or identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFiles.length, pendingFiles.map((f) => `${f.name}-${f.size}-${f.lastModified}`).join('|')]);

  const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
  const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime']);

  const ingestMediaFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) return;
    setMediaError(null);
    for (const f of files) {
      if (VIDEO_TYPES.has(f.type)) {
        if (f.size > MAX_VIDEO_BYTES) {
          setMediaError(`« ${f.name} » dépasse 20 Mo.`);
          return;
        }
      } else if (!f.type.startsWith('image/')) {
        setMediaError(`« ${f.name} » : format non supporté.`);
        return;
      }
    }
    if (propertyId) {
      for (let i = 0; i < files.length; i++) {
        try {
          await uploadMedia(propertyId, files[i], existingMedia.length + i);
        } catch (err) {
          setMediaError(
            err instanceof ApiError
              ? err.message
              : `Échec de l'upload de « ${files[i].name} »`,
          );
        }
      }
      const { listMedia } = await import('@/lib/owner/media');
      setExistingMedia(await listMedia(propertyId));
    } else {
      setPendingFiles((prev) => [...prev, ...files]);
    }
  };

  // Revoke pending previews when the queue changes or on unmount.
  useEffect(() => {
    return () => {
      pendingPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [pendingPreviews]);

  const form = useResourceForm<FormValues>({
    initial: { ...defaultValues(), ...initial },
    validate,
    onSubmit: async (values) => {
      if (propertyId) {
        await updateProperty(propertyId, toUpdateInput(values));
        await uploadAllPending(propertyId);
        router.push(ROUTES.owner.property(propertyId));
      } else {
        const created = await createProperty(toCreateInput(values));
        await uploadAllPending(created.id);
        router.push(ROUTES.owner.property(created.id));
      }
    },
  });

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      setLoadingLocations(true);
      try {
        const cityList = await listCities('CG');
        if (cancelled) return;
        setCities(cityList);
        if (!form.values.countryId && cityList[0]) {
          form.setField('countryId', cityList[0].country.id);
        }
        if (!form.values.cityId && cityList[0]) {
          form.setField('cityId', cityList[0].id);
        }
      } catch (err) {
        if (cancelled) return;
        form.setError(
          'locations',
          err instanceof ApiError ? err.message : 'Impossible de charger les villes.',
        );
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!form.values.cityId) {
      setArrondissements([]);
      if (form.values.arrondissementId) form.setField('arrondissementId', '');
      return;
    }
    let cancelled = false;
    void listArrondissements(form.values.cityId).then((items) => {
      if (cancelled) return;
      setArrondissements(items);
      if (!form.values.arrondissementId && items[0]) {
        form.setField('arrondissementId', items[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.cityId]);

  useEffect(() => {
    if (!form.values.arrondissementId) {
      setQuartiers([]);
      if (form.values.quartierId) form.setField('quartierId', '');
      return;
    }
    let cancelled = false;
    void listQuartiers(form.values.arrondissementId).then((items) => {
      if (cancelled) return;
      setQuartiers(items);
      if (!form.values.quartierId && items[0]) {
        form.setField('quartierId', items[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.arrondissementId]);

  useEffect(() => {
    form.setField('priceUnit', defaultPriceUnit(form.values.mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.mode]);

  const marketplaceSection = (
    <div className="space-y-4">
      <FormField
        name="listingStatus"
        label="Statut de publication"
        hint="Affiché sur la fiche du bien et dans les filtres marketplace."
      >
        <Select
          value={form.values.listingStatus}
          onChange={(e) =>
            form.setField('listingStatus', e.target.value as ListingStatus)
          }
        >
          <option value="AVAILABLE">Disponible</option>
          <option value="AVAILABLE_SOON">Bientôt disponible</option>
          <option value="UNDER_OFFER">Sous offre</option>
          <option value="OCCUPIED">Occupé</option>
          <option value="SOLD">Vendu</option>
        </Select>
      </FormField>

      <FormField
        name="availableFrom"
        label="Disponible à partir du"
        hint="Affiché uniquement pour le statut « Bientôt disponible »."
      >
        <DateField
          id="availableFrom"
          value={form.values.availableFrom}
          onChange={(e) => form.setField('availableFrom', e.target.value)}
        />
      </FormField>

      <FormField
        name="isFeatured"
        label="Mise en avant"
        hint="Le bien sera affiché en tête de liste sur le marché."
      >
        <Switcher
          checked={form.values.isFeatured}
          onChange={(v) => form.setField('isFeatured', v)}
          label={form.values.isFeatured ? 'À la une' : 'Standard'}
        />
      </FormField>

      <div className="rounded-lg border border-border bg-card-hover p-4">
        <div className="flex items-start gap-3">
          <Icon
            icon="mdi:information-outline"
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted"
          />
          <div className="text-sm text-muted">
            Le statut marketplace est calculé automatiquement pour les
            locations courtes et les locations longues. Les valeurs que
            vous saisissez ici sont indicatives et peuvent être ajustées par
            le système.
          </div>
        </div>
      </div>
    </div>
  );

  const visitSection = (
    <div className="space-y-4">
      <FormField name="visitEnabled" label="Activer les visites">
        <Switcher
          checked={form.values.visitEnabled}
          onChange={(v) => form.setField('visitEnabled', v)}
          label={
            form.values.visitEnabled ? 'Visites activées' : 'Visites désactivées'
          }
        />
      </FormField>
      {form.values.visitEnabled ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="visitType" label="Type de visite" required>
              <Select
                value={form.values.visitType}
                onChange={(e) =>
                  form.setField('visitType', e.target.value as VisitType)
                }
              >
                <option value="FREE">Gratuite</option>
                <option value="PAID">Payante</option>
              </Select>
            </FormField>
            <FormField
              name="visitDuration"
              label="Durée (min)"
              required
              error={form.errors.visitDuration}
            >
              <NumberInput
                name="visitDuration"
                min={5}
                max={240}
                value={form.values.visitDuration}
                onChange={(v) => form.setField('visitDuration', v)}
                invalid={!!form.errors.visitDuration}
              />
            </FormField>
          </div>
          {form.values.visitType === 'PAID' ? (
            <FormField
              name="visitPrice"
              label="Tarif (XAF)"
              required
              error={form.errors.visitPrice}
            >
              <NumberInput
                name="visitPrice"
                min={0}
                value={form.values.visitPrice}
                onChange={(v) => form.setField('visitPrice', v)}
                invalid={!!form.errors.visitPrice}
              />
            </FormField>
          ) : null}
        </>
      ) : null}
    </div>
  );

  const sidebarFooter = (
    <div className="rounded-lg border border-border bg-card p-5">
      <FormFooter
        onSubmit={() => form.handleSubmit()}
        onCancel={onCancel ?? (() => router.back())}
        submitLabel={submitLabel}
        saving={form.saving}
      />
    </div>
  );

  const tabs: FormTab[] = [
    {
      id: 'general',
      label: 'Général',
      icon: 'mdi:home-city',
      content: (
        <div className="space-y-4">
          <FormField
            name="description"
            label="Description"
            required
            error={form.errors.description}
          >
            <Textarea
              id="description"
              rows={4}
              value={form.values.description}
              onChange={(e) => form.setField('description', e.target.value)}
              placeholder="Décrivez le bien, les équipements, l'accès…"
              invalid={!!form.errors.description}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="mode" label="Mode" required>
              <Select
                id="mode"
                value={form.values.mode}
                onChange={(e) => form.setField('mode', e.target.value as PropertyMode)}
              >
                {PROPERTY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {propertyModeLabel(m)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField name="type" label="Type de bien" required>
              <Select
                id="type"
                value={form.values.type}
                onChange={(e) => form.setField('type', e.target.value as PropertyType)}
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {propertyTypeLabel(t)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              name="price"
              label="Prix"
              required
              error={form.errors.price}
              className="sm:col-span-2"
            >
              <NumberInput
                name="price"
                min={0}
                value={form.values.price}
                onChange={(v) => form.setField('price', v)}
                invalid={!!form.errors.price}
              />
            </FormField>
            <FormField name="currency" label="Devise">
              <Input
                id="currency"
                value={form.values.currency}
                onChange={(e) => form.setField('currency', e.target.value)}
                placeholder="XAF"
                maxLength={3}
              />
            </FormField>
          </div>
          <FormField name="priceUnit" label="Unité de prix">
            <Select
              value={form.values.priceUnit}
              onChange={(e) => form.setField('priceUnit', e.target.value as PriceUnit)}
            >
              {PRICE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      ),
    },
    {
      id: 'location',
      label: 'Localisation',
      icon: 'mdi:map-marker',
      content: (
        <div className="space-y-4">
          <FormField name="address" label="Adresse" required error={form.errors.address}>
            <Input
              id="address"
              value={form.values.address}
              onChange={(e) => form.setField('address', e.target.value)}
              placeholder="Rue, numéro, repère"
              invalid={!!form.errors.address}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="cityId" label="Ville">
              <SelectSearch
                name="cityId"
                value={form.values.cityId}
                onChange={(v) => form.setField('cityId', v)}
                options={cities.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Sélectionner une ville"
                disabled={loadingLocations}
              />
            </FormField>
            <FormField name="arrondissementId" label="Arrondissement">
              <SelectSearch
                name="arrondissementId"
                value={form.values.arrondissementId}
                onChange={(v) => form.setField('arrondissementId', v)}
                options={arrondissements.map((a) => ({
                  value: a.id,
                  label: a.name,
                }))}
                placeholder="Sélectionner un arrondissement"
                disabled={!form.values.cityId}
              />
            </FormField>
          </div>
          <FormField
            name="quartierId"
            label="Quartier"
            required
            error={form.errors.quartierId}
          >
            <SelectSearch
              name="quartierId"
              value={form.values.quartierId}
              onChange={(v) => form.setField('quartierId', v)}
              options={quartiers.map((q) => ({ value: q.id, label: q.name }))}
              placeholder="Sélectionner un quartier"
              invalid={!!form.errors.quartierId}
              disabled={!form.values.arrondissementId}
            />
          </FormField>
        </div>
      ),
    },
    {
      id: 'characteristics',
      label: 'Caractéristiques',
      icon: 'mdi:format-list-bulleted',
      content: (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField name="bedrooms" label="Chambres" error={form.errors.bedrooms}>
              <NumberInput
                name="bedrooms"
                min={0}
                value={form.values.bedrooms}
                onChange={(v) => form.setField('bedrooms', v)}
                invalid={!!form.errors.bedrooms}
              />
            </FormField>
            <FormField
              name="bathrooms"
              label="Salles de bain"
              error={form.errors.bathrooms}
            >
              <NumberInput
                name="bathrooms"
                min={0}
                value={form.values.bathrooms}
                onChange={(v) => form.setField('bathrooms', v)}
                invalid={!!form.errors.bathrooms}
              />
            </FormField>
            <FormField name="surface" label="Surface habitable (m²)" error={form.errors.surface}>
              <NumberInput
                name="surface"
                min={0}
                value={form.values.surface}
                onChange={(v) => form.setField('surface', v)}
                invalid={!!form.errors.surface}
              />
            </FormField>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Icon icon="mdi:office-building-outline" className="h-4 w-4 text-muted" />
              Détails du bien
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField name="floor" label="Étage" hint="Ex. RDC, 1er, 2ème">
                <Input
                  id="floor"
                  value={form.values.floor}
                  onChange={(e) => form.setField('floor', e.target.value)}
                  placeholder="RDC"
                  maxLength={50}
                />
              </FormField>
              <FormField
                name="yearBuilt"
                label="Année de construction"
                error={form.errors.yearBuilt}
              >
                <NumberInput
                  name="yearBuilt"
                  min={1800}
                  max={2100}
                  value={form.values.yearBuilt}
                  onChange={(v) => form.setField('yearBuilt', v)}
                  invalid={!!form.errors.yearBuilt}
                />
              </FormField>
              <FormField name="condition" label="État" hint="Ex. Neuf, Bon, À rénover">
                <Input
                  id="condition"
                  value={form.values.condition}
                  onChange={(e) => form.setField('condition', e.target.value)}
                  placeholder="Bon état"
                  maxLength={80}
                />
              </FormField>
              <FormField
                name="lotSize"
                label="Surface terrain (m²)"
                error={form.errors.lotSize}
                hint="Uniquement pour maisons / terrains"
              >
                <NumberInput
                  name="lotSize"
                  min={0}
                  value={form.values.lotSize}
                  onChange={(v) => form.setField('lotSize', v)}
                  invalid={!!form.errors.lotSize}
                />
              </FormField>
              <FormField
                name="parkingSpaces"
                label="Places de parking"
                error={form.errors.parkingSpaces}
              >
                <NumberInput
                  name="parkingSpaces"
                  min={0}
                  value={form.values.parkingSpaces}
                  onChange={(v) => form.setField('parkingSpaces', v)}
                  invalid={!!form.errors.parkingSpaces}
                />
              </FormField>
              <FormField name="orientation" label="Orientation" hint="Ex. Sud, Nord-Est">
                <Input
                  id="orientation"
                  value={form.values.orientation}
                  onChange={(e) => form.setField('orientation', e.target.value)}
                  placeholder="Sud"
                  maxLength={50}
                />
              </FormField>
              <FormField
                name="landTitle"
                label="Titre foncier"
                className="sm:col-span-2 lg:col-span-3"
                hint="Numéro ou type de titre (ACD, CPF, etc.)"
              >
                <Input
                  id="landTitle"
                  value={form.values.landTitle}
                  onChange={(e) => form.setField('landTitle', e.target.value)}
                  placeholder="ACD n°1234"
                  maxLength={80}
                />
              </FormField>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'features',
      label: 'Équipements',
      icon: 'mdi:star-outline',
      content: (
        <div className="space-y-6">
          <FormField
            name="features"
            label="Équipements du bien"
            hint="Sélectionnez tout ce qui s'applique au bien."
          >
            <FeatureChips
              items={PROPERTY_FEATURES.map((f) => ({
                id: f.id,
                label: f.label,
                icon: f.icon,
              }))}
              value={form.values.features}
              onChange={(v) => form.setField('features', v as PropertyFeatureId[])}
            />
          </FormField>

          <div className="border-t border-border pt-4">
            <FormField
              name="mapViews"
              label="Vues immersives disponibles"
              hint="Cochez les modes de visite virtuelle que vous proposez pour ce bien."
            >
              <FeatureChips
                items={MAP_VIEWS.map((v) => ({
                  id: v.id,
                  label: v.label,
                  icon: v.icon,
                }))}
                value={form.values.mapViews}
                onChange={(v) => form.setField('mapViews', v as MapViewId[])}
              />
            </FormField>
          </div>
        </div>
      ),
    },
    {
      id: 'media',
      label: 'Médias',
      icon: 'mdi:image-multiple',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {propertyId
              ? 'Les fichiers ajoutés sont envoyés immédiatement.'
              : 'Les fichiers ajoutés seront envoyés après la création du bien.'}
          </p>
          <DropZone
            onFiles={(files) => void ingestMediaFiles(files)}
            accept="image/*,video/mp4,video/quicktime"
            maxSizeMb={20}
            multiple
            title="Glissez photos ou vidéo ici"
            hint="JPG, PNG, WEBP, MP4, MOV — vidéo max 20 Mo"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-input-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-card-hover"
            >
              <Icon icon="mdi:image-plus" className="h-4 w-4" />
              Ajouter des photos
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-input-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-card-hover"
            >
              <Icon icon="mdi:video-plus" className="h-4 w-4" />
              Ajouter une vidéo
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              void ingestMediaFiles(files);
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              void ingestMediaFiles(files);
            }}
          />

          {mediaError ? (
            <p role="alert" className="text-sm text-danger">
              {mediaError}
            </p>
          ) : null}

          {propertyId && existingMedia.length > 0 ? (
            <MediaGallery
              items={existingMedia
                .slice()
                .sort((a, b) => a.position - b.position)
                .map<MediaGalleryItem>((m) => ({
                  id: m.id,
                  url: m.url,
                  type: m.type,
                }))}
              emptyLabel="Ajoutez des photos ou une vidéo pour valoriser le bien."
            />
          ) : null}

          {!propertyId && pendingPreviews.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted">
                  {pendingPreviews.length} fichier(s) — envoi à la création du
                  bien
                </p>
                <button
                  type="button"
                  onClick={() => {
                    pendingPreviews.forEach((p) => URL.revokeObjectURL(p.url));
                    setPendingFiles([]);
                  }}
                  className="text-xs text-muted hover:text-danger"
                >
                  Tout retirer
                </button>
              </div>
              <MediaGallery
                items={pendingPreviews}
                onRemove={(id) => {
                  const match = /^pending-(\d+)-/.exec(id);
                  if (!match) return;
                  const idx = Number(match[1]);
                  setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
                }}
              />
            </div>
          ) : null}

          {!propertyId && pendingFiles.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card-hover p-6 text-center text-sm text-muted">
              Ajoutez des photos ou une vidéo pour valoriser le bien.
            </p>
          ) : null}

          {propertyId && existingMedia.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card-hover p-6 text-center text-sm text-muted">
              Ajoutez des photos ou une vidéo pour valoriser le bien.
            </p>
          ) : null}
        </div>
      ),
    },
  ];

  const handleSubmit = (e: FormEvent) => {
    void form.handleSubmit(e);
  };

  if (!ready) {
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  const runSideAction = async (
    key: string,
    fn: () => Promise<unknown>,
  ): Promise<void> => {
    setSideActionBusy(key);
    setMediaError(null);
    try {
      await fn();
      // Refresh the status by re-loading the property (edit mode).
      if (propertyId) {
        const fresh = await getProperty(propertyId);
        setStatus(fresh.status);
        setUpdatedAt(fresh.updatedAt);
      }
    } catch (err) {
      setMediaError(
        err instanceof ApiError ? err.message : 'Action impossible.',
      );
    } finally {
      setSideActionBusy(null);
    }
  };

  const formatDate = (iso?: string): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusTone = propertyStatusTone(status);
  const statusIcon =
    status === 'ACTIVE'
      ? 'mdi:check-circle'
      : status === 'PAUSED'
        ? 'mdi:pause-circle'
        : status === 'ARCHIVED'
          ? 'mdi:archive'
          : 'mdi:pencil-circle';

  const sidebar = propertyId ? (
    <div className="space-y-4">
      <FormSidebar
        sections={[
          {
            title: 'Statut',
            icon: 'mdi:flag-variant-outline',
            children: (
              <div className="flex flex-col gap-2">
                <StatusPill
                  label={propertyStatusLabel(status)}
                  tone={statusTone}
                  icon={statusIcon}
                />
                <p className="text-xs text-muted">
                  {status === 'DRAFT' &&
                    'Ce bien n’est pas encore visible sur le marché.'}
                  {status === 'ACTIVE' &&
                    'Ce bien est visible et ouvert aux réservations.'}
                  {status === 'PAUSED' &&
                    'Ce bien est momentanément masqué du marché.'}
                  {status === 'ARCHIVED' &&
                    'Ce bien est archivé. Il n’est plus visible.'}
                </p>
              </div>
            ),
          },
          {
            title: 'Marché',
            icon: 'mdi:storefront-outline',
            children: marketplaceSection,
          },
          {
            title: 'Visite',
            icon: 'mdi:calendar-clock',
            children: visitSection,
          },
          {
            title: 'Métadonnées',
            icon: 'mdi:information-outline',
            children: (
              <MetaList
                rows={[
                  {
                    label: 'Référence',
                    value: (
                      <span className="font-mono text-xs">
                        {propertyId.slice(0, 8)}
                      </span>
                    ),
                  },
                  { label: 'Créé le', value: formatDate(createdAt) },
                  { label: 'Mis à jour', value: formatDate(updatedAt) },
                ]}
              />
            ),
          },
          {
            title: 'Actions rapides',
            icon: 'mdi:lightning-bolt-outline',
            children: (
              <ActionList
                actions={[
                  ...(status === 'DRAFT' || status === 'PAUSED'
                    ? [
                        {
                          label: 'Publier maintenant',
                          icon: 'mdi:check-circle-outline',
                          variant: 'primary' as const,
                          loading: sideActionBusy === 'publish',
                          onClick: () =>
                            runSideAction('publish', () =>
                              publishProperty(propertyId),
                            ),
                        },
                      ]
                    : []),
                  ...(status === 'ACTIVE'
                    ? [
                        {
                          label: 'Mettre en pause',
                          icon: 'mdi:pause-circle-outline',
                          variant: 'secondary' as const,
                          loading: sideActionBusy === 'pause',
                          onClick: () =>
                            runSideAction('pause', () =>
                              pauseProperty(propertyId),
                            ),
                        },
                      ]
                    : []),
                  ...(status !== 'ARCHIVED'
                    ? [
                        {
                          label: 'Archiver',
                          icon: 'mdi:archive-outline',
                          variant: 'danger' as const,
                          loading: sideActionBusy === 'archive',
                          onClick: () => {
                            if (
                              typeof window !== 'undefined' &&
                              !window.confirm(
                                'Archiver ce bien ? Il ne sera plus visible sur le marché.',
                              )
                            ) {
                              return;
                            }
                            void runSideAction('archive', () =>
                              archiveProperty(propertyId),
                            );
                          },
                        },
                      ]
                    : []),
                ]}
              />
            ),
          },
        ]}
      />
      {sidebarFooter}
    </div>
  ) : (
    <div className="space-y-4">
      <FormSidebar
        sections={[
          {
            title: 'Marché',
            icon: 'mdi:storefront-outline',
            children: marketplaceSection,
          },
          {
            title: 'Visite',
            icon: 'mdi:calendar-clock',
            children: visitSection,
          },
          {
            title: 'À propos',
            icon: 'mdi:information-outline',
            children: (
              <p className="text-sm text-muted">
                Vous allez créer un bien. Il sera enregistré en{' '}
                <strong>brouillon</strong> et pourra être publié depuis la page
                du bien ou la liste de vos biens.
              </p>
            ),
          },
          {
            title: 'Conseils',
            icon: 'mdi:lightbulb-on-outline',
            children: (
              <TipBox
                tips={[
                  {
                    icon: 'mdi:image-multiple-outline',
                    title: 'Ajoutez des photos',
                    body: 'Un bien avec au moins 5 photos reçoit 3× plus de demandes.',
                  },
                  {
                    icon: 'mdi:map-marker-outline',
                    title: 'Localisation précise',
                    body: 'Indiquez la ville, l’arrondissement et le quartier pour apparaître dans les bonnes recherches.',
                  },
                  {
                    icon: 'mdi:cash-multiple',
                    title: 'Prix réaliste',
                    body: 'Les biens avec un prix cohérent du marché sont contactés 2× plus vite.',
                  },
                ]}
              />
            ),
          },
        ]}
      />
      {sidebarFooter}
    </div>
  );

  useEffect(() => {
    if (!ready) return;
    if (form.values.title.trim()) return;
    titleInputRef.current?.focus();
    // Autofocus once when the field starts empty (create flow / empty draft).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={propertyId ? 'Modifier le bien' : 'Ajouter un bien'}
      />
      <ApiErrorBanner message={form.submitError ?? mediaError} />
      <div className="space-y-1">
        <label htmlFor="property-title" className="sr-only">
          Titre du bien
        </label>
        <input
          ref={titleInputRef}
          id="property-title"
          name="title"
          type="text"
          value={form.values.title}
          onChange={(e) => form.setField('title', e.target.value)}
          placeholder="Ajouter un titre"
          aria-invalid={!!form.errors.title}
          aria-describedby={form.errors.title ? 'property-title-error' : undefined}
          className={[
            'w-full border-0 border-b bg-transparent px-0 py-2 text-3xl font-semibold tracking-tight text-foreground',
            'placeholder:font-normal placeholder:text-placeholder',
            'outline-none focus:ring-0',
            form.errors.title
              ? 'border-danger focus:border-danger'
              : 'border-border focus:border-accent',
          ].join(' ')}
        />
        {form.errors.title ? (
          <p id="property-title-error" role="alert" className="text-sm text-danger">
            {form.errors.title}
          </p>
        ) : null}
      </div>
      <FormLayout sidebar={sidebar}>
        <FormCard
          title="Informations du bien"
          hint="Les champs marqués d'un astérisque sont obligatoires."
          footer={
            <FormFooter
              onSubmit={() => form.handleSubmit()}
              onCancel={onCancel ?? (() => router.back())}
              submitLabel={submitLabel}
              saving={form.saving}
            />
          }
        >
          <form onSubmit={handleSubmit} className="space-y-2">
            <FormTabs tabs={tabs} />
          </form>
        </FormCard>
      </FormLayout>
    </div>
  );
}
