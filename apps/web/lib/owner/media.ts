import { apiFetch } from '@/lib/api';

export type MediaType = 'PHOTO' | 'VIDEO';

export interface MediaItem {
  id: string;
  url: string;
  type: string;
  position: number;
  propertyId: string;
  createdAt: string;
}

export interface PresignResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresIn: number;
}

export async function listMedia(propertyId: string): Promise<MediaItem[]> {
  return apiFetch<MediaItem[]>(`/properties/${propertyId}/media`);
}

export async function presignMedia(
  propertyId: string,
  input: { filename: string; contentType: string; type: MediaType },
): Promise<PresignResult> {
  return apiFetch<PresignResult>(`/properties/${propertyId}/media/presign`, {
    method: 'POST',
    body: input,
  });
}

export async function confirmMedia(
  propertyId: string,
  input: { url: string; type: MediaType; position?: number },
): Promise<MediaItem> {
  return apiFetch<MediaItem>(`/properties/${propertyId}/media/confirm`, {
    method: 'POST',
    body: input,
  });
}

/** Upload via API → R2 (avoids browser CORS against R2). */
export async function uploadMedia(
  propertyId: string,
  file: File,
  position?: number,
): Promise<MediaItem> {
  const form = new FormData();
  form.append('file', file);
  if (position !== undefined) {
    form.append('position', String(position));
  }
  return apiFetch<MediaItem>(`/properties/${propertyId}/media/upload`, {
    method: 'POST',
    body: form,
  });
}
