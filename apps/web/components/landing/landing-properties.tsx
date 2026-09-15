'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LandingPropertyCard,
  LandingPropertyCardSkeleton,
} from '@/components/landing/landing-property-card';
import { listActiveProperties } from '@/lib/public/properties';
import { hasStoreLinks } from '@/lib/store-links';
import {
  propertyLocationLabel,
  type PublicProperty,
  type PropertyMode,
} from '@/lib/owner/properties';

const TABS: Array<{ label: string; mode?: PropertyMode }> = [
  { label: 'Location', mode: 'RENT_LONG' },
  { label: 'Courte durée', mode: 'RENT_SHORT' },
  { label: 'Vente', mode: 'SALE' },
];

function isDiscoverable(property: PublicProperty): boolean {
  const status = property.listingStatus;
  return (
    status == null ||
    status === 'AVAILABLE' ||
    status === 'AVAILABLE_SOON'
  );
}

export function LandingProperties(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState(0);
  const [query, setQuery] = useState('');
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const cardHref = hasStoreLinks() ? '#app' : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listActiveProperties(48);
      setProperties(data.filter(isDiscoverable));
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const p of properties) {
      try {
        const city = propertyLocationLabel(p).split(',').pop()?.trim();
        if (city) set.add(city);
      } catch {
        /* ignore */
      }
    }
    return [...set].slice(0, 4);
  }, [properties]);

  const filtered = useMemo(() => {
    const mode = TABS[activeTab]?.mode;
    return properties
      .filter((p) => (mode ? p.mode === mode : true))
      .filter((p) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          p.title.toLowerCase().includes(q) ||
          propertyLocationLabel(p).toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [activeTab, properties, query]);

  return (
    <section
      id="properties"
      className="bg-(--lp-bg) py-20 md:py-28"
      aria-labelledby="properties-heading"
    >
      <div className="landing-container">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="lp-eyebrow">Biens</p>
            <h2
              id="properties-heading"
              className="mt-3 text-[2rem] leading-tight text-(--lp-ink) md:text-[2.75rem]"
            >
              À découvrir maintenant
            </h2>
            {!loading && properties.length > 0 ? (
              <p className="mt-3 text-[15px] text-(--lp-muted)">
                {properties.length}{' '}
                {properties.length > 1
                  ? 'biens disponibles'
                  : 'bien disponible'}
                {cities.length > 0 ? ` · ${cities.join(' · ')}` : null}
              </p>
            ) : (
              <p className="mt-4 text-[15px] leading-relaxed text-(--lp-muted)">
                Location, courte durée ou vente.
              </p>
            )}
          </div>

          <label className="flex w-full max-w-sm items-center gap-3 rounded-(--lp-radius-md) border border-(--lp-border) bg-(--lp-surface) px-4 py-3">
            <span className="sr-only">Rechercher un bien</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Quartier, titre…"
              className="w-full bg-transparent text-[15px] text-(--lp-ink) outline-none placeholder:text-(--lp-muted)"
            />
          </label>
        </div>

        <div
          className="mt-10 flex flex-wrap gap-2 border-b border-(--lp-border) pb-px"
          role="tablist"
          aria-label="Type de bien"
        >
          {TABS.map((tab, index) => {
            const active = activeTab === index;
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(index)}
                className={`relative px-4 py-3 text-sm font-semibold transition-colors ${
                  active
                    ? 'text-(--lp-ink)'
                    : 'text-(--lp-muted) hover:text-(--lp-ink)'
                }`}
              >
                {tab.label}
                {active ? (
                  <span
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-(--lp-primary)"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
            {Array.from({ length: 6 }).map((_, i) => (
              <LandingPropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 max-w-md">
            <p className="text-lg text-(--lp-ink)">
              Aucun bien disponible dans cette catégorie pour le moment.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
            {filtered.map((property, index) => (
              <LandingPropertyCard
                key={property.id}
                property={property}
                placeholderIndex={index}
                href={cardHref}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
