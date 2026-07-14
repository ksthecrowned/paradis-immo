'use client';

import { DashboardPageHeader } from '@/components/dashboard';
import {
  ApiErrorBanner,
  FormCard,
  FormField,
  FormFooter,
  FormTabs,
  Input,
  NumberInput,
  Select,
  SelectSearch,
  Switcher,
  Textarea,
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
import { PropertyMediaUploader } from '@/components/owner/property-media-uploader';
import {
  createProperty,
  defaultPriceUnit,
  propertyModeLabel,
  propertyTypeLabel,
  updateProperty,
  type CreatePropertyInput,
  type PriceUnit,
  type PropertyMode,
  type PropertyType,
  type UpdatePropertyInput,
  type VisitType,
} from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
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

const toUpdateInput = (v: FormValues): UpdatePropertyInput => ({
  title: v.title.trim(),
  description: v.description.trim(),
  price: parseCurrency(v.price),
  address: v.address.trim(),
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
});

export type OwnerPropertyFormProps = {
  initial?: Partial<FormValues>;
  propertyId?: string;
  submitLabel: string;
  onCancel?: () => void;
};

export function OwnerPropertyForm({
  initial,
  propertyId,
  submitLabel,
  onCancel,
}: OwnerPropertyFormProps): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [cities, setCities] = useState<PublicCity[]>([]);
  const [arrondissements, setArrondissements] = useState<PublicArrondissement[]>([]);
  const [quartiers, setQuartiers] = useState<PublicQuartier[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);

  const form = useResourceForm<FormValues>({
    initial: { ...defaultValues(), ...initial },
    validate,
    onSubmit: async (values) => {
      if (propertyId) {
        await updateProperty(propertyId, toUpdateInput(values));
        router.push(ROUTES.owner.property(propertyId));
      } else {
        const created = await createProperty(toCreateInput(values));
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

  const tabs: FormTab[] = [
    {
      id: 'general',
      label: 'Général',
      icon: 'mdi:home-city',
      content: (
        <div className="space-y-4">
          <FormField name="title" label="Titre" required error={form.errors.title}>
            <Input
              id="title"
              value={form.values.title}
              onChange={(e) => form.setField('title', e.target.value)}
              placeholder="Appartement 3 pièces, Bacongo"
              invalid={!!form.errors.title}
            />
          </FormField>
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
          <FormField name="surface" label="Surface (m²)" error={form.errors.surface}>
            <NumberInput
              name="surface"
              min={0}
              value={form.values.surface}
              onChange={(v) => form.setField('surface', v)}
              invalid={!!form.errors.surface}
            />
          </FormField>
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
      ),
    },
    {
      id: 'media',
      label: 'Médias',
      icon: 'mdi:image-multiple',
      content: propertyId ? (
        <PropertyMediaUploader
          propertyId={propertyId}
          initialMedia={[]}
          onMediaChange={() => undefined}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card-hover p-6 text-center text-sm text-muted">
          Vous pourrez ajouter des photos et vidéos après avoir créé le bien.
        </p>
      ),
    },
  ];

  const handleSubmit = (e: FormEvent) => {
    void form.handleSubmit(e);
  };

  if (!ready) {
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={propertyId ? 'Modifier le bien' : 'Ajouter un bien'}
      />
      <ApiErrorBanner message={form.submitError} />
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
    </div>
  );
}
