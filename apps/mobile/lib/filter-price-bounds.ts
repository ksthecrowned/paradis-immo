import type { PropertyMode } from '@/types/property';

export type PriceBounds = {
  min: number;
  max: number;
  step: number;
};

const BOUNDS: Record<PropertyMode, PriceBounds> = {
  SALE: { min: 0, max: 200_000_000, step: 1_000_000 },
  RENT_LONG: { min: 0, max: 2_000_000, step: 5_000 },
  RENT_SHORT: { min: 0, max: 200_000, step: 5_000 },
};

export function priceBoundsForMode(
  mode: PropertyMode,
): PriceBounds {
  return BOUNDS[mode];
}

export function formatFilterPrice(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}
