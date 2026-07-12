import { apiFetch } from '@/lib/api';

export type PropertyMode = 'RENT_LONG' | 'RENT_SHORT' | 'SALE';
export type PropertyType = 'APARTMENT' | 'HOUSE' | 'LAND' | 'COMMERCIAL';
export type PriceUnit = 'NIGHT' | 'WEEK' | 'MONTH' | 'TOTAL';
export type PropertyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type VisitType = 'FREE' | 'PAID';

export type ListingStatus =
  | 'AVAILABLE'
  | 'SOLD'
  | 'UNDER_OFFER'
  | 'OCCUPIED'
  | 'AVAILABLE_SOON';

export interface PublicProperty {
  id: string;
  title: string;
  description: string;
  type: PropertyType;
  mode: PropertyMode;
  status: PropertyStatus;
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
  listingStatus?: ListingStatus;
  availableFrom?: string | null;
  isFeatured?: boolean;
  floor?: string | null;
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
  ownerOrg: { id: string; name: string; type: string };
  organization?: { id: string; name: string; type: string };
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePropertyInput {
  title: string;
  description: string;
  type: PropertyType;
  mode: PropertyMode;
  price: number;
  currency: string;
  priceUnit: PriceUnit;
  quartierId: string;
  address: string;
  countryId: string;
  lat?: number;
  lng?: number;
  bedrooms?: number;
  bathrooms?: number;
  surface?: number;
  visitEnabled?: boolean;
  visitType?: VisitType;
  visitPrice?: number;
  visitDuration?: number;
}

export async function listMyProperties(): Promise<PublicProperty[]> {
  const result = await apiFetch<{
    data: PublicProperty[];
    meta: { total: number; limit: number; offset: number };
  }>('/properties/mine?limit=100');
  return result.data ?? [];
}

export async function getProperty(id: string): Promise<PublicProperty> {
  return apiFetch<PublicProperty>(`/properties/${id}`);
}

export async function createProperty(
  body: CreatePropertyInput,
): Promise<PublicProperty> {
  return apiFetch<PublicProperty>('/properties', { method: 'POST', body });
}

export type UpdatePropertyInput = Partial<
  Omit<CreatePropertyInput, 'countryId' | 'quartierId'>
>;

export async function updateProperty(
  id: string,
  body: UpdatePropertyInput,
): Promise<PublicProperty> {
  return apiFetch<PublicProperty>(`/properties/${id}`, {
    method: 'PATCH',
    body,
  });
}

export async function archiveProperty(id: string): Promise<PublicProperty> {
  return apiFetch<PublicProperty>(`/properties/${id}/archive`, {
    method: 'POST',
  });
}

export async function publishProperty(id: string): Promise<PublicProperty> {
  return apiFetch<PublicProperty>(`/properties/${id}/publish`, {
    method: 'POST',
  });
}

export async function pauseProperty(id: string): Promise<PublicProperty> {
  return apiFetch<PublicProperty>(`/properties/${id}/pause`, {
    method: 'POST',
  });
}

export function defaultPriceUnit(mode: PropertyMode): PriceUnit {
  if (mode === 'RENT_LONG') return 'MONTH';
  if (mode === 'RENT_SHORT') return 'NIGHT';
  return 'TOTAL';
}

export function propertyModeLabel(mode: string): string {
  const map: Record<string, string> = {
    RENT_LONG: 'Location longue',
    RENT_SHORT: 'Location courte',
    SALE: 'Vente',
  };
  return map[mode] ?? mode;
}

/** Mobile card badge (mode) — shorter labels matching the app. */
export function propertyCardModeLabel(mode: string): string {
  const map: Record<string, string> = {
    RENT_LONG: 'Location',
    RENT_SHORT: 'Location journalière',
    SALE: 'Vente',
  };
  return map[mode] ?? mode;
}

/** Card badge: listing status when blocked / soon, else mode label. */
export function propertyCardBadgeLabel(property: PublicProperty): string {
  switch (property.listingStatus) {
    case 'UNDER_OFFER':
      return 'Sous offre';
    case 'OCCUPIED':
      return 'Occupé';
    case 'SOLD':
      return 'Vendu';
    case 'AVAILABLE_SOON':
      return 'Bientôt disponible';
    default:
      return propertyCardModeLabel(property.mode);
  }
}

export function formatCardPriceLabel(property: PublicProperty): string {
  const amount =
    property.currency === 'XAF' || property.currency === 'FCFA'
      ? `${property.price.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`
      : new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: property.currency,
          maximumFractionDigits: 0,
        }).format(property.price);
  if (property.mode === 'RENT_LONG') return `${amount} /mois`;
  if (property.mode === 'RENT_SHORT') return `${amount} /jour`;
  return amount;
}

export function propertyLocationLabel(property: PublicProperty): string {
  return `${property.quartier.name}, ${property.quartier.arrondissement.city.name}`;
}

export function propertyCoverUrl(property: PublicProperty): string | null {
  const media = [...(property.media ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  return media[0]?.url ?? null;
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

export function propertyStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Brouillon',
    ACTIVE: 'Actif',
    PAUSED: 'En pause',
    ARCHIVED: 'Archivé',
  };
  return map[status] ?? status;
}

export function propertyStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DRAFT') return 'warning';
  if (status === 'PAUSED') return 'neutral';
  if (status === 'ARCHIVED') return 'danger';
  return 'neutral';
}

export function formatPropertyPrice(
  price: number,
  currency: string,
  priceUnit: string,
): string {
  const unitLabels: Record<string, string> = {
    NIGHT: '/ nuit',
    WEEK: '/ semaine',
    MONTH: '/ mois',
    TOTAL: '',
  };
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
  return `${formatted}${unitLabels[priceUnit] ?? ''}`;
}
