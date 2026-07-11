import { apiFetch } from '@/lib/api';

export interface MediaItem {
  id: string;
  type: string;
  url: string;
  position: number;
}

export async function listMedia(propertyId: string): Promise<MediaItem[]> {
  return apiFetch<MediaItem[]>(`/properties/${propertyId}/media`, {
    anonymous: true,
  });
}
