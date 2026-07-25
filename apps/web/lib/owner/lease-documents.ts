import { apiFetch } from '@/lib/api';

export type LeaseDocumentType = 'SIGNED_LEASE' | 'AMENDMENT' | 'OTHER_LEASE';

export type LeaseDocumentItem = {
  id: string;
  leaseId: string;
  type: string;
  url: string;
  name: string;
  uploadedBy: string;
  createdAt: string;
};

export const LEASE_DOCUMENT_TYPE_LABELS: Record<LeaseDocumentType, string> = {
  SIGNED_LEASE: 'Bail signé',
  AMENDMENT: 'Avenant',
  OTHER_LEASE: 'Autre',
};

export async function listLeaseDocuments(
  leaseId: string,
): Promise<LeaseDocumentItem[]> {
  return apiFetch<LeaseDocumentItem[]>(`/leases/${leaseId}/documents`);
}

export async function uploadLeaseDocument(
  leaseId: string,
  file: File,
  type: LeaseDocumentType,
  name?: string,
): Promise<LeaseDocumentItem> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  if (name) form.append('name', name);
  return apiFetch<LeaseDocumentItem>(`/leases/${leaseId}/documents/upload`, {
    method: 'POST',
    body: form,
  });
}

export async function deleteLeaseDocument(
  leaseId: string,
  documentId: string,
): Promise<void> {
  await apiFetch(`/leases/${leaseId}/documents/${documentId}`, {
    method: 'DELETE',
  });
}
