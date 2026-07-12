import {
  DEFAULT_SEARCH_FILTERS,
  type SearchFilters,
} from '@/lib/search-filters';
import type { PropertyMode } from '@/types/property';

export type SeekerIntent = 'RENT' | 'BUY' | 'BOTH';
export type SeekerExperience = 'FIRST_TIME' | 'RETURNING' | 'PRO';

export type SeekerPrefsLike = {
  seekerIntent: SeekerIntent | null;
  seekerExperience: SeekerExperience | null;
  budgetMinXaf: number | null;
  budgetMaxXaf: number | null;
  preferredQuartierIds: string[];
};

export type SeekerSetupDraft = {
  intent: SeekerIntent | null;
  experience: SeekerExperience | null;
  budgetMinXaf: number | null;
  budgetMaxXaf: number | null;
  preferredQuartierIds: string[];
};

export type BudgetBand = {
  id: string;
  label: string;
  min: number;
  max: number | null;
};

export const BUDGET_BANDS_RENT: BudgetBand[] = [
  { id: 'r1', label: 'Moins de 100 000', min: 0, max: 100_000 },
  { id: 'r2', label: '100 000 – 250 000', min: 100_000, max: 250_000 },
  { id: 'r3', label: '250 000 – 500 000', min: 250_000, max: 500_000 },
  { id: 'r4', label: '500 000 et plus', min: 500_000, max: null },
];

export const BUDGET_BANDS_BUY: BudgetBand[] = [
  { id: 'b1', label: 'Moins de 30 M', min: 0, max: 30_000_000 },
  { id: 'b2', label: '30 M – 80 M', min: 30_000_000, max: 80_000_000 },
  { id: 'b3', label: '80 M – 150 M', min: 80_000_000, max: 150_000_000 },
  { id: 'b4', label: '150 M et plus', min: 150_000_000, max: null },
];

/** Seed quartier display names treated as “populaires” in Brazzaville. */
export const POPULAR_QUARTIER_NAMES = [
  'Poto-Poto-Centre',
  'Bacongo-Centre',
  'Moungali-Centre',
  'Ouenzé-Centre',
  'Makélékélé-Centre',
] as const;

export function budgetBandsForIntent(
  intent: SeekerIntent | null,
): BudgetBand[] {
  if (intent === 'BUY') return BUDGET_BANDS_BUY;
  return BUDGET_BANDS_RENT;
}

export function intentToMode(intent: SeekerIntent | null): PropertyMode {
  if (intent === 'BUY') return 'SALE';
  return 'RENT_LONG';
}

export type QuartierResolve = {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
};

export function seekerPrefsToSearchFilters(
  prefs: SeekerPrefsLike,
  base: SearchFilters = DEFAULT_SEARCH_FILTERS,
  opts?: {
    resolveQuartier?: (id: string) => QuartierResolve | null;
  },
): SearchFilters {
  const next: SearchFilters = {
    ...base,
    mode: prefs.seekerIntent
      ? intentToMode(prefs.seekerIntent)
      : base.mode,
    minPrice: prefs.budgetMinXaf ?? base.minPrice,
    maxPrice: prefs.budgetMaxXaf ?? base.maxPrice,
  };

  const firstId = prefs.preferredQuartierIds[0];
  if (firstId && opts?.resolveQuartier) {
    const q = opts.resolveQuartier(firstId);
    if (q) {
      next.quartierId = q.id;
      next.quartierName = q.name;
      next.cityId = q.cityId;
      next.cityName = q.cityName;
    }
  }
  return next;
}

export function emptySeekerDraft(): SeekerSetupDraft {
  return {
    intent: null,
    experience: null,
    budgetMinXaf: null,
    budgetMaxXaf: null,
    preferredQuartierIds: [],
  };
}

/** True when search URL has no filter/query keys (safe to seed from seeker prefs). */
export function paramsAreBareSearch(
  params: Record<string, string | string[] | undefined>,
): boolean {
  const keys = [
    'q',
    'mode',
    'city',
    'cityName',
    'quartier',
    'quartierName',
    'minPrice',
    'maxPrice',
    'bedrooms',
    'bathrooms',
    'categories',
    'features',
    'available',
    'maxAge',
    'minAge',
  ] as const;

  return keys.every((key) => {
    const value = params[key];
    if (value == null) return true;
    if (Array.isArray(value)) return value.every((item) => !String(item).trim());
    return !String(value).trim();
  });
}
