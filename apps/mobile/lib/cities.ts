/** Congo marketplace city hubs used on Home → Discover map. */

export type MarketplaceCity = {
  id: string;
  name: string;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
};

export const MARKETPLACE_CITIES: MarketplaceCity[] = [
  {
    id: 'pointe-noire',
    name: 'Pointe-Noire',
    region: {
      latitude: -4.7761,
      longitude: 11.8635,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    },
  },
  {
    id: 'brazzaville',
    name: 'Brazzaville',
    region: {
      latitude: -4.2634,
      longitude: 15.2429,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    },
  },
];

export function getCityByName(name: string): MarketplaceCity | undefined {
  const needle = name.trim().toLowerCase();
  return MARKETPLACE_CITIES.find((c) => c.name.toLowerCase() === needle);
}

export function propertyMatchesCity(
  location: string | undefined,
  cityName: string,
): boolean {
  if (!location) return false;
  return location.toLowerCase().includes(cityName.trim().toLowerCase());
}
