import { apiFetch } from '@/lib/api';

export interface RentReceipt {
  id: string;
  number: string;
  rentScheduleId: string;
  issuerOrgId: string;
  issuedAt: string;
}

export async function listMyRentReceipts(): Promise<RentReceipt[]> {
  return apiFetch<RentReceipt[]>('/leases/my/quittances');
}

export async function getRentReceiptDownloadUrl(
  rentScheduleId: string,
): Promise<string> {
  const result = await apiFetch<{ url: string }>(
    `/rent-schedules/${encodeURIComponent(rentScheduleId)}/quittance`,
  );
  return result.url;
}
