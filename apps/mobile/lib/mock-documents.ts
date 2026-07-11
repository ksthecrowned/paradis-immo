export type DocumentStatus = 'VALIDATED' | 'PENDING' | 'MISSING';

export type MockTenantDocument = {
  id: string;
  title: string;
  status: DocumentStatus;
  leaseId?: string;
  previewHint: string;
};

const DOCS: MockTenantDocument[] = [
  {
    id: 'doc-id',
    title: 'Pièce d’identité',
    status: 'VALIDATED',
    previewHint: 'Carte nationale d’identité · validée le 12 mars 2026.',
  },
  {
    id: 'doc-lease-1',
    title: 'Contrat de bail',
    status: 'PENDING',
    leaseId: 'lease-1',
    previewHint: 'Contrat Appartement Centre-ville · en cours de validation.',
  },
  {
    id: 'doc-receipt',
    title: 'Quittance de loyer',
    status: 'MISSING',
    leaseId: 'lease-1',
    previewHint: 'Aucune quittance disponible pour le moment.',
  },
];

export function listMockDocuments(): MockTenantDocument[] {
  return [...DOCS];
}

export function documentStatusLabel(status: DocumentStatus): string {
  const map: Record<DocumentStatus, string> = {
    VALIDATED: 'Validé',
    PENDING: 'En attente',
    MISSING: 'Manquant',
  };
  return map[status];
}
