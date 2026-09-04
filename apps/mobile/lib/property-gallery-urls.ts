import type { Property } from '@/types/property';

/** Ordered photo URLs from catalog property (no local fallback). */
export function getPropertyGalleryUrls(property: Property): string[] {
  const fromMedia = (property.mediaItems ?? [])
    .filter((m) => m.type === 'PHOTO' && Boolean(m.url))
    .map((m) => m.url);
  if (fromMedia.length > 0) return fromMedia;

  const urls: string[] = [];
  if (property.coverImage) urls.push(property.coverImage);
  for (const uri of property.images ?? []) {
    if (uri && !urls.includes(uri)) urls.push(uri);
  }
  return urls;
}
