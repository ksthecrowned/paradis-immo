'use client';

import { DashIcon } from '@/components/dash-icon';
import {
  formatCardPriceLabel,
  propertyCardBadgeLabel,
  propertyCoverUrl,
  propertyLocationLabel,
  type PublicProperty,
} from '@/lib/owner/properties';

const PLACEHOLDERS = [
  '/landing/house1.jpg',
  '/landing/house2.jpg',
  '/landing/house3.jpg',
  '/landing/house4.jpg',
  '/landing/house5.jpg',
  '/landing/house6.jpg',
] as const;

type Amenity = {
  icon: string;
  label: string;
};

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

function isGrayscale(property: PublicProperty): boolean {
  const status = property.listingStatus;
  return (
    status === 'SOLD' || status === 'UNDER_OFFER' || status === 'OCCUPIED'
  );
}

export interface LandingPropertyCardProps {
  property: PublicProperty;
  /** Fallback image index when API has no media. */
  placeholderIndex?: number;
  href?: string;
}

export function LandingPropertyCard({
  property,
  placeholderIndex = 0,
  href = '#download',
}: LandingPropertyCardProps): React.JSX.Element {
  const grayscale = isGrayscale(property);
  const cover =
    propertyCoverUrl(property) ??
    PLACEHOLDERS[placeholderIndex % PLACEHOLDERS.length];
  const muted = grayscale ? '#6B7280' : undefined;
  const amenities = amenitiesFor(property);
  const priceLabel = formatCardPriceLabel(property);
  const badge = propertyCardBadgeLabel(property);

  return (
    <div className="relative">
      <a
        href={href}
        className="block rounded-[20px] border border-[var(--lp-border)] bg-[var(--lp-surface)] p-2 transition-[opacity,transform] hover:opacity-[0.98] active:scale-[0.995]"
      >
        <div className="relative overflow-hidden rounded-2xl border border-[var(--lp-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt=""
            className={`h-[210px] w-full object-cover ${grayscale ? 'grayscale' : ''}`}
          />
          <span
            className={`absolute start-4 top-4 rounded-full px-4 py-1.5 text-sm font-bold text-white ${
              grayscale ? 'bg-[#6B7280]/opacity-75' : 'bg-[var(--lp-primary)]'
            }`}
          >
            {badge}
          </span>
          <span
            className="absolute end-4 top-4 flex size-10 items-center justify-center rounded-full border border-[var(--lp-border)] bg-[var(--lp-surface)] shadow-md"
            aria-hidden
          >
            <DashIcon
              icon="solar:heart-linear"
              className={`size-5 ${grayscale ? 'text-[#6B7280]' : 'text-[var(--lp-ink)]'}`}
            />
          </span>
        </div>

        <div className="flex flex-col gap-2 px-2 pb-2 pt-4">
          <div className="flex items-start justify-between gap-2">
            <p className="flex min-w-0 flex-1 items-center gap-1 text-[13px] font-medium text-[var(--lp-muted)]">
              <DashIcon
                icon="solar:map-point-bold"
                className="size-3.5 shrink-0 text-[var(--lp-muted)]"
              />
              <span className="truncate">
                {propertyLocationLabel(property)}
              </span>
            </p>
            <p
              className="shrink-0 text-xl font-extrabold tracking-tight"
              style={{ color: muted ?? 'var(--lp-primary)' }}
            >
              {priceLabel}
            </p>
          </div>

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
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--lp-border)] bg-[var(--lp-bg)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--lp-muted)]"
                >
                  <DashIcon icon={item.icon} className="size-3" />
                  {item.label}
                </span>
              ))}
            </div>
            <span
              className={`-mt-5 flex size-[50px] shrink-0 items-center justify-center rounded-full ${
                grayscale
                  ? 'bg-[#6B7280] opacity-50'
                  : 'bg-[var(--lp-primary)]'
              }`}
              aria-hidden
            >
              <DashIcon
                icon="solar:arrow-right-up-linear"
                className="size-6 text-white"
              />
            </span>
          </div>
        </div>
      </a>

      {property.isFeatured ? (
        <div className="pointer-events-none absolute -start-2.5 top-[185px] z-10">
          <div
            className={`flex items-center gap-1 rounded-lg rounded-bl-none px-4 py-1.5 ${
              grayscale ? 'bg-[#6B7280]' : 'bg-[var(--lp-primary)]'
            }`}
          >
            <DashIcon
              icon="solar:star-fall-linear"
              className="size-3.5 text-white"
            />
            <span className="text-sm font-bold text-white">Coup de cœur</span>
          </div>
          <div
            className="h-0 w-0 border-l-[10px] border-t-[10px] border-l-transparent"
            style={{
              borderTopColor: grayscale ? '#4B5563' : '#4338CA',
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function LandingPropertyCardSkeleton(): React.JSX.Element {
  return (
    <div className="rounded-[20px] border border-[var(--lp-border)] bg-[var(--lp-surface)] p-2">
      <div className="h-[210px] animate-pulse rounded-2xl bg-[var(--lp-border)]" />
      <div className="space-y-3 px-2 pb-2 pt-4">
        <div className="h-3 w-2/5 animate-pulse rounded bg-[var(--lp-border)]" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--lp-border)]" />
        <div className="flex gap-2">
          <div className="h-7 w-16 animate-pulse rounded-full bg-[var(--lp-border)]" />
          <div className="h-7 w-16 animate-pulse rounded-full bg-[var(--lp-border)]" />
        </div>
      </div>
    </div>
  );
}
