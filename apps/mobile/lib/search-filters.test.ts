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
    coverImage: '',
    mode: 'RENT_SHORT',
    lat: 0,
    lng: 0,
    agencyId: 'ag1',
    agentId: 'ag1-1',
    listingStatus: 'AVAILABLE',
  },
];

describe('agencyIds filter', () => {
  test('empty agencyIds keeps all', () => {
    expect(
      filterProperties(sample, { ...DEFAULT_SEARCH_FILTERS, agencyIds: [] }),
    ).toHaveLength(4);
  });

  test('filters to selected agencies', () => {
    const out = filterProperties(sample, {
      ...DEFAULT_SEARCH_FILTERS,
      agencyIds: ['ag1'],
    });
    expect(out.map((p) => p.id).sort()).toEqual(['a', 'c', 'd']);
  });

  test('countActiveFilters counts agency selection as 1', () => {
    expect(
      countActiveFilters({
        ...DEFAULT_SEARCH_FILTERS,
        agencyIds: ['ag1', 'ag2'],
      }),
    ).toBe(1);
  });

  test('round-trips agencies param', () => {
    const params = filtersToParams({
      ...DEFAULT_SEARCH_FILTERS,
      agencyIds: ['ag1', 'ag2'],
    });
    expect(params.agencies).toBe('ag1,ag2');
    expect(paramsToFilters(params).agencyIds).toEqual(['ag1', 'ag2']);
  });
});

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
