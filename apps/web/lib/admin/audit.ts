import { apiFetchPaginated } from '@/lib/api';

export interface AdminAuditRow {
  id: string;
  actorId: string;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export async function listAdminAuditLogs(options?: {
  action?: string;
  actorId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: AdminAuditRow[]; meta: { total: number } }> {
  const params = new URLSearchParams();
  if (options?.action) params.set('action', options.action);
  if (options?.actorId) params.set('actorId', options.actorId);
  params.set('page', String(options?.page ?? 1));
  params.set('pageSize', String(options?.pageSize ?? 50));
  const result = await apiFetchPaginated<AdminAuditRow>(
    `/admin/audit-logs?${params.toString()}`,
  );
  return { data: result.data, meta: { total: result.meta.total } };
}

export function auditActionLabel(action: string): string {
  const map: Record<string, string> = {
    'admin.user.suspend': 'Compte suspendu',
    'admin.user.unsuspend': 'Suspension levée',
    'admin.property.moderate': 'Annonce modérée',
    'admin.report.update': 'Signalement mis à jour',
    'admin.refund.approval': 'Remboursement approuvé',
    'admin.payout.approval': 'Reversement approuvé',
  };
  return map[action] ?? action;
}
