import { mapPublicProperty } from '@/lib/map-property';
import { sortMarketableFirst } from '@/lib/listing-status';
import {
  getProperty,
  listProperties,
  listPropertiesPage,
  type PropertyFilters,
} from '@/lib/properties';
import type { Property } from '@/types/property';

export async function fetchCatalogProperties(
  filters: PropertyFilters = {},
): Promise<Property[]> {
  const rows = await listProperties(filters);
  return sortMarketableFirst(rows.map(mapPublicProperty));
}

export async function fetchCatalogPropertiesPage(
  filters: PropertyFilters = {},
): Promise<{ data: Property[]; total: number; unmapped?: number }> {
  const page = await listPropertiesPage(filters);
  return {
    data: sortMarketableFirst(page.data.map(mapPublicProperty)),
    total: page.meta.total,
    unmapped: page.meta.unmapped,
  };
}

export async function fetchCatalogProperty(id: string): Promise<Property> {
  const row = await getProperty(id);
  return mapPublicProperty(row);
}
