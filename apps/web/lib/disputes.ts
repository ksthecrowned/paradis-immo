import { apiFetch } from '@/lib/api';

export interface PublicDispute {
  id: string;
  paymentId: string;
  openedById: string;
  reason: string;
  description: string;
  evidenceKeys: string[];
  status: string;
  resolution: string | null;
  resolvedById: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface PublicRefund {
  id: string;
  paymentId: string;
  amount: string;
  reason: string;
  status: string;
  method: string;
  providerRef: string | null;
  requestedById: string;
  approvedById: string | null;
  proofKey: string | null;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface PaymentTimelineEvent {
  id: string;
  provider: string;
  kind: string;
  payload: unknown;
  signatureValid: boolean | null;
  createdAt: string;
}

export interface PaymentTimeline {
  events: PaymentTimelineEvent[];
  refunds: PublicRefund[];
  disputes: PublicDispute[];
}

/** GET disputes/managed — litiges du portefeuille du gestionnaire. */
export async function listManagedDisputes(): Promise<PublicDispute[]> {
  return apiFetch<PublicDispute[]>('/disputes/managed');
}

/** PATCH disputes/:id — réponse du gestionnaire (résolution sous 72 h). */
export async function resolveDispute(
  id: string,
  input: {
    status: 'RESOLVED_ACCEPTED' | 'RESOLVED_REJECTED';
    resolution?: string;
  },
): Promise<PublicDispute> {
  return apiFetch<PublicDispute>(`/disputes/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

/** GET payments/:id/timeline — événements fournisseur, remboursements, litiges. */
export async function getPaymentTimeline(
  paymentId: string,
): Promise<PaymentTimeline> {
  return apiFetch<PaymentTimeline>(`/payments/${paymentId}/timeline`);
}

export function disputeStatusLabel(status: string): string {
  return (
    {
      OPEN: 'Ouvert',
      AWAITING_MANAGER: 'Réponse attendue',
      ESCALATED: 'Escaladé',
      RESOLVED_ACCEPTED: 'Accepté',
      RESOLVED_REJECTED: 'Rejeté',
    }[status] ?? status
  );
}

export function disputeStatusTone(
  status: string,
): 'neutral' | 'success' | 'warning' | 'danger' | 'accent' {
  if (status === 'RESOLVED_ACCEPTED') return 'success';
  if (status === 'RESOLVED_REJECTED') return 'danger';
  if (status === 'ESCALATED') return 'danger';
  if (status === 'AWAITING_MANAGER') return 'warning';
  if (status === 'OPEN') return 'accent';
  return 'neutral';
}

export function disputeReasonLabel(reason: string): string {
  return (
    {
      NOT_CREDITED: 'Non crédité',
      DUPLICATE: 'Doublon',
      WRONG_AMOUNT: 'Montant erroné',
      OTHER: 'Autre',
    }[reason] ?? reason
  );
}
