'use client';

import { DashIcon } from '@/components/dash-icon';
import {
  formatCardPriceLabel,
  propertyCardBadgeLabel,
  propertyCoverUrl,
  propertyLocationLabel,
  type PublicProperty,
} from '@/lib/owner/properties';
import Image from 'next/image';

const PLACEHOLDERS = [
  '/landing/hero-house.png',
  '/landing/welcome-bg.png',
] as const;

const MUTED = '#6B7280';

function isGrayscale(property: PublicProperty): boolean {
  const status = property.listingStatus;
  return (
    status === 'SOLD' || status === 'UNDER_OFFER' || status === 'OCCUPIED'
  );
}

type Amenity = { icon: string; label: string };

function amenitiesFor(property: PublicProperty): Amenity[] {
  const items: Amenity[] = [];
  if (property.floor) {
    items.push({ icon: 'solar:buildings-2-linear', label: property.floor });
  }
  if (property.surface != null) {
    items.push({
      icon: 'solar:maximize-square-linear',
      label: `${property.surface} m²`,
    });
  }
  if (property.bedrooms != null) {
    items.push({
      icon: 'solar:bed-linear',
      label: `${property.bedrooms} ch.`,
    });
  }
  return items;
}

export interface LandingPropertyCardProps {
  property: PublicProperty;
  placeholderIndex?: number;
  /** Omit when there is no honest destination (no public fiche / no store). */
  href?: string;
}

/**
 * Mobile-aligned card. Heart is decorative on web (favorites live in the app).
 */
export function LandingPropertyCard({
  property,
  placeholderIndex = 0,
  href,
}: LandingPropertyCardProps): React.JSX.Element {
  const grayscale = isGrayscale(property);
  const cover =
    propertyCoverUrl(property) ??
    PLACEHOLDERS[placeholderIndex % PLACEHOLDERS.length];
  const priceLabel = formatCardPriceLabel(property);
  const badge = propertyCardBadgeLabel(property);
  const amenities = amenitiesFor(property);
  const muted = grayscale ? MUTED : undefined;

  const body = (
    <>
      <div className="relative h-52.5 overflow-hidden rounded-(--lp-radius-lg) border border-(--lp-border) bg-(--lp-primary-muted)">
        <Image
          src={cover}
          alt={`Photo — ${property.title}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={`object-cover ${grayscale ? 'grayscale' : ''}`}
        />
        <span
          className={`absolute inset-s-4 top-4 max-w-[70%] truncate rounded-full px-4 py-1.5 text-sm font-bold ${
            grayscale
              ? 'bg-[#6B7280]/75 text-[#FEFEFE]'
              : 'bg-(--lp-primary) text-(--lp-on-primary)'
          }`}
        >
          {badge}
        </span>
        <span
          className="absolute inset-e-4 top-4 flex size-10 items-center justify-center rounded-full border border-(--lp-border) bg-(--lp-surface) shadow-md"
          aria-hidden
        >
          <DashIcon
            icon="solar:heart-linear"
            className={`size-5 ${grayscale ? 'text-[#6B7280]' : 'text-(--lp-ink)'}`}
          />
        </span>
      </div>

      <div className="flex flex-col gap-2 px-2 pb-2 pt-4">
        <p className="flex min-w-0 items-center gap-1 text-[13px] font-medium text-(--lp-muted)">
          <DashIcon
            icon="solar:map-point-bold"
            className="size-3.5 shrink-0 text-(--lp-muted)"
          />
          <span className="truncate">{propertyLocationLabel(property)}</span>
        </p>
        <p
          className="text-xl font-extrabold tracking-tight"
          style={{ color: muted ?? 'var(--lp-primary)' }}
        >
          {priceLabel}
        </p>
        <h3
          className="truncate text-lg font-bold tracking-tight"
          style={{ color: muted ?? 'var(--lp-ink)' }}
        >
          {property.title}
        </h3>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {amenities.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1 rounded-full border border-(--lp-border) bg-(--lp-primary-muted) px-2.5 py-1.5 text-[11px] font-semibold text-(--lp-muted)"
              >
                <DashIcon icon={item.icon} className="size-3" />
                {item.label}
              </span>
            ))}
          </div>
          <span
            className={`-mt-5 flex size-12.5 shrink-0 items-center justify-center rounded-full ${
              grayscale ? 'bg-[#6B7280] opacity-50' : 'bg-(--lp-primary)'
            }`}
            aria-hidden
          >
            <DashIcon
              icon="solar:arrow-right-up-linear"
              className="size-6 text-(--lp-on-primary)"
            />
          </span>
        </div>

        {property.mode === 'RENT_SHORT' ? (
          <div className="mt-3 border-t border-(--lp-border) pt-3">
            <p className="text-xs font-bold text-(--lp-ink)">Conditions</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-(--lp-muted)">
              <span>
                Séjour min. {property.minNights ?? 1}{' '}
                {property.minNights === 1 ? 'nuit' : 'nuits'}
              </span>
              {property.maxNights != null ? (
                <span>max. {property.maxNights} nuits</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <article className="relative">
      {href ? (
        <a
          href={href}
          className="block rounded-(--lp-radius-xl) border border-(--lp-border) bg-(--lp-surface) p-2 transition-[opacity,transform] hover:opacity-[0.98] active:scale-[0.995] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--lp-primary)"
          aria-label={`${property.title} — ${priceLabel}`}
        >
          {body}
        </a>
      ) : (
        <div className="rounded-(--lp-radius-xl) border border-(--lp-border) bg-(--lp-surface) p-2">
          {body}
        </div>
      )}

      {property.isFeatured ? (
        <div className="pointer-events-none absolute -inset-s-2.5 top-46.25 z-10">
          <div
            className={`flex items-center gap-1 rounded-lg rounded-bl-none px-4 py-1.5 ${
              grayscale ? 'bg-[#6B7280]' : 'bg-(--lp-primary)'
            }`}
          >
            <DashIcon
              icon="solar:star-fall-linear"
              className={`size-3.5 ${grayscale ? 'text-[#FEFEFE]' : 'text-(--lp-on-primary)'}`}
            />
            <span
              className={`text-sm font-bold ${grayscale ? 'text-[#FEFEFE]' : 'text-(--lp-on-primary)'}`}
            >
              Coup de cœur
            </span>
          </div>
          <div
            className="h-0 w-0 border-s-10 border-t-10 border-s-transparent"
            style={{
              borderTopColor: grayscale ? '#4B5563' : '#C4A56A',
            }}
          />
        </div>
      ) : null}
    </article>
  );
}

export function LandingPropertyCardSkeleton(): React.JSX.Element {
  return (
    <div className="rounded-(--lp-radius-xl) border border-(--lp-border) bg-(--lp-surface) p-2">
      <div className="h-52.5 animate-pulse rounded-(--lp-radius-lg) bg-(--lp-border)" />
      <div className="space-y-3 px-2 pb-2 pt-4">
        <div className="h-3 w-2/5 animate-pulse rounded bg-(--lp-border)" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-(--lp-border)" />
        <div className="flex gap-2">
          <div className="h-7 w-16 animate-pulse rounded-full bg-(--lp-border)" />
          <div className="h-7 w-16 animate-pulse rounded-full bg-(--lp-border)" />
        </div>
      </div>
    </div>
  );
}
