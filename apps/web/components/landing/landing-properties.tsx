'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashIcon } from '@/components/dash-icon';
import { listActiveProperties } from '@/lib/public/properties';
import {
  formatPropertyPrice,
  propertyModeLabel,
  type PublicProperty,
  type PropertyMode,
} from '@/lib/owner/properties';

const PLACEHOLDER_IMAGES = [
  '/landing/house1.jpg',
  '/landing/house2.jpg',
  '/landing/house3.jpg',
  '/landing/house4.jpg',
  '/landing/house5.jpg',
  '/landing/house6.jpg',
] as const;

const TABS: Array<{ label: string; mode?: PropertyMode }> = [
  { label: 'Location', mode: 'RENT_LONG' },
  { label: 'Courte durée', mode: 'RENT_SHORT' },
  { label: 'Vente', mode: 'SALE' },
];

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? '';
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? '';

function locationLabel(property: PublicProperty): string {
  const city = property.quartier.arrondissement.city.name;
  const quartier = property.quartier.name;
  return `${quartier}, ${city}`;
}

export function LandingProperties(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState(0);
  const [query, setQuery] = useState('');
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PublicProperty | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listActiveProperties(24);
      setProperties(data);
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const mode = TABS[activeTab]?.mode;
    return properties
      .filter((p) => (mode ? p.mode === mode : true))
      .filter((p) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          p.title.toLowerCase().includes(q) ||
          locationLabel(p).toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [activeTab, properties, query]);

  return (
    <section id="properties" className="bg-white py-16 md:py-24">
      <div className="landing-container">
        <h2 className="text-center text-[32px] font-bold text-[var(--lp-ink)] md:text-[48px]">
          Biens disponibles
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-[15px] text-[var(--lp-muted)]">
          Sélection de biens actifs sur Paradis Immo.
        </p>

        <div className="mt-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="inline-flex flex-wrap rounded-[var(--lp-radius-md)] border-2 border-[var(--lp-border)] bg-[var(--lp-primary-muted)] p-1.5">
            {TABS.map((tab, index) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => setActiveTab(index)}
                className={`min-w-[80px] rounded-[var(--lp-radius-sm)] px-5 py-2 text-[14px] font-semibold transition-colors ${
                  activeTab === index
                    ? 'border border-[var(--lp-border)] bg-white text-[var(--lp-primary)] shadow-sm'
                    : 'text-[var(--lp-muted)] hover:text-[var(--lp-ink)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-[var(--lp-radius-md)] border-2 border-[var(--lp-border)] bg-[var(--lp-primary-muted)] px-3 py-2.5 md:min-w-[280px]">
            <DashIcon
              icon="solar:magnifer-linear"
              className="size-5 text-[var(--lp-primary)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-full bg-transparent text-[15px] text-[var(--lp-ink)] outline-none placeholder:text-[var(--lp-muted)]"
            />
          </label>
        </div>

        {loading ? (
          <p className="mt-10 text-center text-sm text-[var(--lp-muted)]">
            Chargement des biens…
          </p>
        ) : filtered.length === 0 ? (
          <p className="mt-10 text-center text-sm text-[var(--lp-muted)]">
            Aucun bien pour cette catégorie pour le moment.
          </p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((property, index) => (
              <button
                key={property.id}
                type="button"
                onClick={() => setSelected(property)}
                className="overflow-hidden rounded-[var(--lp-radius-lg)] bg-white text-start shadow-[var(--lp-shadow-card)] ring-1 ring-[var(--lp-border)] transition-shadow hover:shadow-lg"
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length]}
                    alt={property.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  />
                  <span className="absolute start-3 top-3 rounded-[var(--lp-radius-sm)] bg-[var(--lp-primary)] px-2.5 py-1 text-xs font-semibold text-white">
                    {propertyModeLabel(property.mode)}
                  </span>
                </div>
                <div className="space-y-3 p-5">
                  <p className="text-2xl font-bold text-[var(--lp-primary)]">
                    {formatPropertyPrice(
                      property.price,
                      property.currency,
                      property.priceUnit,
                    )}
                  </p>
                  <h3 className="text-[22px] font-semibold text-[var(--lp-ink)]">
                    {property.title}
                  </h3>
                  <p className="text-[15px] text-[var(--lp-muted)]">
                    {locationLabel(property)}
                  </p>
                  <div className="flex items-center gap-4 border-t border-[var(--lp-border)] pt-4 text-sm text-[var(--lp-muted)]">
                    {property.bedrooms != null ? (
                      <span>{property.bedrooms} ch.</span>
                    ) : null}
                    {property.surface != null ? (
                      <span>{property.surface} m²</span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-cta-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3
              id="app-cta-title"
              className="text-lg font-semibold text-[var(--lp-ink)]"
            >
              Disponible sur l&apos;application Paradis Immo
            </h3>
            <p className="mt-2 text-sm text-[var(--lp-muted)]">
              {selected.title} — réservez une visite ou contactez un agent
              depuis l&apos;app mobile.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {APP_STORE_URL ? (
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-btn landing-btn-primary flex-1 text-center"
                >
                  App Store
                </a>
              ) : null}
              {PLAY_STORE_URL ? (
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-btn landing-btn-navy flex-1 text-center"
                >
                  Google Play
                </a>
              ) : null}
              {!APP_STORE_URL && !PLAY_STORE_URL ? (
                <p className="text-sm text-[var(--lp-muted)]">
                  Liens de téléchargement bientôt disponibles.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-4 w-full rounded-lg border border-[var(--lp-border)] py-2 text-sm text-[var(--lp-muted)] hover:bg-[var(--lp-primary-muted)]"
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
