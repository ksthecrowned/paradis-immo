import type { StatusTone } from '@/components/ui/StatusBadge';

export type PurchaseStatus =
  | 'INQUIRY'
  | 'NEGOTIATION'
  | 'UNDER_OFFER'
  | 'PURCHASED';

export type MockPurchase = {
  id: string;
  propertyId: string;
  status: PurchaseStatus;
  /** Offer or agreed amount when known. */
  amount?: number;
  currency: 'FCFA';
  agencyId: string;
  agentId: string;
  updatedAt: string;
  note?: string;
};

const PURCHASES: MockPurchase[] = [
  {
    id: 'buy-1',
    propertyId: '1',
    status: 'INQUIRY',
    currency: 'FCFA',
    agencyId: 'ag-paradis-immo',
    agentId: 'ag-paradis-immo-1',
    updatedAt: '2026-07-11T10:00:00.000Z',
    note: 'Demande d’achat envoyée — en attente de retour de l’agence.',
  },
  {
    id: 'buy-2',
    propertyId: '4',
    status: 'PURCHASED',
    amount: 12_000_000,
    currency: 'FCFA',
    agencyId: 'ag-mongo-immo',
    agentId: 'ag-mongo-immo-1',
    updatedAt: '2026-05-20T12:00:00.000Z',
    note: 'Terrain acquis — dossier clôturé.',
  },
  {
    id: 'buy-3',
    propertyId: '1',
    status: 'UNDER_OFFER',
    amount: 68_000_000,
    currency: 'FCFA',
    agencyId: 'ag-paradis-immo',
    agentId: 'ag-paradis-immo-1',
    updatedAt: '2026-07-09T16:00:00.000Z',
    note: 'Offre en cours d’étude par le propriétaire.',
  },
];

export function listMockPurchases(): MockPurchase[] {
  return [...PURCHASES].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function listInProgressPurchases(): MockPurchase[] {
  return listMockPurchases().filter((p) => p.status !== 'PURCHASED');
}

export function listOwnedPurchases(): MockPurchase[] {
  return listMockPurchases().filter((p) => p.status === 'PURCHASED');
}

export function getMockPurchase(id: string): MockPurchase | undefined {
  return PURCHASES.find((p) => p.id === id);
}

export function purchaseStatusLabel(status: PurchaseStatus): string {
  const map: Record<PurchaseStatus, string> = {
    INQUIRY: 'Demande envoyée',
    NEGOTIATION: 'En négociation',
    UNDER_OFFER: 'Sous offre',
    PURCHASED: 'Acquis',
  };
  return map[status];
}

export function purchaseStatusTone(status: PurchaseStatus): StatusTone {
  const map: Record<PurchaseStatus, StatusTone> = {
    INQUIRY: 'neutral',
    NEGOTIATION: 'warning',
    UNDER_OFFER: 'warning',
    PURCHASED: 'success',
  };
  return map[status];
}
