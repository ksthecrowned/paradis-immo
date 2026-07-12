import type { PublicProperty } from '@/lib/properties';
import type {
  ListingStatus,
  Property,
  PropertyCategory,
  PropertyFeatureId,
  PropertyMapView,
  PropertyMode,
} from '@/types/property';

/** Fallback when API has no agent — keeps AgentRow string id stable. */
export const FALLBACK_AGENT_ID = 'api-agent-fallback';

const LISTING_STATUSES: ReadonlySet<string> = new Set([
  'AVAILABLE',
  'SOLD',
  'UNDER_OFFER',
  'OCCUPIED',
  'AVAILABLE_SOON',
]);

function formatPriceLabel(price: number, currency: string): string {
  const code = currency === 'XAF' || currency === 'FCFA' ? undefined : currency;
  if (!code) {
    return `${price.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(price);
}

function typeToCategory(type: string): PropertyCategory {
  if (type === 'APARTMENT') return 'apartment';
  if (type === 'LAND') return 'land';
  if (type === 'COMMERCIAL') return 'commercial';
  return 'house';
}

function mapListingStatus(value: string | undefined): ListingStatus {
  if (value && LISTING_STATUSES.has(value)) {
    return value as ListingStatus;
  }
  return 'AVAILABLE';
}

export function mapPublicProperty(api: PublicProperty): Property {
  const media = [...(api.media ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const cover = media[0]?.url ?? '';
  const city = api.quartier.arrondissement.city.name;
  const q = api.quartier.name;
  const org = api.organization ?? api.ownerOrg;
  const mapViews = (api.mapViews?.length
    ? api.mapViews
    : api.lat != null
      ? ['neighborhood']
      : []) as PropertyMapView[];

  return {
    id: api.id,
    title: api.title,
    description: api.description,
    price: formatPriceLabel(api.price, api.currency),
    priceAmount: api.price,
    coverImage: cover,
    images: media.slice(1).map((m) => m.url),
    location: `${q}, ${city}`,
    cityId: api.quartier.arrondissement.city.id,
    cityName: city,
    quartierId: api.quartier.id,
    quartierName: q,
    bedrooms: api.bedrooms ?? undefined,
    bathrooms: api.bathrooms ?? undefined,
    surface: api.surface != null ? `${api.surface} m²` : undefined,
    floor: api.floor ?? undefined,
    yearBuilt: api.yearBuilt ?? undefined,
    condition: api.condition ?? undefined,
    lotSize: api.lotSize != null ? `${api.lotSize} m²` : undefined,
    parkingSpaces: api.parkingSpaces ?? undefined,
    orientation: api.orientation ?? undefined,
    landTitle: api.landTitle ?? undefined,
    mode: api.mode as PropertyMode,
    category: typeToCategory(api.type),
    features: (api.features ?? []) as PropertyFeatureId[],
    mapViews,
    agencyId: org?.id ?? 'unknown-org',
    agencyName: org?.name,
    agentId: api.agent?.id ?? FALLBACK_AGENT_ID,
    agentName: api.agent?.name,
    agentPhone: api.agent?.phone ?? null,
    listingStatus: mapListingStatus(api.listingStatus),
    availableFrom: api.availableFrom ?? null,
    isFeatured: Boolean(api.isFeatured),
    visitEnabled: api.visitEnabled ?? false,
    visitType:
      api.visitType === 'FREE' || api.visitType === 'PAID'
        ? api.visitType
        : null,
    visitPrice: api.visitPrice ?? null,
    lat: api.lat ?? 0,
    lng: api.lng ?? 0,
  };
}
