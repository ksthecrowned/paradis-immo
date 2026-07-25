import { apiFetch, apiFetchPaginated } from '@/lib/api';

export type PropertyReportStatus =
  | 'OPEN'
  | 'REVIEWED'
  | 'DISMISSED'
  | 'ACTIONED';

export type PropertyReportReason =
  | 'ALREADY_SOLD_OR_RENTED'
  | 'FRAUDULENT'
  | 'DUPLICATE'
  | 'INCORRECT_INFO'
  | 'INAPPROPRIATE'
  | 'OTHER';

export interface AdminReportRow {
  id: string;
  propertyId: string;
  propertyTitle: string;
  reason: PropertyReportReason;
  description: string | null;
  status: PropertyReportStatus;
  reporterKey: string;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const REPORT_REASON_LABELS: Record<PropertyReportReason, string> = {
  ALREADY_SOLD_OR_RENTED: 'Déjà vendu / loué',
  FRAUDULENT: 'Annonce frauduleuse',
  DUPLICATE: 'Doublon',
  INCORRECT_INFO: 'Informations incorrectes',
  INAPPROPRIATE: 'Contenu inapproprié',
  OTHER: 'Autre',
};

export const REPORT_STATUS_LABELS: Record<PropertyReportStatus, string> = {
  OPEN: 'Ouvert',
  REVIEWED: 'Examiné',
  DISMISSED: 'Rejeté',
  ACTIONED: 'Traité',
};

export async function listAdminReports(options?: {
  status?: PropertyReportStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ data: AdminReportRow[]; meta: { total: number } }> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  params.set('page', String(options?.page ?? 1));
  params.set('pageSize', String(options?.pageSize ?? 50));
  const result = await apiFetchPaginated<AdminReportRow>(
    `/admin/reports?${params.toString()}`,
  );
  return {
    data: result.data,
    meta: { total: result.meta.total },
  };
}

export async function updateAdminReport(
  id: string,
  status: PropertyReportStatus,
  adminNote?: string,
): Promise<AdminReportRow> {
  return apiFetch<AdminReportRow>(`/admin/reports/${id}`, {
    method: 'PATCH',
    body: { status, adminNote },
  });
}
