import { apiFetch } from '@/lib/api';

export type TenantDocumentType = 'ID_CARD' | 'PASSPORT' | 'OTHER_ID';

export type TenantDocumentItem = {
  id: string;
  userId: string;
  type: string;
  url: string;
  name: string;
  uploadedBy: string;
  createdAt: string;
};

export const TENANT_DOCUMENT_TYPE_LABELS: Record<TenantDocumentType, string> = {
  ID_CARD: "Carte d'identité",
  PASSPORT: 'Passeport',
  OTHER_ID: 'Autre pièce',
};

export async function listTenantDocuments(
  userId: string,
): Promise<TenantDocumentItem[]> {
  return apiFetch<TenantDocumentItem[]>(`/tenants/${userId}/documents`);
}

export async function uploadTenantDocument(
  userId: string,
  file: File,
  type: TenantDocumentType,
  name?: string,
): Promise<TenantDocumentItem> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  if (name) form.append('name', name);
  return apiFetch<TenantDocumentItem>(
    `/tenants/${userId}/documents/upload`,
    { method: 'POST', body: form },
  );
}

export async function deleteTenantDocument(
  userId: string,
  documentId: string,
): Promise<void> {
  await apiFetch(`/tenants/${userId}/documents/${documentId}`, {
    method: 'DELETE',
  });
}
