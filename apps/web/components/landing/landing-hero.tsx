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
 * Hero inspired by SG dual CTAs + live inventory (no full-bleed photo).
 * Left: promise + paths. Right: auto-advancing property slider.
 */
export function LandingHero(): React.JSX.Element {
  const [items, setItems] = useState<PublicProperty[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);

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

  const count = items.length;
  const go = useCallback(
    (dir: -1 | 1) => {
      if (count === 0) return;
      setIndex((i) => (i + dir + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (paused || count < 2) return;
    const id = window.setInterval(() => go(1), 4500);
    return () => window.clearInterval(id);
  }, [paused, count, go]);

  const current = items[index];

  return (
    <section
      id="hero"
      className="relative isolate flex min-h-screen flex-col justify-center overflow-hidden bg-[#171c21] pt-24 pb-12 md:pt-28 md:pb-16"
      aria-labelledby="hero-heading"
    >
      {/* Soft brand atmosphere — no photo background */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(214,183,124,0.12),transparent_50%)]"
        aria-hidden
      />

      <div className="landing-container relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
        {/* Copy — SG-style dual path */}
        <div className="max-w-xl">
          <p className="lp-reveal lp-display text-[1.45rem] tracking-tight text-(--lp-primary) sm:text-[1.75rem]">
            Paradis Immobilier
          </p>
          <h1
            id="hero-heading"
            className="lp-reveal lp-reveal-delay-1 mt-4 text-[2.25rem] leading-[1.08] text-(--lp-on-navy) sm:text-[3rem] md:text-[3.4rem]"
          >
            Trouvez un bien.
            <br />
            Ou confiez votre patrimoine.
          </h1>
          <p className="lp-reveal lp-reveal-delay-2 mt-5 max-w-md text-base leading-relaxed text-(--lp-muted) md:text-lg">
            Des annonces à découvrir ici. Visites et suivi dans l&apos;application.
            Gestion locative et opérationnelle en ligne.
          </p>

          <div className="lp-reveal lp-reveal-delay-3 mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="#properties" className="landing-btn landing-btn-primary">
              Trouver un bien
            </a>
            <Link href="/login" className="landing-btn landing-btn-ghost">
              Confier mon patrimoine
            </Link>
          </div>
        </div>

        {/* Property slider */}
        <div
          className="lp-reveal lp-reveal-delay-2 relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div className="relative min-h-[420px]">
            {loading ? (
              <div className="rounded-[var(--lp-radius-xl)] border border-white/10 bg-white/5 p-2">
                <div className="h-52.5 animate-pulse rounded-[var(--lp-radius-lg)] bg-white/10" />
                <div className="space-y-3 px-2 pb-2 pt-4">
                  <div className="h-3 w-2/5 animate-pulse rounded bg-white/10" />
                  <div className="h-5 w-3/4 animate-pulse rounded bg-white/10" />
                </div>
              </div>
            ) : current ? (
              <div
                key={current.id}
                className="animate-[lp-rise_0.5s_ease]"
                style={
                  {
                    /* Cards always read light/premium on the dark hero */
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
                <LandingPropertyCard
                  property={current}
                  placeholderIndex={index}
                  href="#app"
                />
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-start justify-center rounded-[var(--lp-radius-xl)] border border-white/10 bg-white/5 px-6 py-10">
                <p className="text-lg text-(--lp-on-navy)">
                  De nouveaux biens arrivent bientôt.
                </p>
                <a
                  href="#properties"
                  className="landing-btn landing-btn-primary mt-6"
                >
                  Voir la sélection
                </a>
              </div>
            )}
          </div>

          {count > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="flex gap-2" role="tablist" aria-label="Biens">
                {items.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Bien ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index
                        ? 'w-7 bg-(--lp-primary)'
                        : 'w-1.5 bg-white/25 hover:bg-white/45'
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="landing-btn-icon border-white/20 text-(--lp-on-navy)"
                  aria-label="Bien précédent"
                  onClick={() => go(-1)}
                >
                  <DashIcon icon="solar:alt-arrow-left-linear" className="size-5" />
                </button>
                <button
                  type="button"
                  className="landing-btn-icon border-white/20 text-(--lp-on-navy)"
                  aria-label="Bien suivant"
                  onClick={() => go(1)}
                >
                  <DashIcon icon="solar:alt-arrow-right-linear" className="size-5" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
