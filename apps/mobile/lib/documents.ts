import { apiFetch } from '@/lib/api';

export type TenantDocumentItem = {
  id: string;
  userId: string;
  type: string;
  url: string;
  name: string;
  createdAt: string;
};

export type LeaseDocumentItem = {
  id: string;
  leaseId: string;
  type: string;
  url: string;
  name: string;
  createdAt: string;
};

export async function listMyDocuments(): Promise<TenantDocumentItem[]> {
  return apiFetch<TenantDocumentItem[]>('/me/documents');
}

export async function listLeaseDocuments(
  leaseId: string,
): Promise<LeaseDocumentItem[]> {
  return apiFetch<LeaseDocumentItem[]>(`/leases/${leaseId}/documents`);
}

export function tenantDocTypeLabel(type: string): string {
  const map: Record<string, string> = {
    ID_CARD: "Carte d'identité",
    PASSPORT: 'Passeport',
    OTHER_ID: 'Autre pièce',
  };
  return map[type] ?? type;
}

export function leaseDocTypeLabel(type: string): string {
  const map: Record<string, string> = {
    SIGNED_LEASE: 'Bail signé',
    AMENDMENT: 'Avenant',
    OTHER_LEASE: 'Autre',
  };
  return map[type] ?? type;
}
