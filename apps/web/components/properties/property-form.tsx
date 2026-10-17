'use client';

import { appDialog } from '@/components/dialogs/app-dialog';
import { Icon } from '@iconify/react';
import { DashboardPageHeader } from '@/components/dashboard';
import { Button } from '@/components/primitives';
import {
  ApiErrorBanner,
  DateField,
  DropZone,
  FeatureChips,
  FormCard,
  FormField,
  FormLayout,
  FormSidebar,
  FormStepper,
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
  type FormStepperStep,
} from '@/components/forms';
import { useRequireSession } from '@/hooks/use-require-session';
import { useResourceForm } from '@/hooks/use-resource-form';
import { listSelectableAgencyClients } from '@/lib/agent/clients';
import { ApiError } from '@/lib/api';
import {
  agentOrganizationIds,
  listMyOrganizations,
} from '@/lib/me';
import {
  listArrondissements,
  listCities,
  listQuartiers,
  type PublicArrondissement,
  type PublicCity,
  type PublicQuartier,
} from '@/lib/owner/locations';
import { uploadMedia, listMedia, type MediaItem } from '@/lib/owner/media';
import {
  DOCUMENT_TYPE_LABELS,
  deleteDocument,
  listDocuments,
  uploadDocument,
  type DocumentType,
  type PropertyDocumentItem,
} from '@/lib/owner/documents';
import { PropertyMediaUploader } from '@/components/owner/property-media-uploader';
import { MediaGallery, type MediaGalleryItem } from '@/components/detail/MediaGallery';
import {
  archiveProperty,
  createProperty,
  defaultPriceUnit,
  getProperty,
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
import Link from 'next/link';
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
  lat: string;
  lng: string;
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
  // Visit configuration
  visitEnabled: boolean;
  visitType: VisitType;
  visitPrice: string;
  visitDuration: string;
  depositMonths: string;
  agencyFeeAmount: string;
  minNights: string;
  maxNights: string;
  checkInTime: string;
  checkOutTime: string;
  countryId: string;
  cityId: string;
  arrondissementId: string;
  quartierId: string;
  /** Agent-on-behalf only — CRM client of the agency */
  agencyClientId: string;
};

const PROPERTY_MODES: PropertyMode[] = ['RENT_LONG', 'RENT_SHORT', 'SALE'];
const PROPERTY_TYPES: PropertyType[] = [
  'APARTMENT',
  'HOUSE',
  'LAND',
  'COMMERCIAL',
];
const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
  NIGHT: 'par nuit',
  WEEK: 'par semaine',
  MONTH: 'par mois',
  TOTAL: 'prix total',
};

type PropertyFormStep = FormStepperStep & {
  content: React.ReactNode;
  fields: string[];
};

const defaultValues = (): FormValues => ({
  title: '',
  description: '',
  type: 'APARTMENT',
  mode: 'RENT_LONG',
  price: '',
  currency: 'XAF',
  priceUnit: 'MONTH',
  address: '',
  lat: '',
  lng: '',
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
  visitEnabled: false,
  visitType: 'FREE',
  visitPrice: '',
  visitDuration: '30',
  depositMonths: '',
  agencyFeeAmount: '',
  minNights: '',
  maxNights: '',
  checkInTime: '',
  checkOutTime: '',
  countryId: '',
  cityId: '',
  arrondissementId: '',
  quartierId: '',
  agencyClientId: '',
});

const validate = (
  v: FormValues,
  opts: {
    variant: 'owner' | 'agent';
    /** Agent-on-behalf fields only required when creating. */
    requireOwnerContact?: boolean;
  },
): Record<string, string> => {
  const e: Record<string, string> = {};
  e.title = validateRequired(v.title, 'Le titre') ?? '';
  if (!e.title && v.title.trim().length < 3) e.title = 'Minimum 3 caractères.';
  e.description = validateRequired(v.description, 'La description') ?? '';
  if (opts.variant === 'agent' && opts.requireOwnerContact !== false) {
    e.agencyClientId =
      validateRequired(v.agencyClientId, 'Le client propriétaire') ?? '';
  }
  if (!e.description && v.description.trim().length < 10)
    e.description = 'Minimum 10 caractères.';
  e.price = validateRequired(v.price, 'Le prix') ?? validateCurrency(v.price) ?? '';
  if (!e.price) {
    const n = parseCurrency(v.price);
    if (n <= 0) e.price = 'Le prix doit être supérieur à 0.';
  }
  e.address = validateRequired(v.address, 'L’adresse') ?? '';
  e.lat =
    v.lat === '' ? '' : (validateNumeric(v.lat, { min: -90, max: 90 }) ?? '');
  e.lng =
    v.lng === '' ? '' : (validateNumeric(v.lng, { min: -180, max: 180 }) ?? '');
  if (!e.lat && !e.lng && (v.lat === '') !== (v.lng === '')) {
    const msg = 'Latitude et longitude doivent être renseignées ensemble.';
    if (v.lat === '') e.lat = msg;
    if (v.lng === '') e.lng = msg;
  }
  const hasRooms = v.type === 'APARTMENT' || v.type === 'HOUSE';
  const hasLandSize = v.type === 'HOUSE' || v.type === 'LAND';
  e.bedrooms = hasRooms ? (validateNumeric(v.bedrooms, { min: 0 }) ?? '') : '';
  e.bathrooms = hasRooms
    ? (validateNumeric(v.bathrooms, { min: 0 }) ?? '')
    : '';
  e.surface =
    v.type === 'LAND' ? '' : (validateNumeric(v.surface, { min: 0 }) ?? '');
  e.quartierId = validateRequired(v.quartierId, 'Le quartier') ?? '';
  e.yearBuilt =
    v.type === 'LAND' || v.yearBuilt === ''
      ? ''
      : (validateNumeric(v.yearBuilt, { min: 1800, max: 2100 }) ?? '');
  e.lotSize =
    !hasLandSize || v.lotSize === ''
      ? ''
      : (validateNumeric(v.lotSize, { min: 0 }) ?? '');
  e.parkingSpaces =
    v.type === 'LAND' || v.parkingSpaces === ''
      ? ''
      : (validateNumeric(v.parkingSpaces, { min: 0 }) ?? '');
  e.visitDuration = v.visitEnabled
    ? (validateNumeric(v.visitDuration, { min: 5, max: 240 }) ?? '')
    : '';
  const isRental = v.mode !== 'SALE';
  e.depositMonths =
    !isRental || v.depositMonths === ''
      ? ''
      : (validateNumeric(v.depositMonths, { min: 0, max: 24 }) ?? '');
  e.agencyFeeAmount =
    v.agencyFeeAmount === ''
      ? ''
      : (validateCurrency(v.agencyFeeAmount) ??
        validateNumeric(v.agencyFeeAmount, { min: 0 }) ??
        '');
  if (v.mode === 'RENT_SHORT') {
    e.minNights =
      validateRequired(v.minNights, 'Le nombre minimum de nuits') ??
      validateNumeric(v.minNights, { min: 1 }) ??
      (Number.isInteger(Number(v.minNights))
        ? ''
        : 'Le nombre de nuits doit être un entier.');
    e.maxNights =
      v.maxNights === ''
        ? ''
        : validateNumeric(v.maxNights, { min: 1 }) ??
          (Number.isInteger(Number(v.maxNights))
            ? ''
            : 'Le nombre de nuits doit être un entier.');
    if (
      !e.maxNights &&
      v.maxNights !== '' &&
      Number(v.maxNights) < Number(v.minNights)
    ) {
      e.maxNights = 'Le maximum doit être supérieur ou égal au minimum.';
    }
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    e.checkInTime =
      v.checkInTime === '' || timePattern.test(v.checkInTime)
        ? ''
        : 'Format attendu : HH:mm.';
    e.checkOutTime =
      v.checkOutTime === '' || timePattern.test(v.checkOutTime)
        ? ''
        : 'Format attendu : HH:mm.';
  } else {
    e.minNights = '';
    e.maxNights = '';
    e.checkInTime = '';
    e.checkOutTime = '';
  }
  e.visitPrice =
    v.visitEnabled && v.visitType === 'PAID'
      ? validateRequired(v.visitPrice, 'Le tarif de visite') ??
        validateCurrency(v.visitPrice) ??
        ''
      : '';
  return e;
};

const toCreateInput = (
  v: FormValues,
  onBehalf?: {
    agencyClientId: string;
    organizationId?: string;
  },
): CreatePropertyInput => {
  const bedrooms = parseNumeric(v.bedrooms);
  const bathrooms = parseNumeric(v.bathrooms);
  const surface = parseNumeric(v.surface);
  const lat = parseNumeric(v.lat);
  const lng = parseNumeric(v.lng);
  const yearBuilt = parseNumeric(v.yearBuilt);
  const lotSize = parseNumeric(v.lotSize);
  const parkingSpaces = parseNumeric(v.parkingSpaces);
  const depositMonths = parseNumeric(v.depositMonths);
  const agencyFeeAmount =
    v.agencyFeeAmount.trim() === '' ? null : parseCurrency(v.agencyFeeAmount);
  const shortStay = v.mode === 'RENT_SHORT';
  const isRental = v.mode !== 'SALE';
  const hasRooms = v.type === 'APARTMENT' || v.type === 'HOUSE';
  const hasLandSize = v.type === 'HOUSE' || v.type === 'LAND';
  const isLand = v.type === 'LAND';
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    type: v.type,
    mode: v.mode,
    price: parseCurrency(v.price),
    currency: v.currency.trim().toUpperCase(),
    priceUnit: v.priceUnit,
    ...(shortStay
      ? {
          minNights: parseNumeric(v.minNights) as number,
          maxNights: parseNumeric(v.maxNights),
          checkInTime: v.checkInTime || null,
          checkOutTime: v.checkOutTime || null,
        }
      : {}),
    quartierId: v.quartierId,
    address: v.address.trim(),
    countryId: v.countryId,
    ...(lat !== null ? { lat } : {}),
    ...(lng !== null ? { lng } : {}),
    ...(hasRooms && bedrooms !== null ? { bedrooms } : {}),
    ...(hasRooms && bathrooms !== null ? { bathrooms } : {}),
    ...(!isLand && surface !== null ? { surface } : {}),
    ...(!isLand && v.floor.trim() ? { floor: v.floor.trim() } : {}),
    ...(!isLand && yearBuilt !== null ? { yearBuilt } : {}),
    ...(!isLand && v.condition.trim() ? { condition: v.condition.trim() } : {}),
    ...(hasLandSize && lotSize !== null ? { lotSize } : {}),
    ...(!isLand && parkingSpaces !== null ? { parkingSpaces } : {}),
    ...(isRental && depositMonths !== null ? { depositMonths } : {}),
    ...(agencyFeeAmount !== null && agencyFeeAmount > 0
      ? { agencyFeeAmount }
      : {}),
    ...(v.orientation.trim() ? { orientation: v.orientation.trim() } : {}),
    ...(isLand && v.landTitle.trim() ? { landTitle: v.landTitle.trim() } : {}),
    ...(v.features.length > 0 ? { features: v.features } : {}),
    ...(v.mapViews.length > 0 ? { mapViews: v.mapViews } : {}),
    listingStatus: v.listingStatus,
    ...(v.listingStatus === 'AVAILABLE_SOON' && v.availableFrom
      ? { availableFrom: v.availableFrom }
      : {}),
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
    ...(onBehalf
      ? {
          agencyClientId: onBehalf.agencyClientId,
          ...(onBehalf.organizationId
            ? { organizationId: onBehalf.organizationId }
            : {}),
        }
      : {}),
  };
};

const toUpdateInput = (v: FormValues): UpdatePropertyInput => {
  const bedrooms = parseNumeric(v.bedrooms);
  const bathrooms = parseNumeric(v.bathrooms);
  const surface = parseNumeric(v.surface);
  const lat = parseNumeric(v.lat);
  const lng = parseNumeric(v.lng);
  const yearBuilt = parseNumeric(v.yearBuilt);
  const lotSize = parseNumeric(v.lotSize);
  const parkingSpaces = parseNumeric(v.parkingSpaces);
  const depositMonths = parseNumeric(v.depositMonths);
  const agencyFeeAmount =
    v.agencyFeeAmount.trim() === '' ? null : parseCurrency(v.agencyFeeAmount);
  const shortStay = v.mode === 'RENT_SHORT';
  const isRental = v.mode !== 'SALE';
  const hasRooms = v.type === 'APARTMENT' || v.type === 'HOUSE';
  const hasLandSize = v.type === 'HOUSE' || v.type === 'LAND';
  const isLand = v.type === 'LAND';
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    type: v.type,
    mode: v.mode,
    price: parseCurrency(v.price),
    currency: v.currency.trim().toUpperCase(),
    priceUnit: v.priceUnit,
    minNights: shortStay ? (parseNumeric(v.minNights) as number) : undefined,
    maxNights: shortStay ? parseNumeric(v.maxNights) : null,
    checkInTime: shortStay ? v.checkInTime || null : null,
    checkOutTime: shortStay ? v.checkOutTime || null : null,
    quartierId: v.quartierId,
    address: v.address.trim(),
    lat,
    lng,
    bedrooms: hasRooms ? bedrooms : null,
    bathrooms: hasRooms ? bathrooms : null,
    surface: isLand ? null : surface,
    depositMonths: isRental ? depositMonths : null,
    agencyFeeAmount:
      agencyFeeAmount !== null && agencyFeeAmount > 0 ? agencyFeeAmount : null,
    ...(!isLand && v.floor.trim() ? { floor: v.floor.trim() } : { floor: null }),
    ...(!isLand && yearBuilt !== null ? { yearBuilt } : { yearBuilt: null }),
    ...(!isLand && v.condition.trim() ? { condition: v.condition.trim() } : { condition: null }),
    ...(hasLandSize && lotSize !== null ? { lotSize } : { lotSize: null }),
    ...(!isLand && parkingSpaces !== null ? { parkingSpaces } : { parkingSpaces: null }),
    ...(v.orientation.trim() ? { orientation: v.orientation.trim() } : { orientation: null }),
    ...(isLand && v.landTitle.trim() ? { landTitle: v.landTitle.trim() } : { landTitle: null }),
    features: v.features,
    mapViews: v.mapViews,
    listingStatus: v.listingStatus,
    availableFrom:
      v.listingStatus === 'AVAILABLE_SOON' && v.availableFrom
        ? v.availableFrom
        : null,
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

export type PropertyFormProps = {
  initial?: Partial<FormValues>;
  propertyId?: string;
  submitLabel: string;
  onCancel?: () => void;
  initialStatus?: PropertyStatus;
  initialUpdatedAt?: string;
  initialCreatedAt?: string;
  /** Agent creates a listing for a third-party owner (+ auto-mandate). */
  variant?: 'owner' | 'agent';
};

export function PropertyForm({
  initial,
  propertyId,
  submitLabel,
  onCancel,
  initialStatus,
  initialUpdatedAt,
  initialCreatedAt,
  variant = 'owner',
}: PropertyFormProps): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const isAgentVariant = variant === 'agent';
  const [agencyOrganizationId, setAgencyOrganizationId] = useState<string | null>(
    null,
  );
  const [clientOptions, setClientOptions] = useState<
    { value: string; label: string; hint?: string }[]
  >([]);
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
  const [documents, setDocuments] = useState<PropertyDocumentItem[]>([]);
  const [docError, setDocError] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocumentType>('TITLE_DEED');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [status, setStatus] = useState<PropertyStatus>(initialStatus ?? 'DRAFT');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(initialUpdatedAt);
  const [createdAt] = useState<string | undefined>(initialCreatedAt);
  const [sideActionBusy, setSideActionBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // On edit, fetch the existing media + documents.
  useEffect(() => {
    if (!ready || !propertyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [items, docs] = await Promise.all([
          listMedia(propertyId),
          listDocuments(propertyId),
        ]);
        if (cancelled) return;
        setExistingMedia(items);
        setDocuments(docs);
      } catch (err) {
        if (cancelled) return;
        setMediaError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de charger les médias.',
        );
      }
    })();
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
  const pendingFilesKey = pendingFiles
    .map((f) => `${f.name}-${f.size}-${f.lastModified}`)
    .join('|');
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
  }, [pendingFilesKey, pendingFiles.length]);

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
    validate: (v) =>
      validate(v, {
        variant,
        requireOwnerContact: isAgentVariant && !propertyId,
      }),
    onSubmit: async (values) => {
      if (propertyId) {
        await updateProperty(propertyId, toUpdateInput(values));
        await uploadAllPending(propertyId);
        router.push(
          isAgentVariant
            ? ROUTES.agent.property(propertyId)
            : ROUTES.owner.property(propertyId),
        );
      } else {
        const onBehalf = isAgentVariant
          ? {
              agencyClientId: values.agencyClientId,
              ...(agencyOrganizationId
                ? { organizationId: agencyOrganizationId }
                : {}),
            }
          : undefined;
        const created = await createProperty(toCreateInput(values, onBehalf));
        await uploadAllPending(created.id);
        router.push(
          isAgentVariant
            ? ROUTES.agent.property(created.id)
            : ROUTES.owner.property(created.id),
        );
      }
    },
  });
  const isLandProperty = form.values.type === 'LAND';
  const hasRooms =
    form.values.type === 'APARTMENT' || form.values.type === 'HOUSE';
  const priceUnitOptions: PriceUnit[] =
    form.values.mode === 'RENT_SHORT'
      ? ['NIGHT']
      : form.values.mode === 'RENT_LONG'
        ? ['MONTH']
        : ['TOTAL'];

  useEffect(() => {
    if (!ready || !isAgentVariant || propertyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const orgs = await listMyOrganizations();
        const orgId = agentOrganizationIds(orgs)[0] ?? null;
        if (cancelled) return;
        setAgencyOrganizationId(orgId);
        if (!orgId) {
          setClientOptions([]);
          return;
        }
        const clients = await listSelectableAgencyClients(orgId);
        if (cancelled) return;
        setClientOptions(
          clients.map((c) => ({
            value: c.id,
            label: c.displayName,
            hint: c.hasAccount
              ? `Compte · ${c.phoneE164 ?? '—'}`
              : `Externe · ${c.phoneE164 ?? '—'}`,
          })),
        );
      } catch {
        if (!cancelled) setClientOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, isAgentVariant, propertyId]);

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
      void Promise.resolve().then(() => setArrondissements([]));
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
      void Promise.resolve().then(() => setQuartiers([]));
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
    if (form.values.mode !== 'RENT_SHORT') {
      form.setField('minNights', '');
      form.setField('maxNights', '');
      form.setField('checkInTime', '');
      form.setField('checkOutTime', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.mode]);

  const titleField = (
    <FormField
      name="title"
      label="Titre de l’annonce"
      required
      error={form.errors.title}
      className="w-full"
    >
      <input
        id="property-title"
        name="title"
        type="text"
        value={form.values.title}
        onChange={(e) => form.setField('title', e.target.value)}
        placeholder="Ex. Appartement lumineux au centre-ville"
        aria-invalid={!!form.errors.title}
        className={[
          'w-full rounded-xl border bg-card px-5 py-4 text-2xl font-semibold tracking-tight text-active shadow-sm',
          'placeholder:font-normal placeholder:text-placeholder focus:outline-none focus:ring-2',
          form.errors.title
            ? 'border-danger focus:border-danger focus:ring-danger/30'
            : 'border-input-border focus:border-accent focus:ring-accent/30',
        ].join(' ')}
      />
    </FormField>
  );

  const formSections = [
    {
      id: 'general',
      label: 'Général',
      icon: 'mdi:home-city',
      content: (
        <div className="space-y-6">
          {isAgentVariant && !propertyId ? (
            <section className="space-y-4 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
              <p className="text-sm font-medium text-heading">
                Client propriétaire
              </p>
              <p className="text-sm text-muted">
                Choisissez un client du CRM de votre agence. Un mandat est proposé
                au propriétaire s’il a un compte ; sinon un dépôt de mandat papier
                sera requis. L’agence peut préparer le bien pendant l’attente.
              </p>
              <FormField
                name="agencyClientId"
                label="Client"
                required
                error={form.errors.agencyClientId}
              >
                <SelectSearch
                  name="agencyClientId"
                  value={form.values.agencyClientId}
                  onChange={(v) => form.setField('agencyClientId', v)}
                  options={clientOptions}
                  placeholder="Sélectionner un client…"
                  searchPlaceholder="Rechercher un client…"
                  emptyLabel="Aucun client — ajoutez-en dans Clients"
                  invalid={!!form.errors.agencyClientId}
                />
              </FormField>
              <p className="text-xs text-muted">
                Gérer le portefeuille :{' '}
                <Link href={ROUTES.agent.clients} className="text-accent underline">
                  Clients
                </Link>
              </p>
            </section>
          ) : null}
          <section className="space-y-4 rounded-xl border border-border p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-heading">
              Informations de l’annonce
            </h3>
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
                disabled={initialStatus === 'ACTIVE'}
                onChange={(e) => {
                  const mode = e.target.value as PropertyMode;
                  form.setField('mode', mode);
                  form.setField('priceUnit', defaultPriceUnit(mode));
                }}
            >
              {PROPERTY_MODES.map((m) => (
                <option key={m} value={m}>
                  {propertyModeLabel(m)}
                </option>
              ))}
              </Select>
              {initialStatus === 'ACTIVE' ? (
                <p className="mt-1 text-xs text-muted">
                  Archiver le bien pour changer de mode.
                </p>
              ) : null}
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
        <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              name="price"
              label="Prix"
              required
              hint={`${form.values.currency} · ${PRICE_UNIT_LABELS[priceUnitOptions[0]]}`}
              error={form.errors.price}
            >
              <NumberInput
                name="price"
              min={0}
                value={form.values.price}
                onChange={(v) => form.setField('price', v)}
                invalid={!!form.errors.price}
              />
            </FormField>
          </div>
          </section>
          {form.values.mode === 'RENT_SHORT' ? (
            <section className="space-y-4 rounded-xl border border-border p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-heading">
              Conditions de séjour
            </h3>
            <div className="space-y-4">
              <div>
                <p className="mt-1 text-xs text-muted">
                  Ces informations seront affichées sur la fiche publique.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  name="minNights"
                  label="Nuits min."
                  required
                  error={form.errors.minNights}
                >
                  <NumberInput
                    name="minNights"
                    min={1}
                    allowDecimals={false}
                    value={form.values.minNights}
                    onChange={(v) => form.setField('minNights', v)}
                    invalid={!!form.errors.minNights}
                    placeholder="ex. 2"
                  />
                </FormField>
                <FormField
                  name="maxNights"
                  label="Nuits max."
                  error={form.errors.maxNights}
                >
                  <NumberInput
                    name="maxNights"
                    min={1}
                    allowDecimals={false}
                    value={form.values.maxNights}
                    onChange={(v) => form.setField('maxNights', v)}
                    invalid={!!form.errors.maxNights}
                    placeholder="Optionnel"
                  />
                </FormField>
                <FormField
                  name="checkInTime"
                  label="Check-in"
                  hint="Format HH:mm, à titre informatif."
                  error={form.errors.checkInTime}
                >
                  <Input
                    id="checkInTime"
                    type="time"
                    value={form.values.checkInTime}
                    onChange={(e) => form.setField('checkInTime', e.target.value)}
                    invalid={!!form.errors.checkInTime}
                  />
                </FormField>
                <FormField
                  name="checkOutTime"
                  label="Check-out"
                  hint="Format HH:mm, à titre informatif."
                  error={form.errors.checkOutTime}
                >
                  <Input
                    id="checkOutTime"
                    type="time"
                    value={form.values.checkOutTime}
                    onChange={(e) =>
                      form.setField('checkOutTime', e.target.value)
                    }
                    invalid={!!form.errors.checkOutTime}
                  />
                </FormField>
                </div>
              </div>
              </section>
            ) : null}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              name="lat"
              label="Latitude"
              error={form.errors.lat}
              hint="Optionnel — ex. -4.769 pour Pointe-Noire"
            >
              <Input
                id="lat"
                inputMode="decimal"
                value={form.values.lat}
                onChange={(e) => form.setField('lat', e.target.value)}
                placeholder="-4.769"
                invalid={!!form.errors.lat}
              />
            </FormField>
            <FormField
              name="lng"
              label="Longitude"
              error={form.errors.lng}
              hint="Optionnel — ex. 11.866"
            >
              <Input
                id="lng"
                inputMode="decimal"
                value={form.values.lng}
                onChange={(e) => form.setField('lng', e.target.value)}
                placeholder="11.866"
                invalid={!!form.errors.lng}
              />
            </FormField>
        </div>
        </div>
      ),
    },
    {
      id: 'characteristics',
      label: 'Caractéristiques',
      icon: 'mdi:format-list-bulleted',
      content: (
        <div className="space-y-6">
          {hasRooms ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                name="bedrooms"
                label="Chambres"
                error={form.errors.bedrooms}
              >
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
            </div>
          ) : null}
          {!isLandProperty ? (
            <FormField
              name="surface"
              label={
                form.values.type === 'COMMERCIAL'
                  ? 'Surface commerciale (m²)'
                  : 'Surface habitable (m²)'
              }
              error={form.errors.surface}
            >
              <NumberInput
                name="surface"
                min={0}
                value={form.values.surface}
                onChange={(v) => form.setField('surface', v)}
                invalid={!!form.errors.surface}
              />
            </FormField>
          ) : null}

          <div className="border-t border-border pt-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Icon icon="mdi:office-building-outline" className="h-4 w-4 text-muted" />
              Détails du bien
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {!isLandProperty ? (
                <>
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
                </>
              ) : null}
              {form.values.type === 'HOUSE' || isLandProperty ? (
                <FormField
                  name="lotSize"
                  label="Surface du terrain (m²)"
                  error={form.errors.lotSize}
                >
                  <NumberInput
                    name="lotSize"
                    min={0}
                    value={form.values.lotSize}
                    onChange={(v) => form.setField('lotSize', v)}
                    invalid={!!form.errors.lotSize}
                  />
                </FormField>
              ) : null}
              <FormField name="orientation" label="Orientation" hint="Ex. Sud, Nord-Est">
                <Input
                  id="orientation"
                  value={form.values.orientation}
                  onChange={(e) => form.setField('orientation', e.target.value)}
                  placeholder="Sud"
                  maxLength={50}
                />
              </FormField>
              {isLandProperty ? (
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
              ) : null}
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
      id: 'marketplace',
      label: 'Marché',
      icon: 'mdi:storefront-outline',
      content: (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              name="listingStatus"
              label="Statut de publication"
              hint="Affiché sur la fiche du bien et dans les filtres marketplace."
            >
              <Select
                value={form.values.listingStatus}
                onChange={(e) => {
                  const listingStatus = e.target.value as ListingStatus;
                  form.setField('listingStatus', listingStatus);
                  if (listingStatus !== 'AVAILABLE_SOON') {
                    form.setField('availableFrom', '');
                  }
                }}
              >
                <option value="AVAILABLE">Disponible</option>
                <option value="AVAILABLE_SOON">Bientôt disponible</option>
                <option value="UNDER_OFFER">Sous offre</option>
                <option value="OCCUPIED">Occupé</option>
                <option value="SOLD">Vendu</option>
              </Select>
            </FormField>

            {form.values.listingStatus === 'AVAILABLE_SOON' ? (
              <FormField
                name="availableFrom"
                label="Disponible à partir du"
                hint="Date prévue de disponibilité."
              >
                <DateField
                  id="availableFrom"
                  value={form.values.availableFrom}
                  onChange={(e) => form.setField('availableFrom', e.target.value)}
                />
              </FormField>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {form.values.mode !== 'SALE' ? (
            <FormField
              name="depositMonths"
              label="Caution (mois)"
              hint="Si applicable."
              error={form.errors.depositMonths}
            >
              <NumberInput
                name="depositMonths"
                min={0}
                max={24}
                allowDecimals={false}
                value={form.values.depositMonths}
                onChange={(v) => form.setField('depositMonths', v)}
                invalid={!!form.errors.depositMonths}
                placeholder="ex. 2"
              />
            </FormField>
            ) : null}
            <FormField
            name="agencyFeeAmount"
            label="Frais d’agence"
            hint="Montant en devise du bien, si applicable."
            error={form.errors.agencyFeeAmount}
            className={form.values.mode === 'SALE' ? 'sm:col-span-2' : ''}
            >
              <NumberInput
                name="agencyFeeAmount"
              min={0}
                allowDecimals={false}
                value={form.values.agencyFeeAmount}
                onChange={(v) => form.setField('agencyFeeAmount', v)}
                invalid={!!form.errors.agencyFeeAmount}
                placeholder="ex. 50000"
              />
            </FormField>
          </div>

          <div className="rounded-lg border border-border bg-card-hover p-4">
            <div className="flex items-start gap-3">
              <Icon
                icon="mdi:information-outline"
                className="mt-0.5 h-5 w-5 shrink-0 text-muted"
              />
              <div className="text-sm text-muted">
                Le statut marketplace est calculé automatiquement pour les
                locations courtes et longues selon la disponibilité réelle du
                bien.
          </div>
        </div>
          </div>
        </div>
      ),
    },
    {
      id: 'visit',
      label: 'Visite',
      icon: 'mdi:calendar-clock',
      content: (
        <div className="space-y-4">
          <FormField name="visitEnabled" label="Activer les visites">
            <Switcher
              checked={form.values.visitEnabled}
              onChange={(v) => form.setField('visitEnabled', v)}
              label={form.values.visitEnabled ? 'Visites activées' : 'Visites désactivées'}
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
                  label={`Tarif (${form.values.currency})`}
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
      ),
    },
    {
      id: 'media',
      label: 'Médias',
      icon: 'mdi:image-multiple',
      content: propertyId ? (
        <PropertyMediaUploader
          propertyId={propertyId}
          initialMedia={existingMedia}
          onMediaChange={setExistingMedia}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Les fichiers ajoutés seront envoyés après la création du bien.
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
              className="inline-flex items-center gap-2 rounded-lg border border-input-border bg-card px-4 py-2.5 text-sm font-medium text-active hover:bg-card-hover"
            >
              <Icon icon="mdi:image-plus" className="h-4 w-4" />
              Ajouter des photos
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-input-border bg-card px-4 py-2.5 text-sm font-medium text-active hover:bg-card-hover"
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
          {pendingPreviews.length > 0 ? (
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
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-card-hover p-6 text-center text-sm text-muted">
              Ajoutez des photos ou une vidéo pour valoriser le bien.
            </p>
          )}
        </div>
      ),
    },
    ...(propertyId
      ? ([
          {
            id: 'documents',
            label: 'Documents',
            icon: 'mdi:file-document-outline',
            content: (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Titre foncier, plan ou autre pièce (PDF ou image, max 15 Mo).
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <FormField name="docType" label="Type">
                    <Select
                      id="docType"
                      value={docType}
                      onChange={(e) =>
                        setDocType(e.target.value as DocumentType)
                      }
                    >
                      {(
                        Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]
                      ).map((t) => (
                        <option key={t} value={t}>
                          {DOCUMENT_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input-border bg-card px-4 py-2.5 text-sm font-medium text-active hover:bg-card-hover">
                    <Icon icon="mdi:upload" className="h-4 w-4" />
                    Ajouter un document
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file || !propertyId) return;
                        void (async () => {
                          setDocError(null);
                          try {
                            await uploadDocument(propertyId, file, docType);
                            setDocuments(await listDocuments(propertyId));
                          } catch (err) {
                            setDocError(
                              err instanceof ApiError
                                ? err.message
                                : 'Échec de l’upload du document.',
                            );
                          }
                        })();
                      }}
                    />
                  </label>
                </div>
                {docError ? (
                  <p role="alert" className="text-sm text-danger">
                    {docError}
                  </p>
                ) : null}
                {documents.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
                    Aucun document.
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {documents.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-active">
                            {d.name}
                          </p>
                          <p className="text-xs text-muted">
                            {DOCUMENT_TYPE_LABELS[d.type as DocumentType] ??
                              d.type}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline"
                          >
                            Ouvrir
                          </a>
          <button
            type="button"
                            className="text-danger hover:underline"
                            onClick={() => {
                              void (async () => {
                                try {
                                  await deleteDocument(propertyId, d.id);
                                  setDocuments((prev) =>
                                    prev.filter((x) => x.id !== d.id),
                                  );
                                } catch (err) {
                                  setDocError(
                                    err instanceof ApiError
                                      ? err.message
                                      : 'Suppression impossible.',
                                  );
                                }
                              })();
                            }}
                          >
                            Retirer
          </button>
        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          },
        ] as FormTab[])
      : []),
  ];

  const stepGroups: Array<{
    id: string;
    label: string;
    icon: string;
    sectionIds: string[];
    fields: string[];
  }> = [
    {
      id: 'general',
      label: 'Bien',
      icon: 'mdi:home-city',
      sectionIds: ['general'],
      fields: [
        'title',
        'agencyClientId',
        'description',
        'price',
        'minNights',
        'maxNights',
        'checkInTime',
        'checkOutTime',
      ],
    },
    {
      id: 'location',
      label: 'Localisation',
      icon: 'mdi:map-marker',
      sectionIds: ['location'],
      fields: ['address', 'lat', 'lng', 'quartierId'],
    },
    {
      id: 'characteristics',
      label: 'Caractéristiques',
      icon: 'mdi:format-list-bulleted',
      sectionIds: ['characteristics', 'features'],
      fields: [
        'bedrooms',
        'bathrooms',
        'surface',
        'yearBuilt',
        'lotSize',
        'parkingSpaces',
      ],
    },
    {
      id: 'conditions',
      label: 'Disponibilité',
      icon: 'mdi:calendar-check-outline',
      sectionIds: ['marketplace', 'visit'],
      fields: ['depositMonths', 'agencyFeeAmount', 'visitDuration', 'visitPrice'],
    },
    {
      id: 'media',
      label: 'Photos et documents',
      icon: 'mdi:image-multiple',
      sectionIds: ['media', ...(propertyId ? ['documents'] : [])],
      fields: [],
    },
  ];
  const steps: PropertyFormStep[] = stepGroups.map((group) => {
    const sections = group.sectionIds.flatMap((id) => {
      const section = formSections.find((item) => item.id === id);
      return section ? [section] : [];
    });
    const content =
      sections.length === 1 ? (
        sections[0].content
      ) : (
        <div className="space-y-5">
          {sections.map((section) => (
            <section
              key={section.id}
              className="space-y-4 rounded-xl border border-border p-4 sm:p-5"
            >
              <h3 className="text-sm font-semibold text-heading">
                {section.label}
              </h3>
              {section.content}
            </section>
          ))}
        </div>
      );
    return {
      id: group.id,
      label: group.label,
      icon: group.icon,
      fields: group.fields,
      content,
      errorCount: group.fields.filter((field) => !!form.errors[field]).length,
    };
  });

  const validateStep = (step: PropertyFormStep): boolean => {
    const validationErrors = validate(form.values, {
      variant,
      requireOwnerContact: isAgentVariant && !propertyId,
    });
    let isValid = true;
    for (const field of step.fields) {
      const message = validationErrors[field] ?? '';
      form.setError(field, message);
      if (message) isValid = false;
    }
    return isValid;
  };

  const handleStepNavigation = (stepId: string): void => {
    const targetIndex = steps.findIndex((step) => step.id === stepId);
    if (targetIndex === -1 || targetIndex === currentStepIndex) return;
    if (targetIndex < currentStepIndex) {
      setCurrentStepIndex(targetIndex);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    for (let index = 0; index < targetIndex; index++) {
      if (!validateStep(steps[index])) {
        setCurrentStepIndex(index);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    setCurrentStepIndex(targetIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const currentStep = steps[currentStepIndex];
    if (!currentStep || !validateStep(currentStep)) return;

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((index) => index + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const validationErrors = validate(form.values, {
      variant,
      requireOwnerContact: isAgentVariant && !propertyId,
    });
    for (const [field, message] of Object.entries(validationErrors)) {
      form.setError(field, message);
    }
    const firstInvalidStepIndex = steps.findIndex((step) =>
      step.fields.some((field) => !!validationErrors[field]),
    );
    if (firstInvalidStepIndex !== -1) {
      setCurrentStepIndex(firstInvalidStepIndex);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    void form.handleSubmit();
  };

  const handlePreviousStep = (): void => {
    if (currentStepIndex === 0) {
      (onCancel ?? (() => router.back()))();
      return;
    }
    setCurrentStepIndex((index) => Math.max(0, index - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Autofocus once when the field starts empty (create flow / empty draft).
  // Déclaré avant tout return conditionnel (rules-of-hooks).
  useEffect(() => {
    if (!ready) return;
    if (form.values.title.trim()) return;
    document.getElementById('property-title')?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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
                          onClick: async () => {
                            if (
                              typeof window !== 'undefined' &&
                              !await appDialog.confirm({ message: 'Archiver ce bien ? Il ne sera plus visible sur le marché.' })
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
    </div>
  ) : (
    <div className="space-y-4">
      <FormSidebar
        sections={[
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
    </div>
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={
          propertyId
            ? 'Modifier le bien'
            : isAgentVariant
              ? 'Ajouter un bien pour un propriétaire'
              : 'Ajouter un bien'
        }
      />
      <ApiErrorBanner
        message={form.submitError ?? mediaError ?? form.errors.locations}
      />
      {titleField}
      <FormLayout sidebar={propertyId ? sidebar : undefined}>
        <FormCard
          title="Informations du bien"
          hint="Les champs marqués d'un astérisque sont obligatoires."
        >
          <form onSubmit={handleSubmit}>
            <FormStepper
              steps={steps.map(({ id, label, icon, errorCount }) => ({
                id,
                label,
                icon,
                errorCount,
              }))}
              currentStep={steps[currentStepIndex]?.id ?? steps[0].id}
              onStepClick={handleStepNavigation}
            />
            <div className="min-h-72 w-full py-5">
              {steps[currentStepIndex]?.content}
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                icon={currentStepIndex === 0 ? 'mdi:close' : 'mdi:arrow-left'}
                onClick={handlePreviousStep}
                disabled={form.saving}
              >
                {currentStepIndex === 0 ? 'Annuler' : 'Précédent'}
              </Button>
              <span className="text-center text-sm text-muted">
                Étape {currentStepIndex + 1} sur {steps.length}
              </span>
              <Button
                type="submit"
                icon={
                  currentStepIndex === steps.length - 1
                    ? 'mdi:content-save'
                    : 'mdi:arrow-right'
                }
                loading={form.saving}
                disabled={form.saving}
              >
                {currentStepIndex === steps.length - 1
                  ? submitLabel
                  : 'Continuer'}
              </Button>
            </div>
          </form>
        </FormCard>
      </FormLayout>
    </div>
  );
}
