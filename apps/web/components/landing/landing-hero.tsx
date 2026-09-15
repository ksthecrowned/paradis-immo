'use client';

import { useCallback, useEffect, useState } from 'react';
import { LandingPropertyCard } from '@/components/landing/landing-property-card';
import { DashIcon } from '@/components/dash-icon';
import { listActiveProperties } from '@/lib/public/properties';
import type { PublicProperty } from '@/lib/owner/properties';
import Link from 'next/link';

function isDiscoverable(property: PublicProperty): boolean {
  const status = property.listingStatus;
  return (
    status == null ||
    status === 'AVAILABLE' ||
    status === 'AVAILABLE_SOON'
  );
}

/**
 * Split hero — no full-bleed photo.
 * Desire-led copy + 2 visible live listings (window slider).
 */
export function LandingHero(): React.JSX.Element {
  const [items, setItems] = useState<PublicProperty[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void listActiveProperties(12)
      .then((data) => {
        if (cancelled) return;
        setItems(data.filter(isDiscoverable).slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = 2;
  const maxOffset = Math.max(0, items.length - visible);
  const go = useCallback(
    (dir: -1 | 1) => {
      setOffset((o) => Math.min(maxOffset, Math.max(0, o + dir)));
    },
    [maxOffset],
  );

  const slice = items.slice(offset, offset + visible);

  return (
    <section
      id="hero"
      className="relative isolate flex min-h-screen flex-col justify-center overflow-hidden bg-[#171c21] pt-24 pb-14 md:pt-28 md:pb-20"
      aria-labelledby="hero-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_15%,rgba(214,183,124,0.1),transparent_45%)]"
        aria-hidden
      />

      <div className="landing-container relative grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="max-w-xl">
          <p className="lp-reveal lp-display text-[1.45rem] tracking-tight text-(--lp-primary) sm:text-[1.75rem]">
            Paradis Immobilier
          </p>
          <h1
            id="hero-heading"
            className="lp-reveal lp-reveal-delay-1 mt-4 text-[2.35rem] leading-[1.08] text-(--lp-on-navy) sm:text-[3.1rem] md:text-[3.5rem]"
          >
            Votre prochain chez-vous,
            <br />
            sans le chaos.
          </h1>
          <p className="lp-reveal lp-reveal-delay-2 mt-5 max-w-md text-base leading-relaxed text-(--lp-cool) md:text-lg">
            Location, vente ou courte durée — des biens disponibles, maintenant.
          </p>

          <div className="lp-reveal lp-reveal-delay-3 mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="#properties" className="landing-btn landing-btn-primary">
              Voir les biens
            </a>
            <a href="#app" className="landing-btn landing-btn-ghost">
              Télécharger l&apos;app
            </a>
          </div>
          <p className="lp-reveal lp-reveal-delay-3 mt-4 text-[13px] text-white/45">
            Propriétaire ou agent ?{' '}
            <Link
              href="/login"
              className="font-semibold text-(--lp-primary) underline-offset-2 hover:underline"
            >
              Espace gestionnaire
            </Link>
          </p>
        </div>

        <div className="lp-reveal lp-reveal-delay-2 w-full">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="rounded-(--lp-radius-xl) border border-white/10 bg-white/5 p-2"
                >
                  <div className="h-52.5 animate-pulse rounded-(--lp-radius-lg) bg-white/10" />
                  <div className="space-y-3 px-2 pb-2 pt-4">
                    <div className="h-3 w-2/5 animate-pulse rounded bg-white/10" />
                    <div className="h-5 w-3/4 animate-pulse rounded bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : slice.length > 0 ? (
            <>
              <div
                className="grid gap-4 sm:grid-cols-2"
                style={
                  {
                    '--lp-surface': '#ffffff',
                    '--lp-ink': '#171c21',
                    '--lp-muted': '#8fa9b8',
                    '--lp-border': '#e5d9c4',
                    '--lp-bg': '#f1e6d0',
                    '--lp-primary': '#d6b77c',
                    '--lp-on-primary': '#171c21',
                  } as React.CSSProperties
                }
              >
                {slice.map((property, i) => (
                  <LandingPropertyCard
                    key={property.id}
                    property={property}
                    placeholderIndex={offset + i}
                    href="#app"
                  />
                ))}
                {slice.length === 1 ? <div className="hidden sm:block" /> : null}
              </div>
              {maxOffset > 0 ? (
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="landing-btn-icon border-white/20 text-(--lp-on-navy) disabled:opacity-30"
                    aria-label="Biens précédents"
                    disabled={offset === 0}
                    onClick={() => go(-1)}
                  >
                    <DashIcon
                      icon="solar:alt-arrow-left-linear"
                      className="size-5"
                    />
                  </button>
                  <button
                    type="button"
                    className="landing-btn-icon border-white/20 text-(--lp-on-navy) disabled:opacity-30"
                    aria-label="Biens suivants"
                    disabled={offset >= maxOffset}
                    onClick={() => go(1)}
                  >
                    <DashIcon
                      icon="solar:alt-arrow-right-linear"
                      className="size-5"
                    />
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex min-h-80 flex-col justify-center rounded-(--lp-radius-xl) border border-white/10 bg-white/5 px-6 py-10">
              <p className="text-lg text-(--lp-on-navy)">
                De nouveaux biens arrivent bientôt.
              </p>
              <a
                href="#properties"
                className="landing-btn landing-btn-primary mt-6 w-fit"
              >
                Explorer
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
