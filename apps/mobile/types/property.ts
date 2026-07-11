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

export type PropertyMapView = 'neighborhood' | 'streetView' | 'tour360';

export type PropertyAvailability = 'AVAILABLE' | 'UNAVAILABLE';

export type UnavailableReason = 'RENTED' | 'SOLD' | 'RESERVED';

export type Property = {
  id: string;
  title: string;
  description: string;
  /** Amount label without period suffix, e.g. "100 000 FCFA". */
  price: string;
  coverImage: string;
  images?: string[];
  location?: string;
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
  /** Marketplace availability (Dispo / Indispo). */
  availability: PropertyAvailability;
  /** Why the listing is unavailable; set when availability is UNAVAILABLE. */
  unavailableReason?: UnavailableReason;
  /** @deprecated Prefer `mode`. Kept for older call sites. */
  status?: 'sale' | 'rent';
  lat: number;
  lng: number;
};

const ALL_MAP_VIEWS: PropertyMapView[] = [
  'neighborhood',
  'streetView',
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

export function isPropertyAvailable(property: Property): boolean {
  return property.availability !== 'UNAVAILABLE';
}

export function unavailableReasonLabel(reason: UnavailableReason): string {
  if (reason === 'RENTED') return 'Loué';
  if (reason === 'SOLD') return 'Vendu';
  return 'Réservé';
}

/** Detail badge; null when the listing is available. */
export function propertyAvailabilityBadgeLabel(
  property: Property,
): string | null {
  if (isPropertyAvailable(property) || !property.unavailableReason) {
    return null;
  }
  return `Indispo · ${unavailableReasonLabel(property.unavailableReason)}`;
}
