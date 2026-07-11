import type { PropertyMapView } from '@/types/property';

export function propertyMapViewPath(
  propertyId: string,
  view: PropertyMapView,
): string {
  if (view === 'neighborhood') return `/property/${propertyId}/neighborhood`;
  if (view === 'streetView') return `/property/${propertyId}/street-view`;
  return `/property/${propertyId}/tour-360`;
}
