import type { PropertyFeatureId } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';

export type PropertyFeatureMeta = {
  id: PropertyFeatureId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const PROPERTY_FEATURE_CATALOG: Record<
  PropertyFeatureId,
  PropertyFeatureMeta
> = {
  cuisine: {
    id: 'cuisine',
    label: 'Cuisine',
    icon: 'restaurant-outline',
  },
  debarras: {
    id: 'debarras',
    label: 'Débarras',
    icon: 'cube-outline',
  },
  climatisation: {
    id: 'climatisation',
    label: 'Climatisation',
    icon: 'snow-outline',
  },
  chauffe_eau: {
    id: 'chauffe_eau',
    label: 'Chauffe-eau',
    icon: 'thermometer-outline',
  },
  wifi: {
    id: 'wifi',
    label: 'Wifi',
    icon: 'wifi-outline',
  },
  piscine: {
    id: 'piscine',
    label: 'Piscine',
    icon: 'water-outline',
  },
  parking: {
    id: 'parking',
    label: 'Parking',
    icon: 'car-outline',
  },
  jardin: {
    id: 'jardin',
    label: 'Jardin',
    icon: 'leaf-outline',
  },
  securite: {
    id: 'securite',
    label: 'Sécurité',
    icon: 'shield-checkmark-outline',
  },
  groupe_electrogene: {
    id: 'groupe_electrogene',
    label: 'Groupe électrogène',
    icon: 'flash-outline',
  },
  meuble: {
    id: 'meuble',
    label: 'Meublé',
    icon: 'bed-outline',
  },
  balcon: {
    id: 'balcon',
    label: 'Balcon',
    icon: 'sunny-outline',
  },
  terrasse: {
    id: 'terrasse',
    label: 'Terrasse',
    icon: 'home-outline',
  },
  eau_courante: {
    id: 'eau_courante',
    label: 'Eau courante',
    icon: 'water-outline',
  },
};

export function resolvePropertyFeatures(
  ids: PropertyFeatureId[] | undefined,
): PropertyFeatureMeta[] {
  if (!ids?.length) return [];
  return ids
    .map((id) => PROPERTY_FEATURE_CATALOG[id])
    .filter(Boolean);
}
