import { apiFetch } from '@/lib/api';
import type { ListingStatus } from '@/types/property';

export type PropertyMode = 'RENT_LONG' | 'RENT_SHORT' | 'SALE';
export type PropertyType = 'APARTMENT' | 'HOUSE' | 'LAND' | 'COMMERCIAL';
export type PriceUnit = 'NIGHT' | 'WEEK' | 'MONTH' | 'TOTAL';
export type VisitType = 'FREE' | 'PAID';

export interface PublicProperty {
  id: string;
  title: string;
  description: string;
  type: PropertyType;
  mode: PropertyMode;
  status: string;
  price: number;
  currency: string;
  priceUnit: PriceUnit;
  address: string;
  lat: number | null;
  lng: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  surface: number | null;
  visitEnabled: boolean;
  visitType: VisitType | null;
  visitPrice: number | null;
  visitDuration: number | null;
  depositMonths?: number | null;
  agencyFeeAmount?: number | null;
  favoriteCount?: number;
  features?: string[];
  listingStatus?: ListingStatus;
  availableFrom?: string | null;
  isFeatured?: boolean;
  floor?: string | null;
  yearBuilt?: number | null;
  condition?: string | null;
  lotSize?: number | null;
  parkingSpaces?: number | null;
  orientation?: string | null;
  landTitle?: string | null;
  mapViews?: string[];
  media?: Array<{ id: string; url: string; type: string; position: number }>;
  quartier: {
    id: string;
    name: string;
    arrondissement: {
      id: string;
      name: string;
      city: { id: string; name: string };
    };
  };
  organization?: { id: string; name: string; type: string };
  ownerOrg?: { id: string; name: string; type: string };
  agent?: { id: string; name: string; phone: string | null } | null;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyFilters {
  cityId?: string;
  arrondissementId?: string;
  quartierId?: string;
  mode?: PropertyMode;
  minPrice?: number;
  maxPrice?: number;
  status?: string;
  limit?: number;
  organizationId?: string;
}

export async function listProperties(
  filters: PropertyFilters = {},
): Promise<PublicProperty[]> {
  const params = new URLSearchParams();
  params.set('status', filters.status ?? 'ACTIVE');
  params.set('limit', String(filters.limit ?? 50));
  if (filters.cityId) params.set('cityId', filters.cityId);
  if (filters.arrondissementId) params.set('arrondissementId', filters.arrondissementId);
  if (filters.quartierId) params.set('quartierId', filters.quartierId);
  if (filters.mode) params.set('mode', filters.mode);
  if (filters.minPrice != null) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice != null) params.set('maxPrice', String(filters.maxPrice));
  if (filters.organizationId) params.set('organizationId', filters.organizationId);

  const result = await apiFetch<{ data: PublicProperty[]; meta?: unknown }>(
    `/properties?${params}`,
    { anonymous: true },
  );
  if (Array.isArray(result)) return result;
  return result.data ?? [];
}

export async function getProperty(id: string): Promise<PublicProperty> {
  return apiFetch<PublicProperty>(`/properties/${id}`, { anonymous: true });
}

export function propertyModeLabel(mode: string): string {
  const map: Record<string, string> = {
    RENT_LONG: 'Location',
    RENT_SHORT: 'Courte durée',
    SALE: 'Vente',
  };
  return map[mode] ?? mode;
}

export function propertyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    APARTMENT: 'Appartement',
    HOUSE: 'Maison',
    LAND: 'Terrain',
    COMMERCIAL: 'Commercial',
  };
  return map[type] ?? type;
}

const PRICE_UNIT_LABELS: Record<string, string> = {
  NIGHT: '/ nuit',
  WEEK: '/ sem.',
  MONTH: '/ mois',
  TOTAL: '',
};

export function splitPropertyPrice(
  price: number,
  currency: string,
  priceUnit: string,
): { amount: string; suffix: string } {
  const amount = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
  return {
    amount,
    suffix: PRICE_UNIT_LABELS[priceUnit] ?? '',
  };
}

export function formatPropertyPrice(
  price: number,
  currency: string,
  priceUnit: string,
): string {
  const { amount, suffix } = splitPropertyPrice(price, currency, priceUnit);
  return `${amount}${suffix}`;
}

export function locationLabel(property: PublicProperty): string {
  return `${property.quartier.name}, ${property.quartier.arrondissement.city.name}`;
}
