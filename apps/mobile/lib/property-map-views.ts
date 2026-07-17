import type { PropertyMapView } from '@/types/property';

export function propertyMapViewPath(
  propertyId: string,
  view: PropertyMapView,
): string {
  if (view === 'neighborhood') return `/property/${propertyId}/neighborhood`;
  return `/property/${propertyId}/tour-360`;
}
