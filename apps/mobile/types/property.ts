export type PropertyMode = 'SALE' | 'RENT_LONG' | 'RENT_SHORT';

export type PropertyCategory = 'house' | 'apartment' | 'land' | 'commercial';

/** Catalog keys for property equipment / amenities. */
export type PropertyFeatureId =
  | 'cuisine'
  | 'debarras'
  | 'climatisation'
  | 'chauffe_eau'
  | 'wifi'
  | 'piscine'
  | 'parking'
  | 'jardin'
  | 'securite'
  | 'groupe_electrogene'
  | 'meuble'
  | 'balcon'
  | 'terrasse'
  | 'eau_courante';

export type PropertyMapView = 'neighborhood' | 'tour360';

export type ListingStatus =
  | 'AVAILABLE'
  | 'SOLD'
  | 'UNDER_OFFER'
  | 'OCCUPIED'
  | 'AVAILABLE_SOON';

export type PropertyMediaKind = 'PHOTO' | 'VIDEO';

export type PropertyMediaItem = {
  id?: string;
  url: string;
  type: PropertyMediaKind;
};

export type Property = {
  id: string;
  title: string;
  description: string;
  /** Amount label without period suffix, e.g. "100 000 FCFA". */
  price: string;
  /** Numeric FCFA amount from API (for range filters). */
  priceAmount: number;
  coverImage: string;
  images?: string[];
  /** Typed media list for gallery (photos + videos). */
  mediaItems?: PropertyMediaItem[];
  location?: string;
  cityId?: string;
  cityName?: string;
  quartierId?: string;
  quartierName?: string;
  bedrooms?: number;
  bathrooms?: number;
  surface?: string;
  floor?: string;
  /** Year the building was constructed. */
  yearBuilt?: number;
  /** e.g. "Bon état", "À rénover". */
  condition?: string;
  /** Outdoor / plot surface when different from living surface. */
  lotSize?: string;
  parkingSpaces?: number;
  orientation?: string;
  /** Land / ownership status (Congo context). */
  landTitle?: string;
  mode: PropertyMode;
  category?: PropertyCategory;
  /** Equipment present on the property. */
  features?: PropertyFeatureId[];
  /**
   * Immersive map / media views available for this listing.
   * `neighborhood` is implied when coordinates exist.
   */
  mapViews?: PropertyMapView[];
  /** Managing agency (Organization). */
  agencyId: string;
  /** Display name from API organization when available. */
  agencyName?: string;
  /** Referring agent (OrganizationMember). */
  agentId: string;
  /** Display name / phone from API agent when mock agent is absent. */
  agentName?: string;
  agentPhone?: string | null;
  /** Mode-aware marketplace listing status. */
  listingStatus: ListingStatus;
  /** ISO date when AVAILABLE_SOON. */
  availableFrom?: string | null;
  /** Featured / Coup de cœur ribbon. */
  isFeatured?: boolean;
  visitEnabled?: boolean;
  visitType?: 'FREE' | 'PAID' | null;
  visitPrice?: number | null;
  /** @deprecated Prefer `mode`. Kept for older call sites. */
  status?: 'sale' | 'rent';
  lat: number;
  lng: number;
};

const ALL_MAP_VIEWS: PropertyMapView[] = [
  'neighborhood',
  'tour360',
];

/** Resolve available map chrome variants for a property. */
export function resolvePropertyMapViews(
  property: Property,
): PropertyMapView[] {
  const configured = property.mapViews?.filter((view) =>
    ALL_MAP_VIEWS.includes(view),
  );
  if (configured && configured.length > 0) return configured;
  // Coordinates always unlock the neighborhood map.
  return ['neighborhood'];
}

export function propertyStatusLabel(property: Property): string {
  if (property.mode === 'RENT_SHORT') return 'Location journalière';
  if (property.mode === 'RENT_LONG') return 'Location';
  if (property.mode === 'SALE' || property.status === 'sale') return 'Vente';
  if (property.status === 'rent') return 'Location';
  return 'Bien';
}

/** Price with period: /mois (longue durée), /jour (journalière). */
export function propertyPriceLabel(property: Property): string {
  if (property.mode === 'RENT_LONG') return `${property.price} /mois`;
  if (property.mode === 'RENT_SHORT') return `${property.price} /jour`;
  return property.price;
}

export {
  isConversionBlocked,
  isGrayscaleCard,
  isPropertyAvailable,
  listingStatusLabel,
  listingStatusLabel as propertyAvailabilityBadgeLabel,
  passesAvailableOnlyFilter,
} from '@/lib/listing-status';
