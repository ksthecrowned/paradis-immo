import { apiFetch } from '@/lib/api';

/** Full `PublicMandate` shape returned by the API (spec 03). */
export interface PublicMandate {
  id: string;
  propertyId: string;
  organizationId: string;
  assignedAgentId: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  scopes: string[];
  exclusive: boolean;
  managementFeeRate: string | null;
  lettingFee: string | null;
  lettingFeeMonths: string | null;
  saleCommissionRate: string | null;
  stayCommissionRate: string | null;
  repairApprovalThreshold: string | null;
  rentChangeRequiresApproval: boolean;
  leaseSignRequiresApproval: boolean;
  minSalePrice: string | null;
  approvalTtlDays: number;
  noticeDays: number;
  tacitRenewal: boolean;
  proposedById: string;
  acceptedById: string | null;
  acceptedAt: string | null;
  terminationRequestedAt: string | null;
  terminationEffectiveAt: string | null;
  terminationReason: string | null;
  terminatedById: string | null;
  signedDocumentKey: string | null;
  ownerSignedAt: string | null;
  agencySignedAt: string | null;
}

export interface PublicMandateVersion {
  id: string;
  terms: unknown;
  proposedBy: string;
  createdAt: string;
}

export interface PublicMandateDetail extends PublicMandate {
  versions: PublicMandateVersion[];
  approvals: PublicMandateApproval[];
}

export interface PublicMandateApproval {
  id: string;
  mandateId: string;
  actionType: string;
  payload: Record<string, unknown>;
  status: string;
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
  requestedById: string;
  sourceType: string | null;
  sourceId: string | null;
  comment: string | null;
  expiresAt: string;
  appliedAt: string | null;
}

/** Conditions saisies lors d'une proposition ou contre-proposition. */
export interface MandateConditions {
  scopes?: string[];
  exclusive?: boolean;
  managementFeeRate?: number;
  lettingFee?: number;
  lettingFeeMonths?: number;
  saleCommissionRate?: number;
  stayCommissionRate?: number;
  repairApprovalThreshold?: number;
  rentChangeRequiresApproval?: boolean;
  leaseSignRequiresApproval?: boolean;
  minSalePrice?: number;
  approvalTtlDays?: number;
  noticeDays?: number;
  tacitRenewal?: boolean;
  endDate?: string;
}

/** GET /mandates/mine — mandats de mes biens. */
export async function listMyMandates(
  status?: string,
): Promise<PublicMandate[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<PublicMandate[]>(`/mandates/mine${qs}`);
}

export async function getMandateDetail(id: string): Promise<PublicMandateDetail> {
  return apiFetch<PublicMandateDetail>(`/mandates/${id}`);
}

/** GET /mandates/pending-approvals — approbations PENDING de mes biens. */
export async function listPendingApprovals(
  page = 1,
  pageSize = 50,
): Promise<PublicMandateApproval[]> {
  return apiFetch<PublicMandateApproval[]>(
    `/mandates/pending-approvals?page=${page}&pageSize=${pageSize}`,
  );
}

export async function createMandate(input: {
  propertyId: string;
  organizationId: string;
} & MandateConditions): Promise<{ id: string; propertyId: string; organizationId: string }> {
  return apiFetch('/mandates', {
    method: 'POST',
    body: input,
  });
}

/** PATCH /mandates/approvals/:id — applique réellement l'effet (spec 03). */
export async function decideApproval(
  id: string,
  decision: 'APPROVE' | 'REJECT',
  comment?: string,
): Promise<PublicMandateApproval> {
  return apiFetch<PublicMandateApproval>(`/mandates/approvals/${id}`, {
    method: 'PATCH',
    body: { decision, ...(comment ? { comment } : {}) },
  });
}

/** DELETE /mandates/approvals/:id — annulation par le demandeur. */
export async function cancelApproval(id: string): Promise<void> {
  await apiFetch(`/mandates/approvals/${id}`, { method: 'DELETE' });
}

/** POST /mandates/:id/terminate — résiliation avec préavis ou immédiate. */
export async function terminateMandate(
  id: string,
  input: { reason: string; immediate?: boolean },
): Promise<PublicMandate> {
  return apiFetch<PublicMandate>(`/mandates/${id}/terminate`, {
    method: 'POST',
    body: input,
  });
}

/** POST /mandates/:id/sign — OTP : sans code = envoi SMS, avec code = signe. */
export async function signMandate(
  id: string,
  code?: string,
): Promise<PublicMandate> {
  return apiFetch<PublicMandate>(`/mandates/${id}/sign`, {
    method: 'POST',
    body: code ? { code } : {},
  });
}

/** GET /mandates/:id/document — URL présignée du PDF signé. */
export async function getMandateDocumentUrl(id: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`/mandates/${id}/document`);
}

export function mandateActionLabel(actionType: string): string {
  const map: Record<string, string> = {
    LEASE_SIGN: 'Signature de bail',
    RENT_REDUCTION: 'Baisse de loyer',
    MAJOR_REPAIR: 'Travaux importants',
    SALE_PRICE: 'Prix de vente',
    SALE_OFFER_ACCEPT: 'Offre d’achat',
    EXPENSE: 'Dépense',
  };
  return map[actionType] ?? actionType;
}

export function approvalStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'En attente',
    APPROVED: 'Approuvé',
    REJECTED: 'Rejeté',
    EXPIRED: 'Expiré',
    CANCELLED: 'Annulé',
  };
  return map[status] ?? status;
}

export function mandateStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PROPOSED: 'Proposé',
    COUNTERED: 'Contre-proposé',
    ACTIVE: 'Actif',
    TERMINATING: 'En préavis',
    TERMINATED: 'Terminé',
    EXPIRED: 'Expiré',
    DECLINED: 'Refusé',
    REVOKED: 'Révoqué',
  };
  return map[status] ?? status;
}

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export function mandateStatusTone(status: string): StatusTone {
  const map: Record<string, StatusTone> = {
    PROPOSED: 'warning',
    COUNTERED: 'warning',
    ACTIVE: 'success',
    TERMINATING: 'warning',
    TERMINATED: 'neutral',
    EXPIRED: 'neutral',
    DECLINED: 'danger',
    REVOKED: 'neutral',
  };
  return map[status] ?? 'neutral';
}

export function mandateScopeLabel(scope: string): string {
  const map: Record<string, string> = {
    LONG_TERM_RENTAL: 'Location longue',
    SHORT_STAY: 'Séjours',
    SALE: 'Vente',
  };
  return map[scope] ?? scope;
}

/** « Gestion locative 8 % · Vente 5 % » — résumé des conditions d'un mandat. */
export function commissionSummary(m: PublicMandate): string {
  const parts: string[] = [];
  if (m.managementFeeRate) {
    parts.push(`Gestion ${(Number(m.managementFeeRate) * 100).toFixed(2).replace(/\.?0+$/, '')} %`);
  }
  if (m.lettingFee) parts.push(`Mise en location ${m.lettingFee} XAF`);
  if (m.lettingFeeMonths) parts.push(`Mise en location ${m.lettingFeeMonths} mois de loyer`);
  if (m.saleCommissionRate) {
    parts.push(`Vente ${(Number(m.saleCommissionRate) * 100).toFixed(2).replace(/\.?0+$/, '')} %`);
  }
  if (m.stayCommissionRate) {
    parts.push(`Séjours ${(Number(m.stayCommissionRate) * 100).toFixed(2).replace(/\.?0+$/, '')} %`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Commission à définir';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

/**
 * Aperçu de l'effet d'une approbation — ex. « Le loyer passera de 150 000 à
 * 130 000 XAF à partir du 01/11 » (spec 03, écran approbations).
 */
export function approvalEffectPreview(
  actionType: string,
  payload: Record<string, unknown>,
): string {
  switch (actionType) {
    case 'RENT_REDUCTION': {
      const newRent = Number(payload.newMonthlyRent ?? 0);
      const from = payload.effectiveFrom
        ? formatDateShort(String(payload.effectiveFrom))
        : null;
      const previous = payload.previousMonthlyRent ?? payload.oldMonthlyRent;
      const previousText =
        previous !== undefined && !Number.isNaN(Number(previous))
          ? ` de ${formatNumber(Number(previous))} à`
          : '';
      return `Le loyer passera${previousText} ${formatNumber(newRent)} XAF${
        from ? ` à partir du ${from}` : ''
      }.`;
    }
    case 'LEASE_SIGN':
      return 'Le bail sera activé (le locataire pourra emménager).';
    case 'MAJOR_REPAIR':
      return 'Le ticket de maintenance sera débloqué et l’agent pourra intervenir.';
    case 'SALE_PRICE': {
      const price = Number(payload.price ?? 0);
      return price > 0
        ? `Le prix du bien deviendra ${formatNumber(price)} XAF.`
        : 'Le prix du bien sera mis à jour.';
    }
    case 'SALE_OFFER_ACCEPT':
      return 'L’offre d’achat sera acceptée et le dossier de vente passera en cours.';
    case 'EXPENSE': {
      const amount = Number(payload.amount ?? 0);
      const label =
        typeof payload.label === 'string' && payload.label
          ? `« ${payload.label} »`
          : 'Cette dépense';
      return amount > 0
        ? `${label} de ${formatNumber(amount)} XAF sera validée et imputée au bien.`
        : `${label} sera validée et imputée au bien.`;
    }
    default:
      return 'Cette action sera appliquée automatiquement après approbation.';
  }
}
