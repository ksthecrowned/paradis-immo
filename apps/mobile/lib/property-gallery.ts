import { getPropertyGalleryUrls } from '@/lib/property-gallery-urls';
import type { Property } from '@/types/property';
import type { ImageSourcePropType } from 'react-native';

/**
 * Gallery sources for a catalog property (API URLs only — no local asset).
 */
export function getPropertyGallery(property: Property): ImageSourcePropType[] {
  return getPropertyGalleryUrls(property).map((uri) => ({ uri }));
}

/** Cover source, or `null` when the property has no media. */
export function getPropertyCoverSource(
  property: Property,
): ImageSourcePropType | null {
  return getPropertyGallery(property)[0] ?? null;
}
