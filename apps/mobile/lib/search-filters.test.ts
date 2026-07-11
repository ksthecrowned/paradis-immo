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
  },
];

describe('agencyIds filter', () => {
  test('empty agencyIds keeps all', () => {
    expect(
      filterProperties(sample, { ...DEFAULT_SEARCH_FILTERS, agencyIds: [] }),
    ).toHaveLength(2);
  });

  test('filters to selected agencies', () => {
    const out = filterProperties(sample, {
      ...DEFAULT_SEARCH_FILTERS,
      agencyIds: ['ag1'],
    });
    expect(out.map((p) => p.id)).toEqual(['a']);
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
