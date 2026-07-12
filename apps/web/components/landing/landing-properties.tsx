'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashIcon } from '@/components/dash-icon';
import {
  LandingPropertyCard,
  LandingPropertyCardSkeleton,
} from '@/components/landing/landing-property-card';
import { listActiveProperties } from '@/lib/public/properties';
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

export function LandingProperties(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState(0);
  const [query, setQuery] = useState('');
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);

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
          propertyLocationLabel(p).toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [activeTab, properties, query]);

  return (
    <section id="properties" className="bg-[var(--lp-surface)] py-16 md:py-24">
      <div className="landing-container">
        <h2 className="text-center text-[32px] font-bold text-[var(--lp-ink)] md:text-[48px]">
          Biens disponibles
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-[15px] text-[var(--lp-muted)]">
          Même catalogue que l&apos;app — ouvrez un bien pour télécharger
          Paradis Immo.
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
                    ? 'border border-[var(--lp-border)] bg-[var(--lp-surface)] text-[var(--lp-primary)] shadow-sm'
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
          <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <LandingPropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="mt-10 text-center text-sm text-[var(--lp-muted)]">
            Aucun bien pour cette catégorie pour le moment.
          </p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((property, index) => (
              <LandingPropertyCard
                key={property.id}
                property={property}
                placeholderIndex={index}
                href="#download"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
