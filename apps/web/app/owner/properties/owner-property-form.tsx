'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DashboardPageHeader } from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  listArrondissements,
  listCities,
  listQuartiers,
  type PublicArrondissement,
  type PublicCity,
  type PublicQuartier,
} from '@/lib/owner/locations';
import {
  createProperty,
  defaultPriceUnit,
  propertyModeLabel,
  propertyTypeLabel,
  type CreatePropertyInput,
  type PropertyMode,
  type PropertyType,
  type PriceUnit,
  type VisitType,
} from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

const inputClass =
  'block w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-input-focus-border focus:ring-input-focus-border';

const labelClass = 'mb-1 block text-sm font-medium text-foreground';

const PROPERTY_MODES: PropertyMode[] = ['RENT_LONG', 'RENT_SHORT', 'SALE'];
const PROPERTY_TYPES: PropertyType[] = [
  'APARTMENT',
  'HOUSE',
  'LAND',
  'COMMERCIAL',
];
const PRICE_UNITS: PriceUnit[] = ['NIGHT', 'WEEK', 'MONTH', 'TOTAL'];

export function OwnerPropertyForm(): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PropertyType>('APARTMENT');
  const [mode, setMode] = useState<PropertyMode>('RENT_LONG');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('MONTH');
  const [address, setAddress] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [surface, setSurface] = useState('');
  const [visitEnabled, setVisitEnabled] = useState(false);
  const [visitType, setVisitType] = useState<VisitType>('FREE');
  const [visitPrice, setVisitPrice] = useState('');
  const [visitDuration, setVisitDuration] = useState('30');

  const [countryId, setCountryId] = useState('');
  const [cities, setCities] = useState<PublicCity[]>([]);
  const [cityId, setCityId] = useState('');
  const [arrondissements, setArrondissements] = useState<PublicArrondissement[]>(
    [],
  );
  const [arrondissementId, setArrondissementId] = useState('');
  const [quartiers, setQuartiers] = useState<PublicQuartier[]>([]);
  const [quartierId, setQuartierId] = useState('');

  const [loadingLocations, setLoadingLocations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPriceUnit(defaultPriceUnit(mode));
  }, [mode]);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      setLoadingLocations(true);
      try {
        const cityList = await listCities('CG');
        setCities(cityList);
        if (cityList[0]) {
          setCountryId(cityList[0].country.id);
          setCityId(cityList[0].id);
        }
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de charger les villes.',
        );
      } finally {
        setLoadingLocations(false);
      }
    })();
  }, [ready]);

  useEffect(() => {
    if (!cityId) {
      setArrondissements([]);
      setArrondissementId('');
      return;
    }
    void listArrondissements(cityId).then((items) => {
      setArrondissements(items);
      setArrondissementId(items[0]?.id ?? '');
    });
  }, [cityId]);

  useEffect(() => {
    if (!arrondissementId) {
      setQuartiers([]);
      setQuartierId('');
      return;
    }
    void listQuartiers(arrondissementId).then((items) => {
      setQuartiers(items);
      setQuartierId(items[0]?.id ?? '');
    });
  }, [arrondissementId]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!quartierId || !countryId) {
        setError('Sélectionnez un quartier.');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const body: CreatePropertyInput = {
          title: title.trim(),
          description: description.trim(),
          type,
          mode,
          price: Number(price),
          currency: currency.trim().toUpperCase(),
          priceUnit,
          quartierId,
          address: address.trim(),
          countryId,
          ...(bedrooms ? { bedrooms: Number(bedrooms) } : {}),
          ...(bathrooms ? { bathrooms: Number(bathrooms) } : {}),
          ...(surface ? { surface: Number(surface) } : {}),
          visitEnabled,
          ...(visitEnabled
            ? {
                visitType,
                visitDuration: Number(visitDuration) || 30,
                ...(visitType === 'PAID' && visitPrice
                  ? { visitPrice: Number(visitPrice) }
                  : {}),
              }
            : {}),
        };
        const created = await createProperty(body);
        router.push(ROUTES.owner.property(created.id));
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de créer le bien.',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      address,
      bathrooms,
      bedrooms,
      countryId,
      currency,
      description,
      mode,
      price,
      priceUnit,
      quartierId,
      router,
      surface,
      title,
      type,
      visitDuration,
      visitEnabled,
      visitPrice,
      visitType,
    ],
  );

  if (!ready) {
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  return (
    <div>
      <DashboardPageHeader title="Ajouter un bien" />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mx-auto max-w-2xl space-y-6 rounded-md border border-border bg-card p-6 shadow-sm"
      >
        <div>
          <label htmlFor="title" className={labelClass}>
            Titre
          </label>
          <input
            id="title"
            required
            minLength={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Appartement 3 pièces, Bacongo"
          />
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>
            Description
          </label>
          <textarea
            id="description"
            required
            minLength={10}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="Décrivez le bien, les équipements, l'accès…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mode" className={labelClass}>
              Mode
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as PropertyMode)}
              className={inputClass}
            >
              {PROPERTY_MODES.map((m) => (
                <option key={m} value={m}>
                  {propertyModeLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="type" className={labelClass}>
              Type de bien
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as PropertyType)}
              className={inputClass}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {propertyTypeLabel(t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="price" className={labelClass}>
              Prix
            </label>
            <input
              id="price"
              type="number"
              required
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="currency" className={labelClass}>
              Devise
            </label>
            <input
              id="currency"
              required
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="priceUnit" className={labelClass}>
              Unité
            </label>
            <select
              id="priceUnit"
              value={priceUnit}
              onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}
              className={inputClass}
            >
              {PRICE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="address" className={labelClass}>
            Adresse
          </label>
          <input
            id="address"
            required
            minLength={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
            placeholder="Rue, repère…"
          />
        </div>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium text-foreground">
            Localisation
          </legend>
          {loadingLocations ? (
            <p className="text-sm text-muted">Chargement des villes…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="city" className={labelClass}>
                  Ville
                </label>
                <select
                  id="city"
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  className={inputClass}
                >
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="arrondissement" className={labelClass}>
                  Arrondissement
                </label>
                <select
                  id="arrondissement"
                  value={arrondissementId}
                  onChange={(e) => setArrondissementId(e.target.value)}
                  className={inputClass}
                >
                  {arrondissements.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="quartier" className={labelClass}>
                  Quartier
                </label>
                <select
                  id="quartier"
                  required
                  value={quartierId}
                  onChange={(e) => setQuartierId(e.target.value)}
                  className={inputClass}
                >
                  {quartiers.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="bedrooms" className={labelClass}>
              Chambres
            </label>
            <input
              id="bedrooms"
              type="number"
              min={0}
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="bathrooms" className={labelClass}>
              Salles de bain
            </label>
            <input
              id="bathrooms"
              type="number"
              min={0}
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="surface" className={labelClass}>
              Surface (m²)
            </label>
            <input
              id="surface"
              type="number"
              min={0}
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="flex items-center gap-2 px-1 text-sm font-medium text-foreground">
            <input
              id="visitEnabled"
              type="checkbox"
              checked={visitEnabled}
              onChange={(e) => setVisitEnabled(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="visitEnabled">Visites activées</label>
          </legend>
          {visitEnabled ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="visitType" className={labelClass}>
                  Type de visite
                </label>
                <select
                  id="visitType"
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value as VisitType)}
                  className={inputClass}
                >
                  <option value="FREE">Gratuite</option>
                  <option value="PAID">Payante</option>
                </select>
              </div>
              {visitType === 'PAID' ? (
                <div>
                  <label htmlFor="visitPrice" className={labelClass}>
                    Prix visite
                  </label>
                  <input
                    id="visitPrice"
                    type="number"
                    min={0}
                    value={visitPrice}
                    onChange={(e) => setVisitPrice(e.target.value)}
                    className={inputClass}
                  />
                </div>
              ) : null}
              <div>
                <label htmlFor="visitDuration" className={labelClass}>
                  Durée (min)
                </label>
                <input
                  id="visitDuration"
                  type="number"
                  min={15}
                  value={visitDuration}
                  onChange={(e) => setVisitDuration(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          ) : null}
        </fieldset>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || loadingLocations}
            className="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {submitting ? 'Création…' : 'Créer le bien'}
          </button>
          <button
            type="button"
            onClick={() => router.push(ROUTES.owner.properties)}
            className="inline-flex items-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-card-hover"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
