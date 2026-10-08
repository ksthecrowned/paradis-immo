import { apiFetch } from '@/lib/api';

export interface PublicLateFee {
  rentScheduleId: string;
  leaseId: string;
  scheduleId: string;
  amount: string;
  currency: string;
  dueDate: string;
  waived: boolean;
}

export interface PublicFormalNotice {
  id: string;
  leaseId: string;
  name: string;
  url: string;
  totalDue: string;
  currency: string;
  overdueCount: number;
  paymentDelayDays: number;
  issuedAt: string;
}

/** Spec 04 P2 — the manager cancels a late fee. */
export async function waiveLateFee(
  rentScheduleId: string,
): Promise<PublicLateFee> {
  return apiFetch<PublicLateFee>(`/rent-schedules/${rentScheduleId}/waive-fee`, {
    method: 'POST',
    body: {},
  });
}

/** Spec 04 P2 — mise en demeure PDF (allowed from 15 days of arrears). */
export async function sendFormalNotice(
  leaseId: string,
  input: { paymentDelayDays?: number } = {},
): Promise<PublicFormalNotice> {
  return apiFetch<PublicFormalNotice>(`/leases/${leaseId}/formal-notice`, {
    method: 'POST',
    body: input,
  });
}

/** Days of arrears at which a formal notice becomes allowed (spec 04). */
export const FORMAL_NOTICE_DAYS = 15;
