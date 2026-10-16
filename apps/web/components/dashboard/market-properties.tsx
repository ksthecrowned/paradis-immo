'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ApiError } from '@/lib/api';
import { DashIcon } from '@/components/dash-icon';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { listManagedProperties } from '@/lib/agent/portfolio';
import {
  formatCardPriceLabel,
  listMyProperties,
  propertyCardBadgeLabel,
  propertyCoverUrl,
  propertyLocationLabel,
  propertyStatusLabel,
  propertyStatusTone,
  type PublicProperty,
} from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';

const PLACEHOLDERS = [
  '/landing/house1.jpg',
  '/landing/house2.jpg',
  '/landing/house3.jpg',
  '/landing/house4.jpg',
] as const;

const LIMIT = 4;

async function loadOwnerProperties(): Promise<PublicProperty[]> {
  const all = await listMyProperties();
  const active = all.filter((p) => p.status === 'ACTIVE');
  const pool = active.length > 0 ? active : all;
  return pool.slice(0, LIMIT);
}

async function loadAgentProperties(): Promise<PublicProperty[]> {
  const all = await listManagedProperties();
  const active = all.filter((p) => p.status === 'ACTIVE');
  const pool = active.length > 0 ? active : all;
  return pool.slice(0, LIMIT);
}

type Amenity = { icon: string; label: string };

function amenitiesFor(property: PublicProperty): Amenity[] {
  const items: Amenity[] = [];
  if (property.bedrooms != null) {
    items.push({
      icon: 'solar:bed-linear',
      label: `${property.bedrooms} ch.`,
    });
  }
  if (property.bathrooms != null) {
    items.push({
      icon: 'solar:bath-linear',
      label: `${property.bathrooms} sdb`,
    });
  }
  if (property.surface != null) {
    items.push({
      icon: 'solar:maximize-square-linear',
      label: `${property.surface} m²`,
    });
  }
  return items;
}

function listingBadgeClass(property: PublicProperty): string {
  switch (property.listingStatus) {
    case 'UNDER_OFFER':
      return 'bg-warning text-on-warning';
    case 'SOLD':
    case 'OCCUPIED':
      return 'bg-muted text-on-accent';
    case 'AVAILABLE_SOON':
      return 'bg-accent text-on-accent';
    default:
      return 'bg-accent text-on-accent';
  }
}

function MarketPropertyCard({
  property,
  placeholderIndex,
  href,
}: {
  property: PublicProperty;
  placeholderIndex: number;
  href: string;
}): React.JSX.Element {
  const cover =
    propertyCoverUrl(property) ??
    PLACEHOLDERS[placeholderIndex % PLACEHOLDERS.length];
  const badge = propertyCardBadgeLabel(property);
  const price = formatCardPriceLabel(property);
  const amenities = amenitiesFor(property);
  const mutedListing =
    property.listingStatus === 'SOLD' ||
    property.listingStatus === 'OCCUPIED';

  return (
    <Link
      href={href}
      aria-label={`${property.title} — ${price}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-table transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-muted/15">
        <Image
          src={cover}
          alt={`Photo — ${property.title}`}
          fill
          className={`object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] ${
            mutedListing ? 'grayscale' : ''
          }`}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-black/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-26 bg-linear-to-b from-black/45 to-transparent"
          aria-hidden
        />
        <span
          className={`absolute inset-s-3 top-3 max-w-[65%] truncate rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm ${listingBadgeClass(property)}`}
        >
          {badge}
        </span>
        <span className="absolute inset-e-3 top-3">
          <StatusBadge
            label={propertyStatusLabel(property.status)}
            tone={propertyStatusTone(property.status)}
          />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
          <DashIcon
            icon="solar:map-point-bold"
            className="size-3.5 shrink-0 text-accent"
          />
          <span className="truncate">{propertyLocationLabel(property)}</span>
        </p>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-heading">
          {property.title}
        </h3>

        <p
          className={`text-lg font-bold tracking-tight ${
            mutedListing ? 'text-muted' : 'text-accent'
          }`}
        >
          {price}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {amenities.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted"
              >
                <DashIcon icon={item.icon} className="size-3 shrink-0" />
                {item.label}
              </span>
            ))}
          </div>
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          >
            <DashIcon
              icon="solar:arrow-right-up-linear"
              className="size-4"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

function MarketPropertySkeleton(): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-table">
      <div className="aspect-4/3 animate-pulse bg-muted/25" />
      <div className="space-y-2.5 p-4">
        <div className="h-3 w-2/5 animate-pulse rounded bg-muted/25" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted/25" />
        <div className="h-5 w-1/3 animate-pulse rounded bg-muted/25" />
        <div className="flex gap-1.5 pt-1">
          <div className="h-6 w-14 animate-pulse rounded-md bg-muted/25" />
          <div className="h-6 w-14 animate-pulse rounded-md bg-muted/25" />
        </div>
      </div>
    </div>
  );
}

export type DashboardMarketPropertiesProps = {
  role: 'owner' | 'agent';
};

/**
 * Full-width teaser of the signed-in user’s own properties (owner or agent portfolio).
 */
export function DashboardMarketProperties({
  role,
}: DashboardMarketPropertiesProps): React.JSX.Element {
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data =
          role === 'owner'
            ? await loadOwnerProperties()
            : await loadAgentProperties();
        if (!cancelled) {
          setProperties(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setProperties([]);
          setError(
            err instanceof ApiError
              ? err.message
              : 'Impossible de charger les biens.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const viewAllHref =
    role === 'owner' ? ROUTES.owner.properties : ROUTES.agent.portfolio;
  const cardHref = (id: string): string =>
    role === 'owner'
      ? ROUTES.owner.propertyEdit(id)
      : ROUTES.agent.portfolio;

  return (
    <section className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xl font-semibold tracking-tight text-heading">
            Propriétés actuellement sur le marché
          </p>
        </div>
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-heading"
        >
          Voir tous
          <DashIcon icon="solar:alt-arrow-right-linear" className="size-4" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: LIMIT }).map((_, i) => (
            <MarketPropertySkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-8 text-center text-sm text-danger">
          {error}
        </div>
      ) : properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-table px-4 py-10 text-center text-sm text-muted">
          Aucun bien pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {properties.map((property, index) => (
            <MarketPropertyCard
              key={property.id}
              property={property}
              placeholderIndex={index}
              href={cardHref(property.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
