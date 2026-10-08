import { apiFetch } from '@/lib/api';

/** Spec 04 US 7 — colocation : qui rejoint (phones) ou quitte (userIds). */
export interface CoTenantsChanges {
  add?: string[];
  remove?: string[];
}

export interface AmendmentChanges {
  monthlyRent?: string;
  chargesAmount?: string;
  endDate?: string;
  noticeMonthsTenant?: number;
  noticeMonthsLandlord?: number;
  coTenants?: CoTenantsChanges;
}

export interface PublicAmendment {
  id: string;
  leaseId: string;
  version: number;
  changes: AmendmentChanges;
  effectiveFrom: string;
  reason: string | null;
  tenantSignedAt: string | null;
  landlordSignedAt: string | null;
  /** Both signatures recorded — the changes are live on the lease. */
  applied: boolean;
  createdById: string;
  createdAt: string;
}

export interface AmendmentSignatureState {
  sent?: boolean;
  signed?: boolean;
  bothSigned: boolean;
  applied: boolean;
  party: 'TENANT' | 'LANDLORD';
}

export interface CreateAmendmentInput {
  changes: {
    monthlyRent?: number;
    chargesAmount?: number;
    endDate?: string;
    noticeMonthsTenant?: number;
    noticeMonthsLandlord?: number;
    coTenants?: CoTenantsChanges;
  };
  effectiveFrom?: string;
  reason?: string;
}

export async function listAmendments(
  leaseId: string,
): Promise<PublicAmendment[]> {
  return apiFetch<PublicAmendment[]>(`/leases/${leaseId}/amendments`);
}

export async function createAmendment(
  leaseId: string,
  input: CreateAmendmentInput,
): Promise<PublicAmendment> {
  return apiFetch<PublicAmendment>(`/leases/${leaseId}/amendments`, {
    method: 'POST',
    body: input,
  });
}

/** Omit `otpCode` to receive a code over WhatsApp. */
export async function signAmendment(
  leaseId: string,
  version: number,
  otpCode?: string,
): Promise<PublicAmendment & { signature: AmendmentSignatureState }> {
  return apiFetch(`/leases/${leaseId}/amendments/${version}/sign`, {
    method: 'POST',
    body: otpCode ? { otpCode } : {},
  });
}

export function amendmentChangesLabel(
  changes: AmendmentChanges,
  currency: string,
): string {
  const parts: string[] = [];
  if (changes.monthlyRent) {
    parts.push(`Loyer ${Number(changes.monthlyRent).toLocaleString('fr-FR')} ${currency}`);
  }
  if (changes.chargesAmount) {
    parts.push(
      `Charges ${Number(changes.chargesAmount).toLocaleString('fr-FR')} ${currency}`,
    );
  }
  if (changes.endDate) {
    parts.push(`Fin ${new Date(changes.endDate).toLocaleDateString('fr-FR')}`);
  }
  if (changes.noticeMonthsTenant !== undefined) {
    parts.push(`Préavis locataire ${changes.noticeMonthsTenant} mois`);
  }
  if (changes.noticeMonthsLandlord !== undefined) {
    parts.push(`Préavis bailleur ${changes.noticeMonthsLandlord} mois`);
  }
  if (changes.coTenants?.add?.length) {
    parts.push(
      changes.coTenants.add.length === 1
        ? `Colocataire ${changes.coTenants.add[0]}`
        : `Colocataires +${changes.coTenants.add.length}`,
    );
  }
  if (changes.coTenants?.remove?.length) {
    parts.push(`Colocation −${changes.coTenants.remove.length}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}
