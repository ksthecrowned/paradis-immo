'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { DashIcon } from '@/components/dash-icon';
import { listManagedProperties } from '@/lib/agent/portfolio';
import {
  formatCardPriceLabel,
  listMyProperties,
  propertyCardBadgeLabel,
  propertyCoverUrl,
  propertyLocationLabel,
  propertyStatusLabel,
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

  return (
    <Link
      href={href}
      className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-opacity hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-accent"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-muted/20">
        <Image
          src={cover}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
        />
        {badge ? (
          <span className="absolute start-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground">
            {badge}
          </span>
        ) : null}
        <span className="absolute end-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-xs text-muted">
          {propertyStatusLabel(property.status)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs text-muted">
          {propertyLocationLabel(property)}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
          {property.title}
        </h3>
        <p className="mt-auto pt-2 text-base font-bold text-accent">{price}</p>
        {(property.bedrooms != null || property.surface != null) && (
          <p className="text-xs text-muted">
            {[
              property.bedrooms != null
                ? `${property.bedrooms} ch.`
                : null,
              property.surface != null ? `${property.surface} m²` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
    </Link>
  );
}

function MarketPropertySkeleton(): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="aspect-4/3 animate-pulse bg-muted/30" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-2/5 animate-pulse rounded bg-muted/30" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted/30" />
        <div className="h-5 w-1/3 animate-pulse rounded bg-muted/30" />
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data =
          role === 'owner'
            ? await loadOwnerProperties()
            : await loadAgentProperties();
        if (!cancelled) setProperties(data);
      } catch {
        if (!cancelled) setProperties([]);
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
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Propiétés actullement sur le marché</h2>
        </div>
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
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
      ) : properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted">
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
