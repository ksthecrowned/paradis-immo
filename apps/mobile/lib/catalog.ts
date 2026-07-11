import { mapPublicProperty } from '@/lib/map-property';
import { sortMarketableFirst } from '@/lib/listing-status';
import {
  getProperty,
  listProperties,
  type PropertyFilters,
} from '@/lib/properties';
import type { Property } from '@/types/property';

export async function fetchCatalogProperties(
  filters: PropertyFilters = {},
): Promise<Property[]> {
  const rows = await listProperties(filters);
  return sortMarketableFirst(rows.map(mapPublicProperty));
}

export async function fetchCatalogProperty(id: string): Promise<Property> {
  const row = await getProperty(id);
  return mapPublicProperty(row);
}
