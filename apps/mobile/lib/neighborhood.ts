import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';

export type NeighborhoodPlaceKind =
  | 'school'
  | 'church'
  | 'bakery'
  | 'market'
  | 'hospital'
  | 'pharmacy'
  | 'transport'
  | 'supermarket';

export type NeighborhoodPlace = {
  id: string;
  kind: NeighborhoodPlaceKind;
  name: string;
  /** Walking distance in meters. */
  distanceMeters: number;
  /** Estimated walk time in minutes. */
  walkMinutes: number;
  lat: number;
  lng: number;
};

export type NeighborhoodPlaceMeta = {
  kind: NeighborhoodPlaceKind;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const NEIGHBORHOOD_KIND_META: Record<
  NeighborhoodPlaceKind,
  NeighborhoodPlaceMeta
> = {
  school: { kind: 'school', label: 'École', icon: 'school-outline' },
  church: { kind: 'church', label: 'Église', icon: 'flag-outline' },
  bakery: { kind: 'bakery', label: 'Boulangerie', icon: 'cafe-outline' },
  market: { kind: 'market', label: 'Marché', icon: 'basket-outline' },
  hospital: { kind: 'hospital', label: 'Hôpital', icon: 'medkit-outline' },
  pharmacy: { kind: 'pharmacy', label: 'Pharmacie', icon: 'medical-outline' },
  transport: {
    kind: 'transport',
    label: 'Transport',
    icon: 'bus-outline',
  },
  supermarket: {
    kind: 'supermarket',
    label: 'Supermarché',
    icon: 'cart-outline',
  },
};

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatWalkTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min à pied`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} h à pied`;
  return `${hours} h ${rest} min à pied`;
}

type PlaceSeed = {
  kind: NeighborhoodPlaceKind;
  name: string;
  distanceMeters: number;
  walkMinutes: number;
  dLat: number;
  dLng: number;
};

const SEEDS_BY_PROPERTY: Record<string, PlaceSeed[]> = {
  '1': [
    {
      kind: 'school',
      name: 'École primaire Loandjili',
      distanceMeters: 450,
      walkMinutes: 6,
      dLat: 0.0021,
      dLng: -0.0014,
    },
    {
      kind: 'church',
      name: 'Paroisse Saint-Joseph',
      distanceMeters: 700,
      walkMinutes: 9,
      dLat: -0.0018,
      dLng: 0.0022,
    },
    {
      kind: 'bakery',
      name: 'Boulangerie du Port',
      distanceMeters: 320,
      walkMinutes: 4,
      dLat: 0.0012,
      dLng: 0.0011,
    },
    {
      kind: 'market',
      name: 'Marché de Loandjili',
      distanceMeters: 1100,
      walkMinutes: 14,
      dLat: 0.0035,
      dLng: 0.0028,
    },
    {
      kind: 'pharmacy',
      name: 'Pharmacie Centrale',
      distanceMeters: 580,
      walkMinutes: 7,
      dLat: -0.0024,
      dLng: -0.0011,
    },
    {
      kind: 'transport',
      name: 'Arrêt taxi-brousse',
      distanceMeters: 250,
      walkMinutes: 3,
      dLat: 0.0008,
      dLng: -0.002,
    },
  ],
  '2': [
    {
      kind: 'supermarket',
      name: 'Score Centre-ville',
      distanceMeters: 280,
      walkMinutes: 4,
      dLat: 0.001,
      dLng: 0.0009,
    },
    {
      kind: 'bakery',
      name: 'Pâtisserie Atlantique',
      distanceMeters: 190,
      walkMinutes: 3,
      dLat: -0.0007,
      dLng: 0.0012,
    },
    {
      kind: 'school',
      name: 'Lycée Victor Augagneur',
      distanceMeters: 850,
      walkMinutes: 11,
      dLat: 0.0028,
      dLng: -0.0016,
    },
    {
      kind: 'church',
      name: 'Cathédrale Saint-Pierre',
      distanceMeters: 1200,
      walkMinutes: 15,
      dLat: -0.003,
      dLng: 0.0024,
    },
    {
      kind: 'hospital',
      name: 'Hôpital Adolphe Sicé',
      distanceMeters: 1600,
      walkMinutes: 20,
      dLat: 0.0042,
      dLng: 0.0018,
    },
    {
      kind: 'transport',
      name: 'Gare routière',
      distanceMeters: 900,
      walkMinutes: 12,
      dLat: -0.0022,
      dLng: -0.0025,
    },
  ],
  '3': [
    {
      kind: 'market',
      name: 'Marché Tié-Tié',
      distanceMeters: 400,
      walkMinutes: 5,
      dLat: 0.0015,
      dLng: 0.0013,
    },
    {
      kind: 'school',
      name: 'École Tié-Tié',
      distanceMeters: 550,
      walkMinutes: 7,
      dLat: -0.0019,
      dLng: 0.0017,
    },
    {
      kind: 'bakery',
      name: 'Pain du Matin',
      distanceMeters: 300,
      walkMinutes: 4,
      dLat: 0.0011,
      dLng: -0.001,
    },
    {
      kind: 'church',
      name: 'Église Évangélique',
      distanceMeters: 650,
      walkMinutes: 8,
      dLat: -0.0021,
      dLng: -0.0015,
    },
    {
      kind: 'pharmacy',
      name: 'Pharmacie Tié-Tié',
      distanceMeters: 480,
      walkMinutes: 6,
      dLat: 0.002,
      dLng: 0.0008,
    },
  ],
  '4': [
    {
      kind: 'school',
      name: 'École Mongo-Poukou',
      distanceMeters: 900,
      walkMinutes: 12,
      dLat: 0.0026,
      dLng: 0.002,
    },
    {
      kind: 'market',
      name: 'Petit marché local',
      distanceMeters: 1300,
      walkMinutes: 16,
      dLat: -0.0032,
      dLng: 0.0014,
    },
    {
      kind: 'transport',
      name: 'Axe principal',
      distanceMeters: 600,
      walkMinutes: 8,
      dLat: 0.0014,
      dLng: -0.0022,
    },
    {
      kind: 'church',
      name: 'Chapelle du quartier',
      distanceMeters: 1100,
      walkMinutes: 14,
      dLat: -0.0025,
      dLng: -0.0018,
    },
  ],
};

const DEFAULT_SEEDS = SEEDS_BY_PROPERTY['1']!;

export function getNeighborhoodPlaces(
  property: Property,
): NeighborhoodPlace[] {
  const seeds = SEEDS_BY_PROPERTY[property.id] ?? DEFAULT_SEEDS;
  return seeds.map((seed, index) => ({
    id: `${property.id}-n${index}`,
    kind: seed.kind,
    name: seed.name,
    distanceMeters: seed.distanceMeters,
    walkMinutes: seed.walkMinutes,
    lat: property.lat + seed.dLat,
    lng: property.lng + seed.dLng,
  }));
}

export type PropertyDetailRow = {
  key: string;
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/** Structured facts shown in the “Détails” section. */
export function buildPropertyDetailRows(
  property: Property,
): PropertyDetailRow[] {
  const rows: PropertyDetailRow[] = [];

  if (property.yearBuilt != null) {
    rows.push({
      key: 'yearBuilt',
      label: 'Année de construction',
      value: String(property.yearBuilt),
      icon: 'calendar-outline',
    });
  }
  if (property.condition) {
    rows.push({
      key: 'condition',
      label: 'État général',
      value: property.condition,
      icon: 'checkmark-circle-outline',
    });
  }
  if (property.surface) {
    rows.push({
      key: 'surface',
      label: 'Surface',
      value: property.surface,
      icon: 'resize-outline',
    });
  }
  if (property.lotSize) {
    rows.push({
      key: 'lotSize',
      label: 'Terrain',
      value: property.lotSize,
      icon: 'map-outline',
    });
  }
  if (property.floor) {
    rows.push({
      key: 'floor',
      label: 'Niveau',
      value: property.floor,
      icon: 'business-outline',
    });
  }
  if (property.bedrooms != null) {
    rows.push({
      key: 'bedrooms',
      label: 'Chambres',
      value: String(property.bedrooms),
      icon: 'bed-outline',
    });
  }
  if (property.bathrooms != null) {
    rows.push({
      key: 'bathrooms',
      label: 'Salles de bain',
      value: String(property.bathrooms),
      icon: 'water-outline',
    });
  }
  if (property.parkingSpaces != null) {
    rows.push({
      key: 'parking',
      label: 'Places de parking',
      value: String(property.parkingSpaces),
      icon: 'car-outline',
    });
  }
  if (property.orientation) {
    rows.push({
      key: 'orientation',
      label: 'Orientation',
      value: property.orientation,
      icon: 'compass-outline',
    });
  }
  if (property.landTitle) {
    rows.push({
      key: 'landTitle',
      label: 'Titre / statut',
      value: property.landTitle,
      icon: 'document-text-outline',
    });
  }

  return rows;
}
