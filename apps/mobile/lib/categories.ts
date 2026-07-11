import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';

export type CategoryKey = 'house' | 'apartment' | 'land' | 'commercial';

export type CategoryMeta = {
  key: CategoryKey;
  label: string;
  plural: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const PROPERTY_CATEGORIES: CategoryMeta[] = [
  {
    key: 'house',
    label: 'Maison',
    plural: 'Maisons',
    description: 'Villas et maisons à Pointe-Noire',
    icon: 'home-outline',
  },
  {
    key: 'apartment',
    label: 'Appartement',
    plural: 'Appartements',
    description: 'Appartements en location ou à vendre',
    icon: 'business-outline',
  },
  {
    key: 'land',
    label: 'Terrain',
    plural: 'Terrains',
    description: 'Terrains constructibles et investissements',
    icon: 'map-outline',
  },
  {
    key: 'commercial',
    label: 'Commercial',
    plural: 'Commerciaux',
    description: 'Locaux et espaces professionnels',
    icon: 'storefront-outline',
  },
];

export function getCategoryMeta(key: string): CategoryMeta | undefined {
  return PROPERTY_CATEGORIES.find((item) => item.key === key);
}

export function filterByCategory(
  properties: Property[],
  key: CategoryKey | 'all',
): Property[] {
  if (key === 'all') return properties;
  return properties.filter((property) => property.category === key);
}
