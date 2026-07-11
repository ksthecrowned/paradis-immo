import { apiFetch } from '@/lib/api';

export interface PublicVisitSlotTemplate {
  id: string;
  propertyId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  active: boolean;
  createdAt: string;
}

export interface PublicVisitSlot {
  id: string;
  propertyId: string;
  startAt: string;
  endAt: string;
  status: string;
  source: string;
  createdAt: string;
}

export interface CreateTemplateInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

export const DAY_LABELS = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
] as const;

export async function listTemplates(
  propertyId: string,
): Promise<PublicVisitSlotTemplate[]> {
  return apiFetch<PublicVisitSlotTemplate[]>(
    `/properties/${propertyId}/visit-templates`,
  );
}

export async function createTemplate(
  propertyId: string,
  body: CreateTemplateInput,
): Promise<PublicVisitSlotTemplate> {
  return apiFetch<PublicVisitSlotTemplate>(
    `/properties/${propertyId}/visit-templates`,
    { method: 'POST', body },
  );
}

export async function deactivateTemplate(templateId: string): Promise<void> {
  await apiFetch(`/visit-templates/${templateId}/deactivate`, {
    method: 'PATCH',
  });
}

export async function blockSlot(
  propertyId: string,
  startAt: string,
  endAt: string,
): Promise<PublicVisitSlot> {
  return apiFetch<PublicVisitSlot>(
    `/properties/${propertyId}/visit-slots/block`,
    {
      method: 'POST',
      body: { startAt, endAt },
    },
  );
}

export async function listAvailableSlots(
  propertyId: string,
  from?: string,
  to?: string,
): Promise<PublicVisitSlot[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return apiFetch<PublicVisitSlot[]>(
    `/properties/${propertyId}/visit-slots${qs ? `?${qs}` : ''}`,
    { anonymous: true },
  );
}

export function slotStatusLabel(status: string): string {
  const map: Record<string, string> = {
    AVAILABLE: 'Disponible',
    BOOKED: 'Réservé',
    BLOCKED: 'Bloqué',
  };
  return map[status] ?? status;
}
