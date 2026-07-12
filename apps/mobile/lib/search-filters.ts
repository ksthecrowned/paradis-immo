import {
  passesAvailableOnlyFilter,
  type Property,
  type PropertyCategory,
  type PropertyFeatureId,
  type PropertyMode,
} from '@/types/property';

export type SearchFilters = {
  q: string;
  mode: PropertyMode | 'ALL';
  cityId: string | null;
  cityName: string | null;
  quartierId: string | null;
  quartierName: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  minBedrooms: number | null;
  minBathrooms: number | null;
  categories: PropertyCategory[];
  features: PropertyFeatureId[];
  agencyIds: string[];
  availableOnly: boolean;
  maxAgeYears: number | null;
  minAgeYears: number | null;
};

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  q: '',
  mode: 'ALL',
  cityId: null,
  cityName: null,
  quartierId: null,
  quartierName: null,
  minPrice: null,
  maxPrice: null,
  minBedrooms: null,
  minBathrooms: null,
  categories: [],
  features: [],
  agencyIds: [],
  availableOnly: false,
  maxAgeYears: null,
  minAgeYears: null,
};

export function countActiveFilters(filters: SearchFilters): number {
  let count = 0;
  if (filters.mode !== 'ALL') count += 1;
  if (filters.cityId) count += 1;
  if (filters.quartierId) count += 1;
  if (filters.minPrice != null || filters.maxPrice != null) count += 1;
  if (filters.minBedrooms != null) count += 1;
  if (filters.minBathrooms != null) count += 1;
  if (filters.categories.length > 0) count += 1;
  count += filters.features.length;
  if (filters.agencyIds.length > 0) count += 1;
  if (filters.availableOnly) count += 1;
  if (filters.maxAgeYears != null || filters.minAgeYears != null) count += 1;
  return count;
}

export function filterProperties(
  properties: Property[],
  filters: SearchFilters,
): Property[] {
  const query = filters.q.trim().toLowerCase();
  const yearNow = new Date().getFullYear();

  return properties.filter((property) => {
    if (filters.mode !== 'ALL' && property.mode !== filters.mode) {
      return false;
    }

    if (filters.cityId && property.cityId !== filters.cityId) {
      return false;
    }

    if (filters.quartierId && property.quartierId !== filters.quartierId) {
      return false;
    }

    if (filters.minPrice != null && property.priceAmount < filters.minPrice) {
      return false;
    }

    if (filters.maxPrice != null && property.priceAmount > filters.maxPrice) {
      return false;
    }

    if (
      filters.minBedrooms != null &&
      (property.bedrooms == null || property.bedrooms < filters.minBedrooms)
    ) {
      return false;
    }

    if (
      filters.minBathrooms != null &&
      (property.bathrooms == null || property.bathrooms < filters.minBathrooms)
    ) {
      return false;
    }

    if (
      filters.categories.length > 0 &&
      (property.category == null ||
        !filters.categories.includes(property.category))
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

    if (filters.availableOnly && !passesAvailableOnlyFilter(property)) {
      return false;
    }

    if (filters.maxAgeYears != null || filters.minAgeYears != null) {
      if (property.yearBuilt == null) return false;
      const age = yearNow - property.yearBuilt;
      if (filters.maxAgeYears != null && age > filters.maxAgeYears) {
        return false;
      }
      if (filters.minAgeYears != null && age < filters.minAgeYears) {
        return false;
      }
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
  if (filters.cityId) params.city = filters.cityId;
  if (filters.cityName) params.cityName = filters.cityName;
  if (filters.quartierId) params.quartier = filters.quartierId;
  if (filters.quartierName) params.quartierName = filters.quartierName;
  if (filters.minPrice != null) params.minPrice = String(filters.minPrice);
  if (filters.maxPrice != null) params.maxPrice = String(filters.maxPrice);
  if (filters.minBedrooms != null) {
    params.bedrooms = String(filters.minBedrooms);
  }
  if (filters.minBathrooms != null) {
    params.bathrooms = String(filters.minBathrooms);
  }
  if (filters.categories.length > 0) {
    params.categories = filters.categories.join(',');
  }
  if (filters.features.length > 0) {
    params.features = filters.features.join(',');
  }
  if (filters.agencyIds.length > 0) {
    params.agencies = filters.agencyIds.join(',');
  }
  if (filters.availableOnly) params.available = '1';
  if (filters.maxAgeYears != null) params.maxAge = String(filters.maxAgeYears);
  if (filters.minAgeYears != null) params.minAge = String(filters.minAgeYears);
  return params;
}

const CATEGORIES: ReadonlySet<string> = new Set([
  'house',
  'apartment',
  'land',
  'commercial',
]);

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

  const parsePositiveInt = (value: string): number | null => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const parseNonNegInt = (value: string): number | null => {
    if (!value) return null;
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const features = raw('features')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as PropertyFeatureId[];

  const agencyIds = raw('agencies')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const categories = raw('categories')
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is PropertyCategory => CATEGORIES.has(item));

  const cityId = raw('city') || null;
  const cityName = raw('cityName') || null;
  const quartierId = raw('quartier') || null;
  const quartierName = raw('quartierName') || null;

  return {
    q: raw('q'),
    mode,
    cityId,
    cityName,
    quartierId,
    quartierName,
    minPrice: parseNonNegInt(raw('minPrice')),
    maxPrice: parseNonNegInt(raw('maxPrice')),
    minBedrooms: parsePositiveInt(raw('bedrooms')),
    minBathrooms: parsePositiveInt(raw('bathrooms')),
    categories,
    features,
    agencyIds,
    availableOnly: raw('available') === '1',
    maxAgeYears: parsePositiveInt(raw('maxAge')),
    minAgeYears: parsePositiveInt(raw('minAge')),
  };
}
