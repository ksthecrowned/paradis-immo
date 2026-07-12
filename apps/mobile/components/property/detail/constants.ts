import type { Property, PropertyMapView } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';

export const MAP_HEIGHT = 400;
/** Show footer CTAs once the user has scrolled past most of the map hero. */
export const CTA_SCROLL_THRESHOLD = MAP_HEIGHT * 0.4;
export const DESCRIPTION_PREVIEW_LINES = 4;

export const MAP_VIEW_META: Record<
  PropertyMapView,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    pinIcon: keyof typeof Ionicons.glyphMap;
  }
> = {
  neighborhood: {
    label: 'Voisinage',
    icon: 'map-outline',
    pinIcon: 'location-outline',
  },
  streetView: {
    label: 'Street View',
    icon: 'scan-outline',
    pinIcon: 'navigate-outline',
  },
  tour360: {
    label: 'Visite 360°',
    icon: 'globe-outline',
    pinIcon: 'eye-outline',
  },
};

export type PropertyAmenity = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

export function buildAmenities(property: Property): PropertyAmenity[] {
  const amenities: PropertyAmenity[] = [];
  if (property.floor) {
    amenities.push({ icon: 'business-outline', label: property.floor });
  }
  if (property.bedrooms != null) {
    amenities.push({
      icon: 'bed-outline',
      label: `${property.bedrooms} ch.`,
    });
  }
  if (property.bathrooms != null) {
    amenities.push({
      icon: 'water-outline',
      label: `${property.bathrooms} sdb`,
    });
  }
  if (property.surface) {
    amenities.push({ icon: 'resize-outline', label: property.surface });
  }
  return amenities.slice(0, 3);
}

export function blockedListingTitle(
  listingStatus: Property['listingStatus'],
): string {
  if (listingStatus === 'UNDER_OFFER') return 'Ce bien est sous offre';
  if (listingStatus === 'OCCUPIED') return 'Ce bien est actuellement occupé';
  if (listingStatus === 'SOLD') return 'Ce bien a été vendu';
  return 'Ce bien n’est plus disponible';
}
