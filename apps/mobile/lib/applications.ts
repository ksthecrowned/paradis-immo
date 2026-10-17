import { apiFetch } from '@/lib/api';
export {
  canWithdrawApplication,
  isValidMoveInDate,
  rentalApplicationStatusLabel,
} from './applications-utils';

export type RentalApplicationStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'SOLVENCY_PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type PublicRentalApplication = {
  id: string;
  propertyId: string;
  applicantId: string;
  desiredMoveIn: string;
  occupants: number;
  occupation: string | null;
  declaredIncome: string | null;
  message: string | null;
  status: RentalApplicationStatus;
  rejectionMessage: string | null;
  decidedAt: string | null;
  leaseId: string | null;
  createdAt: string;
  property?: {
    id: string;
    title: string;
    address: string;
    price: string;
    currency: string;
  };
  solvencyCheck?: {
    id: string;
    status: 'PENDING' | 'GRANTED' | 'DENIED' | 'EXPIRED';
    expiresAt: string | null;
  } | null;
};

export type CreateRentalApplication = {
  desiredMoveIn: string;
  occupants: number;
  occupation?: string;
  declaredIncome?: number;
  message?: string;
};

export async function createRentalApplication(
  propertyId: string,
  input: CreateRentalApplication,
): Promise<PublicRentalApplication> {
  return apiFetch<PublicRentalApplication>(
    `/properties/${propertyId}/applications`,
    { method: 'POST', body: input },
  );
}

export async function listMyRentalApplications(): Promise<
  PublicRentalApplication[]
> {
  return apiFetch<PublicRentalApplication[]>('/applications/mine');
}

export async function withdrawRentalApplication(
  id: string,
): Promise<PublicRentalApplication> {
  return apiFetch<PublicRentalApplication>(`/applications/${id}`, {
    method: 'DELETE',
  });
}
