import { apiFetch, apiFetchPaginated } from '@/lib/api';
import type { PaginatedResult } from '@/lib/http/types';

export interface PayoutAccountInfo {
  id: string;
  type: string;
  holderName: string;
  bankName: string | null;
  /** Numéro masqué : `+24207***61` ou `****1234`. */
  masked: string;
  isDefault: boolean;
}

export interface PublicPayout {
  id: string;
  organizationId: string;
  payoutAccountId: string;
  amount: string;
  fee: string;
  currency: string;
  kind: string;
  status: string;
  providerRef: string | null;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
  account: PayoutAccountInfo | null;
}

/** GET payouts/mine — reversements reçus (paginé). */
export async function listMyPayouts(query: {
  page?: number;
  pageSize?: number;
  status?: string;
} = {}): Promise<PaginatedResult<PublicPayout>> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return apiFetchPaginated<PublicPayout>(
    `/payouts/mine${qs ? `?${qs}` : ''}`,
  );
}

/**
 * POST payouts/request — reversement à la demande (solde ≥
 * `minPayoutAmount`). Rejette avec `MINIMUM_PAYOUT_NOT_REACHED` (balance /
 * minPayoutAmount dans la réponse) ou `NO_VERIFIED_PAYOUT_ACCOUNT`.
 */
export async function requestPayout(
  payoutAccountId?: string,
): Promise<PublicPayout> {
  return apiFetch<PublicPayout>('/payouts/request', {
    method: 'POST',
    body: payoutAccountId ? { payoutAccountId } : {},
  });
}

export function payoutStatusLabel(status: string): string {
  return (
    {
      PENDING: 'En attente',
      PROCESSING: 'En cours',
      PAID: 'Versé',
      FAILED: 'Échoué',
      CANCELLED: 'Annulé',
    }[status] ?? status
  );
}

export interface PayoutAccount {
  id: string;
  organizationId: string;
  type: 'MOBILE_MONEY' | 'BANK';
  provider: string | null;
  phone: string | null;
  bankName: string | null;
  accountNumber: string | null;
  holderName: string;
  verifiedAt: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface PayoutSettings {
  payoutFrequency: 'MONTHLY' | 'ON_DEMAND';
  minPayoutAmount: string;
}

const accountsBase = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/payout-accounts`;

/** GET organizations/:id/payout-accounts — comptes (OWNER de l'org). */
export async function listPayoutAccounts(
  organizationId: string,
): Promise<PayoutAccount[]> {
  return apiFetch<PayoutAccount[]>(accountsBase(organizationId));
}

export interface CreatePayoutAccountInput {
  type: 'MOBILE_MONEY' | 'BANK';
  provider?: string;
  phone?: string;
  bankName?: string;
  accountNumber?: string;
  holderName: string;
  isDefault?: boolean;
}

/** POST organizations/:id/payout-accounts */
export async function createPayoutAccount(
  organizationId: string,
  input: CreatePayoutAccountInput,
): Promise<PayoutAccount> {
  return apiFetch<PayoutAccount>(accountsBase(organizationId), {
    method: 'POST',
    body: input,
  });
}

/** PATCH organizations/:id/payout-accounts/:accountId (défaut, titulaire). */
export async function updatePayoutAccount(
  organizationId: string,
  accountId: string,
  input: { isDefault?: boolean; holderName?: string },
): Promise<PayoutAccount> {
  return apiFetch<PayoutAccount>(
    `${accountsBase(organizationId)}/${encodeURIComponent(accountId)}`,
    { method: 'PATCH', body: input },
  );
}

/**
 * POST organizations/:id/payout-accounts/:accountId/verify — sandbox :
 * code `1` (micro-dépôt 1 XAF) ou `000000` (OTP fournisseur simulé).
 */
export async function verifyPayoutAccount(
  organizationId: string,
  accountId: string,
  code: string,
): Promise<PayoutAccount> {
  return apiFetch<PayoutAccount>(
    `${accountsBase(organizationId)}/${encodeURIComponent(accountId)}/verify`,
    { method: 'POST', body: { code } },
  );
}

/** DELETE organizations/:id/payout-accounts/:accountId */
export async function deletePayoutAccount(
  organizationId: string,
  accountId: string,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(
    `${accountsBase(organizationId)}/${encodeURIComponent(accountId)}`,
    { method: 'DELETE' },
  );
}

/** GET organizations/:id/payout-settings — fréquence et seuil actuels. */
export async function getPayoutSettings(
  organizationId: string,
): Promise<PayoutSettings> {
  return apiFetch<PayoutSettings>(
    `/organizations/${encodeURIComponent(organizationId)}/payout-settings`,
  );
}

/** PATCH organizations/:id/payout-settings — fréquence et seuil. */
export async function updatePayoutSettings(
  organizationId: string,
  input: {
    payoutFrequency?: 'MONTHLY' | 'ON_DEMAND';
    minPayoutAmount?: number;
  },
): Promise<PayoutSettings> {
  return apiFetch<PayoutSettings>(
    `/organizations/${encodeURIComponent(organizationId)}/payout-settings`,
    { method: 'PATCH', body: input },
  );
}

export function payoutStatusTone(
  status: string,
): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'PAID') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'PENDING' || status === 'PROCESSING') return 'warning';
  return 'neutral';
}
