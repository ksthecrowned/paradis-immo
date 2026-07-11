import { apiFetch } from '@/lib/api';

export type PropertyMode = 'RENT_LONG' | 'RENT_SHORT' | 'SALE';
export type PropertyType = 'APARTMENT' | 'HOUSE' | 'LAND' | 'COMMERCIAL';
export type PriceUnit = 'NIGHT' | 'WEEK' | 'MONTH' | 'TOTAL';
export type PropertyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type VisitType = 'FREE' | 'PAID';

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
