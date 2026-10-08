import { apiFetch } from '@/lib/api';
import type { SolvencyCheckStatus } from '@/lib/owner/solvency';

export { fetchPropertyApplications } from '@/lib/owner/application-queries';

/** Mirrors `ApplicationStatus` in the Prisma schema (spec 04). */
export type ApplicationStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'SOLVENCY_PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type RentalApplication = {
  id: string;
  propertyId: string;
  applicantId: string;
  desiredMoveIn: string;
  occupants: number;
  occupation: string | null;
  declaredIncome: string | null;
  message: string | null;
  status: ApplicationStatus;
  rejectionMessage: string | null;
  decidedById: string | null;
  decidedAt: string | null;
  leaseId: string | null;
  createdAt: string;
  applicant?: { id: string; name: string | null; phone: string | null };
  property?: {
    id: string;
    title: string;
    address: string;
    price: string;
    currency: string;
  };
  solvencyCheck?: {
    id: string;
    status: SolvencyCheckStatus;
    expiresAt: string | null;
  } | null;
};

/** Open statuses: the candidature can still be worked on. */
export const OPEN_APPLICATION_STATUSES: ApplicationStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'SOLVENCY_PENDING',
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Déposée',
  UNDER_REVIEW: 'À l’étude',
  SOLVENCY_PENDING: 'Solvabilité demandée',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  WITHDRAWN: 'Retirée',
};

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'accent';

export function applicationStatusLabel(status: string): string {
  return (
    APPLICATION_STATUS_LABELS[status as ApplicationStatus] ?? status
  );
}

export function applicationStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'ACCEPTED':
      return 'success';
    case 'REJECTED':
    case 'WITHDRAWN':
      return 'danger';
    case 'SOLVENCY_PENDING':
      return 'warning';
    case 'UNDER_REVIEW':
      return 'accent';
    default:
      return 'neutral';
  }
}

export function isOpenApplication(status: string): boolean {
  return OPEN_APPLICATION_STATUSES.includes(status as ApplicationStatus);
}

/** Accept a candidature: siblings are auto-rejected server-side. */
export async function acceptApplication(
  applicationId: string,
  rejectionMessage?: string,
): Promise<RentalApplication> {
  return apiFetch<RentalApplication>(`/applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'ACCEPTED',
      ...(rejectionMessage ? { rejectionMessage } : {}),
    }),
  });
}

/** A rejection reason is mandatory server-side. */
export async function rejectApplication(
  applicationId: string,
  rejectionMessage: string,
): Promise<RentalApplication> {
  return apiFetch<RentalApplication>(`/applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'REJECTED', rejectionMessage }),
  });
}

export async function setApplicationUnderReview(
  applicationId: string,
): Promise<RentalApplication> {
  return apiFetch<RentalApplication>(`/applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'UNDER_REVIEW' }),
  });
}

/** Ask the candidate for solvency consent (spec 04). */
export async function requestSolvencyCheck(
  applicationId: string,
): Promise<{ id: string; status: SolvencyCheckStatus }> {
  return apiFetch(`/applications/${applicationId}/solvency-checks`, {
    method: 'POST',
  });
}

export type CreateLeaseOverrides = {
  startDate?: string;
  endDate?: string;
  monthlyRent?: number;
  deposit?: number;
  dueDay?: number;
};

/** Turn an accepted candidature into a DRAFT lease (spec 04). */
export async function createLeaseFromApplication(
  applicationId: string,
  overrides: CreateLeaseOverrides = {},
): Promise<{ id: string; status: string }> {
  return apiFetch(`/applications/${applicationId}/lease`, {
    method: 'POST',
    body: JSON.stringify(overrides),
  });
}

export async function withdrawApplication(
  applicationId: string,
): Promise<RentalApplication> {
  return apiFetch<RentalApplication>(`/applications/${applicationId}`, {
    method: 'DELETE',
  });
}

/** Seeker side: apply on a listing. */
export async function applyToProperty(
  propertyId: string,
  input: {
    desiredMoveIn: string;
    occupants: number;
    occupation?: string;
    declaredIncome?: number;
    message?: string;
  },
): Promise<RentalApplication> {
  return apiFetch<RentalApplication>(`/properties/${propertyId}/applications`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchMyApplications(): Promise<RentalApplication[]> {
  return apiFetch<RentalApplication[]>('/applications/mine');
}