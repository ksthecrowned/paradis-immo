import { apiFetch } from '@/lib/api';

export type PublicMessageCharge = {
  id: string;
  channel: string;
  recipientPhone: string;
  amountXaf: number;
  unitUsd: string;
  fxRate: string;
  billingMonth: string;
  occurredAt: string;
  status: string;
};

export type OrgMessagingBalance = {
  organizationId: string;
  openBalanceXaf: number;
  charges: PublicMessageCharge[];
};

export async function fetchOrgMessagingBalance(
  organizationId: string,
): Promise<OrgMessagingBalance> {
  return apiFetch<OrgMessagingBalance>(
    `/messaging/org/${encodeURIComponent(organizationId)}/balance`,
  );
}

export function formatXaf(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(amount);
}
