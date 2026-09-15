'use client';

import { useEffect, useState } from 'react';
import { listActiveProperties } from '@/lib/public/properties';
import {
  propertyLocationLabel,
  type PublicProperty,
} from '@/lib/owner/properties';

function isDiscoverable(property: PublicProperty): boolean {
  const status = property.listingStatus;
  return (
    status == null ||
    status === 'AVAILABLE' ||
    status === 'AVAILABLE_SOON'
  );
}

/**
 * Preuve réelle uniquement — compte et villes issus du catalogue actif.
 * La section reste silencieuse si aucune donnée n'est disponible.
 */
export function LandingProof(): React.JSX.Element | null {
  const [count, setCount] = useState<number | null>(null);
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listActiveProperties(48)
      .then((data) => {
        if (cancelled) return;
        const available = data.filter(isDiscoverable);
        setCount(available.length);
        const citySet = new Set<string>();
        for (const p of available) {
          try {
            const label = propertyLocationLabel(p);
            const city = label.split(',').pop()?.trim();
            if (city) citySet.add(city);
          } catch {
            /* ignore malformed */
          }
        }
        setCities([...citySet].slice(0, 4));
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count == null || count === 0) return null;

  return (
    <section
      id="proof"
      className="border-y border-(--lp-border) bg-(--lp-surface) py-14 md:py-16"
      aria-label="Paradis Immobilier en chiffres"
    >
      <div className="landing-container flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="lp-eyebrow">En ce moment</p>
          <p className="mt-3 lp-display text-[2.5rem] leading-none text-(--lp-ink) md:text-[3.25rem]">
            {count}
            <span className="ms-3 text-[1.15rem] font-normal text-(--lp-muted) md:text-xl">
              {count > 1 ? 'biens disponibles' : 'bien disponible'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-[15px] text-(--lp-muted)">
          <p>
            <span className="text-(--lp-ink)">Congo</span> — zone d&apos;activité
          </p>
          {cities.length > 0 ? (
            <p>
              <span className="text-(--lp-ink)">{cities.join(' · ')}</span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
