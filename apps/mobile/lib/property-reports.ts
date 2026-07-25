import { apiFetch } from '@/lib/api';
import { getInstallId } from '@/lib/device-id';

export type PropertyReportReason =
  | 'ALREADY_SOLD_OR_RENTED'
  | 'FRAUDULENT'
  | 'DUPLICATE'
  | 'INCORRECT_INFO'
  | 'INAPPROPRIATE'
  | 'OTHER';

export const REPORT_REASON_LABELS: Record<PropertyReportReason, string> = {
  ALREADY_SOLD_OR_RENTED: 'Déjà vendu / loué',
  FRAUDULENT: 'Annonce frauduleuse',
  DUPLICATE: 'Doublon',
  INCORRECT_INFO: 'Informations incorrectes',
  INAPPROPRIATE: 'Contenu inapproprié',
  OTHER: 'Autre (à préciser)',
};

export async function submitPropertyReport(
  propertyId: string,
  reason: PropertyReportReason,
  description?: string,
): Promise<{ id: string; status: string }> {
  const deviceId = await getInstallId();
  return apiFetch<{ id: string; status: string }>(
    `/properties/${propertyId}/reports`,
    {
      method: 'POST',
      body: { reason, description, deviceId },
    },
  );
}
