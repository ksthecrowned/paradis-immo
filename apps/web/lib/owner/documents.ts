import { apiFetch } from '@/lib/api';

export type DocumentType = 'TITLE_DEED' | 'PLAN' | 'OTHER';

export interface PropertyDocumentItem {
  id: string;
  propertyId: string;
  type: DocumentType | string;
  url: string;
  name: string;
  createdAt: string;
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  TITLE_DEED: 'Titre foncier',
  PLAN: 'Plan',
  OTHER: 'Autre',
};

export async function listDocuments(
  propertyId: string,
): Promise<PropertyDocumentItem[]> {
  return apiFetch<PropertyDocumentItem[]>(
    `/properties/${propertyId}/documents`,
  );
}

export async function uploadDocument(
  propertyId: string,
  file: File,
  type: DocumentType,
  name?: string,
): Promise<PropertyDocumentItem> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  if (name) form.append('name', name);
  return apiFetch<PropertyDocumentItem>(
    `/properties/${propertyId}/documents/upload`,
    { method: 'POST', body: form },
  );
}

export async function deleteDocument(
  propertyId: string,
  documentId: string,
): Promise<void> {
  await apiFetch<void>(
    `/properties/${propertyId}/documents/${documentId}`,
    { method: 'DELETE' },
  );
}
