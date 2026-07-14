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

export type PropertyFeatureId =
  | 'cuisine'
  | 'debarras'
  | 'climatisation'
  | 'chauffe_eau'
  | 'wifi'
  | 'piscine'
  | 'parking'
  | 'jardin'
  | 'securite'
  | 'groupe_electrogene'
  | 'meuble'
  | 'balcon'
  | 'terrasse'
  | 'eau_courante';

export type MapViewId = 'neighborhood' | 'streetView' | 'tour360';

export const PROPERTY_FEATURES: { id: PropertyFeatureId; label: string; icon: string }[] = [
  { id: 'cuisine', label: 'Cuisine équipée', icon: 'mdi:silverware-fork-knife' },
  { id: 'debarras', label: 'Débarras', icon: 'mdi:archive-outline' },
  { id: 'climatisation', label: 'Climatisation', icon: 'mdi:snowflake' },
  { id: 'chauffe_eau', label: 'Chauffe-eau', icon: 'mdi:water-boiler' },
  { id: 'wifi', label: 'Wi-Fi', icon: 'mdi:wifi' },
  { id: 'piscine', label: 'Piscine', icon: 'mdi:pool' },
  { id: 'parking', label: 'Parking', icon: 'mdi:parking' },
  { id: 'jardin', label: 'Jardin', icon: 'mdi:flower-outline' },
  { id: 'securite', label: 'Sécurité 24/7', icon: 'mdi:shield-check-outline' },
  { id: 'groupe_electrogene', label: 'Groupe électrogène', icon: 'mdi:generator-portable' },
  { id: 'meuble', label: 'Meublé', icon: 'mdi:sofa-outline' },
  { id: 'balcon', label: 'Balcon', icon: 'mdi:balcony' },
  { id: 'terrasse', label: 'Terrasse', icon: 'mdi:terrace' },
  { id: 'eau_courante', label: 'Eau courante', icon: 'mdi:water-pump' },
];

export const MAP_VIEWS: { id: MapViewId; label: string; icon: string }[] = [
  { id: 'neighborhood', label: 'Quartier', icon: 'mdi:map-search-outline' },
  { id: 'streetView', label: 'Street View', icon: 'mdi:google-street-view' },
  { id: 'tour360', label: 'Visite 360°', icon: 'mdi:rotate-3d-variant' },
];

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
  features?: PropertyFeatureId[];
  mapViews?: MapViewId[];
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
  // Building / lot
  floor?: string;
  yearBuilt?: number;
  condition?: string;
  lotSize?: number;
  parkingSpaces?: number;
  orientation?: string;
  landTitle?: string;
  // Equipment / views
  features?: PropertyFeatureId[];
  mapViews?: MapViewId[];
  // Marketplace listing
  listingStatus?: ListingStatus;
  availableFrom?: string | null;
  isFeatured?: boolean;
  // Visit configuration
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
  Omit<
    CreatePropertyInput,
    | 'countryId'
    | 'quartierId'
    | 'floor'
    | 'yearBuilt'
    | 'condition'
    | 'lotSize'
    | 'parkingSpaces'
    | 'orientation'
    | 'landTitle'
    | 'availableFrom'
  >
> & {
  // Nullable to support clearing fields on update.
  floor?: string | null;
  yearBuilt?: number | null;
  condition?: string | null;
  lotSize?: number | null;
  parkingSpaces?: number | null;
  orientation?: string | null;
  landTitle?: string | null;
  availableFrom?: string | null;
};

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

export function listingStatusLabel(status: string | undefined | null): string {
  const map: Record<string, string> = {
    AVAILABLE: 'Disponible',
    SOLD: 'Vendu',
    UNDER_OFFER: 'Sous offre',
    OCCUPIED: 'Occupé',
    AVAILABLE_SOON: 'Bientôt disponible',
  };
  return map[status ?? ''] ?? status ?? '—';
}

export function listingStatusTone(
  status: string | undefined | null,
): 'success' | 'warning' | 'danger' | 'neutral' | 'accent' {
  switch (status) {
    case 'AVAILABLE':
      return 'success';
    case 'AVAILABLE_SOON':
      return 'accent';
    case 'UNDER_OFFER':
      return 'warning';
    case 'OCCUPIED':
      return 'warning';
    case 'SOLD':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function featureLabel(id: string): string {
  return (
    PROPERTY_FEATURES.find((f) => f.id === id)?.label ??
    MAP_VIEWS.find((v) => v.id === id)?.label ??
    id
  );
}

export function featureIcon(id: string): string {
  return (
    PROPERTY_FEATURES.find((f) => f.id === id)?.icon ??
    MAP_VIEWS.find((v) => v.id === id)?.icon ??
    'mdi:checkbox-blank-circle-outline'
  );
}

export function propertyConditionLabel(value: string | null | undefined): string {
  if (!value) return '—';
  // The API keeps this as a free string — show as-is, trimmed.
  return value;
}
