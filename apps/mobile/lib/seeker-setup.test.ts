import { describe, expect, test } from 'bun:test';
import { DEFAULT_SEARCH_FILTERS } from '@/lib/search-filters';
import {
  seekerPrefsToSearchFilters,
  type SeekerPrefsLike,
} from '@/lib/seeker-setup';

describe('seekerPrefsToSearchFilters', () => {
  test('maps RENT intent and budget', () => {
    const prefs: SeekerPrefsLike = {
      seekerIntent: 'RENT',
      seekerExperience: 'FIRST_TIME',
      budgetMinXaf: 100_000,
      budgetMaxXaf: 250_000,
      preferredQuartierIds: [],
    };
    const f = seekerPrefsToSearchFilters(prefs);
    expect(f.mode).toBe('RENT_LONG');
    expect(f.minPrice).toBe(100_000);
    expect(f.maxPrice).toBe(250_000);
  });

  test('maps BUY to SALE', () => {
    const f = seekerPrefsToSearchFilters({
      seekerIntent: 'BUY',
      seekerExperience: null,
      budgetMinXaf: null,
      budgetMaxXaf: null,
      preferredQuartierIds: [],
    });
    expect(f.mode).toBe('SALE');
  });

  test('BOTH defaults to RENT_LONG', () => {
    const f = seekerPrefsToSearchFilters({
      seekerIntent: 'BOTH',
      seekerExperience: null,
      budgetMinXaf: null,
      budgetMaxXaf: null,
      preferredQuartierIds: [],
    });
    expect(f.mode).toBe('RENT_LONG');
  });

  test('seeds first preferred quartier when resolver provided', () => {
    const f = seekerPrefsToSearchFilters(
      {
        seekerIntent: 'RENT',
        seekerExperience: null,
        budgetMinXaf: null,
        budgetMaxXaf: null,
        preferredQuartierIds: ['q1', 'q2'],
      },
      DEFAULT_SEARCH_FILTERS,
      {
        resolveQuartier: (id) =>
          id === 'q1'
            ? {
                id: 'q1',
                name: 'Poto-Poto',
                cityId: 'c1',
                cityName: 'Brazzaville',
              }
            : null,
      },
    );
    expect(f.quartierId).toBe('q1');
    expect(f.quartierName).toBe('Poto-Poto');
    expect(f.cityId).toBe('c1');
  });
});
