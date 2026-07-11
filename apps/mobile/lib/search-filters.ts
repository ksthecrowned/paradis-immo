import type { Property, PropertyFeatureId, PropertyMode } from '@/types/property';

export type SearchFilters = {
  q: string;
  mode: PropertyMode | 'ALL';
  minBedrooms: number | null;
  features: PropertyFeatureId[];
  agencyIds: string[];
};

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  q: '',
  mode: 'ALL',
  minBedrooms: null,
  features: [],
  agencyIds: [],
};

export function countActiveFilters(filters: SearchFilters): number {
  let count = 0;
  if (filters.mode !== 'ALL') count += 1;
  if (filters.minBedrooms != null) count += 1;
  count += filters.features.length;
  if (filters.agencyIds.length > 0) count += 1;
  return count;
}

export function filterProperties(
  properties: Property[],
  filters: SearchFilters,
): Property[] {
  const query = filters.q.trim().toLowerCase();

  return properties.filter((property) => {
    if (filters.mode !== 'ALL' && property.mode !== filters.mode) {
      return false;
    }

    if (
      filters.minBedrooms != null &&
      (property.bedrooms == null || property.bedrooms < filters.minBedrooms)
    ) {
      return false;
    }

    if (filters.features.length > 0) {
      const owned = new Set(property.features ?? []);
      if (!filters.features.every((id) => owned.has(id))) {
        return false;
      }
    }

    if (
      filters.agencyIds.length > 0 &&
      !filters.agencyIds.includes(property.agencyId)
    ) {
      return false;
    }

    if (!query) return true;

    const haystack = [
      property.title,
      property.location ?? '',
      property.description,
      property.price,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function filtersToParams(filters: SearchFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q.trim()) params.q = filters.q.trim();
  if (filters.mode !== 'ALL') params.mode = filters.mode;
  if (filters.minBedrooms != null) {
    params.bedrooms = String(filters.minBedrooms);
  }
  if (filters.features.length > 0) {
    params.features = filters.features.join(',');
  }
  if (filters.agencyIds.length > 0) {
    params.agencies = filters.agencyIds.join(',');
  }
  return params;
}

export function paramsToFilters(
  params: Record<string, string | string[] | undefined>,
): SearchFilters {
  const raw = (key: string): string => {
    const value = params[key];
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
  };

  const modeRaw = raw('mode');
  const mode: SearchFilters['mode'] =
    modeRaw === 'SALE' || modeRaw === 'RENT_LONG' || modeRaw === 'RENT_SHORT'
      ? modeRaw
      : 'ALL';

  const bedroomsRaw = Number.parseInt(raw('bedrooms'), 10);
  const minBedrooms = Number.isFinite(bedroomsRaw) && bedroomsRaw > 0
    ? bedroomsRaw
    : null;

  const features = raw('features')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as PropertyFeatureId[];

  const agencyIds = raw('agencies')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    q: raw('q'),
    mode,
    minBedrooms,
    features,
    agencyIds,
  };
}
