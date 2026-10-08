import { apiFetch } from '@/lib/api';

/** Spec 04 P2 — modèles de bail d'une agence. */
export interface LeaseTemplateItem {
  id: string;
  organizationId: string;
  name: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
}

const base = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/lease-templates`;

export async function listLeaseTemplates(
  organizationId: string,
): Promise<LeaseTemplateItem[]> {
  return apiFetch<LeaseTemplateItem[]>(base(organizationId));
}

export async function createLeaseTemplate(
  organizationId: string,
  input: { name: string; body: string; isDefault?: boolean },
): Promise<LeaseTemplateItem> {
  return apiFetch<LeaseTemplateItem>(base(organizationId), {
    method: 'POST',
    body: input,
  });
}

export async function updateLeaseTemplate(
  organizationId: string,
  templateId: string,
  input: { name?: string; body?: string; isDefault?: boolean },
): Promise<LeaseTemplateItem> {
  return apiFetch<LeaseTemplateItem>(
    `${base(organizationId)}/${encodeURIComponent(templateId)}`,
    { method: 'PATCH', body: input },
  );
}

export async function deleteLeaseTemplate(
  organizationId: string,
  templateId: string,
): Promise<void> {
  await apiFetch(`${base(organizationId)}/${encodeURIComponent(templateId)}`, {
    method: 'DELETE',
  });
}