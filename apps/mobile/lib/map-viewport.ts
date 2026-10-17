import type { PropertyFilters } from '@/lib/properties';

export type MapViewport = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function viewportToPropertyFilters(
  region: MapViewport,
  cityName?: string,
): Pick<
  PropertyFilters,
  'cityName' | 'minLat' | 'maxLat' | 'minLng' | 'maxLng'
> {
  const latitudeHalf = Math.max(region.latitudeDelta / 2, 0.002);
  const longitudeHalf = Math.max(region.longitudeDelta / 2, 0.002);
  return {
    minLat: roundCoordinate(Math.max(-90, region.latitude - latitudeHalf)),
    maxLat: roundCoordinate(Math.min(90, region.latitude + latitudeHalf)),
    minLng: roundCoordinate(Math.max(-180, region.longitude - longitudeHalf)),
    maxLng: roundCoordinate(Math.min(180, region.longitude + longitudeHalf)),
    ...(cityName ? { cityName } : {}),
  };
}
