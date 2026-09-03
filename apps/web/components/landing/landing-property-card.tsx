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
        className="block rounded-[20px] border border-(--lp-border) bg-(--lp-surface) p-2 transition-[opacity,transform] hover:opacity-[0.98] active:scale-[0.995]"
      >
        <div className="relative h-52.5 overflow-hidden rounded-2xl border border-(--lp-border)">
          <Image
            src={cover}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className={`object-cover ${grayscale ? 'grayscale' : ''}`}
          />
          <span
            className={`absolute inset-s-4 top-4 rounded-full px-4 py-1.5 text-sm font-bold text-white ${
              grayscale ? 'bg-[#6B7280]/opacity-75' : 'bg-(--lp-primary)'
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
          <div className="flex items-start justify-between gap-2">
            <p className="flex min-w-0 flex-1 items-center gap-1 text-[13px] font-medium text-(--lp-muted)">
              <DashIcon
                icon="solar:map-point-bold"
                className="size-3.5 shrink-0 text-(--lp-muted)"
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
                  className="inline-flex items-center gap-1 rounded-full border border-(--lp-border) bg-(--lp-bg) px-2.5 py-1.5 text-[11px] font-semibold text-(--lp-muted)"
                >
                  <DashIcon icon={item.icon} className="size-3" />
                  {item.label}
                </span>
              ))}
            </div>
            <span
              className={`-mt-5 flex size-12.5 shrink-0 items-center justify-center rounded-full ${
                grayscale
                  ? 'bg-[#6B7280] opacity-50'
                  : 'bg-(--lp-primary)'
              }`}
              aria-hidden
            >
              <DashIcon
                icon="solar:arrow-right-up-linear"
                className="size-6 text-white"
              />
            </span>
          </div>
          {property.mode === 'RENT_SHORT' ? (
            <div className="mt-3 border-t border-(--lp-border) pt-3">
              <p className="text-xs font-bold text-(--lp-ink)">
                Conditions
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-(--lp-muted)">
                <span>
                  Séjour min. {property.minNights ?? 1}{' '}
                  {property.minNights === 1 ? 'nuit' : 'nuits'}
                </span>
                {property.maxNights != null ? (
                  <span>max. {property.maxNights} nuits</span>
                ) : null}
                {property.checkInTime ? (
                  <span>Arrivée à partir de {property.checkInTime}</span>
                ) : null}
                {property.checkOutTime ? (
                  <span>Départ avant {property.checkOutTime}</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </a>

      {property.isFeatured ? (
        <div className="pointer-events-none absolute -inset-s-2.5 top-46.25 z-10">
          <div
            className={`flex items-center gap-1 rounded-lg rounded-bl-none px-4 py-1.5 ${
              grayscale ? 'bg-[#6B7280]' : 'bg-(--lp-primary)'
            }`}
          >
            <DashIcon
              icon="solar:star-fall-linear"
              className="size-3.5 text-white"
            />
            <span className="text-sm font-bold text-white">Coup de cœur</span>
          </div>
          <div
            className="h-0 w-0 border-l-2.5 border-t-2.5 border-l-transparent"
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
    <div className="rounded-[20px] border border-(--lp-border) bg-(--lp-surface) p-2">
      <div className="h-52.5 animate-pulse rounded-2xl bg-(--lp-border)" />
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
