import { apiFetch } from '@/lib/api';

export type ManagedTenantLeaseSummary = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  status: string;
  monthlyRent: string;
  currency: string;
};

export type ManagedTenantPaymentSummary = {
  pendingValidation: number;
  overdueRentLines: number;
};

export type ManagedTenantListItem = {
  id: string;
  name: string | null;
  phone: string | null;
  accountCreatedAt: string;
  activeLeaseCount: number;
  leases: ManagedTenantLeaseSummary[];
  paymentSummary: ManagedTenantPaymentSummary;
};

export type TenantNextDue = {
  id: string;
  dueDate: string;
  amount: string;
  currency: string;
  status: string;
};

export type ManagedTenantLeaseDetail = ManagedTenantLeaseSummary & {
  nextDue: TenantNextDue | null;
  overdueCount: number;
};

export type ManagedTenantRecentPayment = {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  method: string;
  provider: string | null;
  status: string;
  createdAt: string;
  validatedAt: string | null;
};

export type ManagedTenantDetail = Omit<ManagedTenantListItem, 'leases'> & {
  leases: ManagedTenantLeaseDetail[];
  recentPayments: ManagedTenantRecentPayment[];
};

export async function listManagedTenants(): Promise<ManagedTenantListItem[]> {
  return apiFetch<ManagedTenantListItem[]>('/tenants/managed');
}

export async function getManagedTenant(
  userId: string,
): Promise<ManagedTenantDetail> {
  return apiFetch<ManagedTenantDetail>(`/tenants/${userId}`);
}
