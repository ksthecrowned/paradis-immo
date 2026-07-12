import { describe, expect, test } from 'bun:test';
import type { Property } from '@/types/property';
import {
  countActiveFilters,
  DEFAULT_SEARCH_FILTERS,
  filterProperties,
  filtersToParams,
  paramsToFilters,
} from './search-filters';

const sample: Property[] = [
  {
    id: 'a',
    title: 'A',
    description: '',
    price: '1',
    priceAmount: 1,
    coverImage: '',
    mode: 'SALE',
    lat: 0,
    lng: 0,
    agencyId: 'ag1',
    agentId: 'ag1-1',
    listingStatus: 'AVAILABLE',
  },
  {
    id: 'b',
    title: 'B',
    description: '',
    price: '1',
    priceAmount: 1,
    coverImage: '',
    mode: 'SALE',
    lat: 0,
    lng: 0,
    agencyId: 'ag2',
    agentId: 'ag2-1',
    listingStatus: 'SOLD',
  },
  {
    id: 'c',
    title: 'C',
    description: '',
    price: '1',
    priceAmount: 1,
    coverImage: '',
    mode: 'SALE',
    lat: 0,
    lng: 0,
    agencyId: 'ag1',
    agentId: 'ag1-1',
    listingStatus: 'UNDER_OFFER',
  },
  {
    id: 'd',
    title: 'D',
    description: '',
    price: '1',
    priceAmount: 1,
    coverImage: '',
    mode: 'RENT_SHORT',
    lat: 0,
    lng: 0,
    agencyId: 'ag1',
    agentId: 'ag1-1',
    listingStatus: 'AVAILABLE',
  },
];

describe('availableOnly filter', () => {
  test('keeps all when false', () => {
    expect(
      filterProperties(sample, {
        ...DEFAULT_SEARCH_FILTERS,
        availableOnly: false,
      }),
    ).toHaveLength(4);
  });

  test('excludes SOLD and UNDER_OFFER when true', () => {
    const out = filterProperties(sample, {
      ...DEFAULT_SEARCH_FILTERS,
      availableOnly: true,
    });
    expect(out.map((p) => p.id).sort()).toEqual(['a', 'd']);
  });

  test('round-trips available param', () => {
    const params = filtersToParams({
      ...DEFAULT_SEARCH_FILTERS,
      availableOnly: true,
    });
    expect(params.available).toBe('1');
    expect(paramsToFilters(params).availableOnly).toBe(true);
  });
});

describe('location and price filters', () => {
  const located: Property[] = [
    {
      id: 'p1',
      title: 'P1',
      description: '',
      price: '100 000 FCFA',
      priceAmount: 100_000,
      coverImage: '',
      mode: 'RENT_LONG',
      lat: 0,
      lng: 0,
      agencyId: 'ag1',
      agentId: 'a1',
      listingStatus: 'AVAILABLE',
      cityId: 'c-pn',
      cityName: 'Pointe-Noire',
      quartierId: 'q-lo',
      quartierName: 'Loandjili',
      bathrooms: 1,
      bedrooms: 2,
      category: 'house',
      yearBuilt: 2024,
    },
    {
      id: 'p2',
      title: 'P2',
      description: '',
      price: '50 000 000 FCFA',
      priceAmount: 50_000_000,
      coverImage: '',
      mode: 'SALE',
      lat: 0,
      lng: 0,
      agencyId: 'ag1',
      agentId: 'a1',
      listingStatus: 'AVAILABLE',
      cityId: 'c-bzv',
      cityName: 'Brazzaville',
      quartierId: 'q-cv',
      quartierName: 'Centre-ville',
      bathrooms: 2,
      bedrooms: 3,
      category: 'apartment',
      yearBuilt: 2010,
    },
  ];

  test('filters by cityId', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      cityId: 'c-pn',
      cityName: 'Pointe-Noire',
    });
    expect(out.map((p) => p.id)).toEqual(['p1']);
  });

  test('filters by quartierId', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      cityId: 'c-bzv',
      cityName: 'Brazzaville',
      quartierId: 'q-cv',
      quartierName: 'Centre-ville',
    });
    expect(out.map((p) => p.id)).toEqual(['p2']);
  });

  test('filters by price range', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      minPrice: 200_000,
      maxPrice: 60_000_000,
    });
    expect(out.map((p) => p.id)).toEqual(['p2']);
  });

  test('filters by minBathrooms', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      minBathrooms: 2,
    });
    expect(out.map((p) => p.id)).toEqual(['p2']);
  });

  test('filters by categories', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      categories: ['apartment'],
    });
    expect(out.map((p) => p.id)).toEqual(['p2']);
  });

  test('filters by maxAgeYears', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      maxAgeYears: 2,
    });
    expect(out.map((p) => p.id)).toEqual(['p1']);
  });

  test('filters by minAgeYears (plus de N ans)', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      minAgeYears: 7,
    });
    expect(out.map((p) => p.id)).toEqual(['p2']);
  });

  test('round-trips new params', () => {
    const params = filtersToParams({
      ...DEFAULT_SEARCH_FILTERS,
      cityId: 'c-pn',
      cityName: 'Pointe-Noire',
      quartierId: 'q-lo',
      quartierName: 'Loandjili',
      minPrice: 10_000,
      maxPrice: 500_000,
      minBathrooms: 1,
      categories: ['house', 'land'],
      maxAgeYears: 5,
    });
    const back = paramsToFilters(params);
    expect(back.cityId).toBe('c-pn');
    expect(back.quartierId).toBe('q-lo');
    expect(back.minPrice).toBe(10_000);
    expect(back.maxPrice).toBe(500_000);
    expect(back.minBathrooms).toBe(1);
    expect(back.categories).toEqual(['house', 'land']);
    expect(back.maxAgeYears).toBe(5);
  });

  test('countActiveFilters counts location price and age', () => {
    expect(
      countActiveFilters({
        ...DEFAULT_SEARCH_FILTERS,
        cityId: 'c1',
        cityName: 'X',
        minPrice: 0,
        maxPrice: 1000,
        maxAgeYears: 5,
      }),
    ).toBe(3);
  });
});
