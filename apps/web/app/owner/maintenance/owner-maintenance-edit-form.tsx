'use client';

import { DashboardPageHeader } from '@/components/dashboard';
import {
  ApiErrorBanner,
  FormCard,
  FormField,
  FormFooter,
  FormLayout,
  FormSidebar,
  Input,
  NumberInput,
  Select,
  StatusPill,
} from '@/components/forms';
import { useRequireSession } from '@/hooks/use-require-session';
import { useResourceForm } from '@/hooks/use-resource-form';
import { ApiError } from '@/lib/api';
import {
  assignMaintenanceTicket,
  getMaintenanceTicket,
  maintenancePriorityLabel,
  maintenanceStatusLabel,
  maintenanceStatusTone,
  updateMaintenanceTicket,
  type PublicMaintenanceTicket,
} from '@/lib/owner/maintenance';
import { ROUTES } from '@/lib/routes';
import { validateRequired } from '@/lib/validation';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const STATUS_OPTIONS = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'DONE',
  'CLOSED',
] as const;

type FormValues = {
  status: string;
  estimatedCost: string;
  assigneeId: string;
};

export interface OwnerMaintenanceEditFormProps {
  ticketId: string;
}

export function OwnerMaintenanceEditForm({
  ticketId,
}: OwnerMaintenanceEditFormProps): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [ticket, setTicket] = useState<PublicMaintenanceTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMaintenanceTicket(ticketId);
      setTicket(data);
      setLoadError(null);
    } catch (err) {
      setTicket(null);
      setLoadError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le ticket.',
      );
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const form = useResourceForm<FormValues>({
    initial: {
      status: 'OPEN',
      estimatedCost: '',
      assigneeId: '',
    },
    validate: (v) => {
      const e: Record<string, string> = {};
      e.status = validateRequired(v.status, 'Le statut') ?? '';
      if (v.assigneeId.trim()) {
        // assignee is optional until user submits assign section
      }
      return e;
    },
    onSubmit: async (values) => {
      const body: { status?: string; estimatedCost?: number } = {
        status: values.status,
      };
      if (values.estimatedCost.trim() !== '') {
        body.estimatedCost = Number(values.estimatedCost);
      }
      await updateMaintenanceTicket(ticketId, body);
      if (values.assigneeId.trim()) {
        await assignMaintenanceTicket(ticketId, values.assigneeId.trim());
      }
      router.push(ROUTES.owner.maintenanceTicket(ticketId));
    },
  });

  useEffect(() => {
    if (!ticket) return;
    form.setValues({
      status: ticket.status,
      estimatedCost: ticket.estimatedCost ?? '',
      assigneeId: ticket.assigneeId ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket]);

  if (!ready || loading) {
    return <p className="text-base text-muted">Chargement…</p>;
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <DashboardPageHeader title="Modifier le ticket" />
        <ApiErrorBanner message={loadError ?? 'Ticket introuvable.'} />
      </div>
    );
  }

  const shortTitle =
    ticket.title.length > 40 ? `${ticket.title.slice(0, 40)}…` : ticket.title;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Modifier le ticket"
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.owner.dashboard },
          { label: 'Maintenance', href: ROUTES.owner.maintenance },
          { label: shortTitle, href: ROUTES.owner.maintenanceTicket(ticketId) },
          { label: 'Modifier' },
        ]}
      />
      <ApiErrorBanner message={form.submitError} />
      <FormLayout
        sidebar={
          <FormSidebar
            sections={[
              {
                title: 'Statut actuel',
                icon: 'mdi:flag-variant-outline',
                children: (
                  <StatusPill
                    label={maintenanceStatusLabel(ticket.status)}
                    tone={maintenanceStatusTone(ticket.status)}
                    icon="mdi:wrench-outline"
                  />
                ),
              },
              {
                title: 'Ticket',
                icon: 'mdi:information-outline',
                children: (
                  <div className="space-y-2 text-base">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted">Priorité</span>
                      <span className="text-foreground">
                        {maintenancePriorityLabel(ticket.priority)}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted">Créé le</span>
                      <span className="text-foreground">
                        {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        }
      >
        <FormCard
          title="Gestion du ticket"
          hint="Mettez à jour le statut, le coût estimé ou l’assignation."
          footer={
            <FormFooter
              onSubmit={() => form.handleSubmit()}
              onCancel={() =>
                router.push(ROUTES.owner.maintenanceTicket(ticketId))
              }
              submitLabel="Enregistrer"
              saving={form.saving}
            />
          }
        >
          <form onSubmit={(e) => void form.handleSubmit(e)} className="space-y-4">
            <FormField name="status" label="Statut" required error={form.errors.status}>
              <Select
                id="status"
                value={form.values.status}
                onChange={(e) => form.setField('status', e.target.value)}
                invalid={!!form.errors.status}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {maintenanceStatusLabel(s)}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              name="estimatedCost"
              label="Coût estimé (XAF)"
              hint="Laisser vide si non connu."
            >
              <NumberInput
                name="estimatedCost"
                min={0}
                value={form.values.estimatedCost}
                onChange={(v) => form.setField('estimatedCost', v)}
              />
            </FormField>

            <FormField
              name="assigneeId"
              label="Technicien / agent (ID utilisateur)"
              hint="Optionnel — laissez vide pour ne pas réassigner."
            >
              <Input
                id="assigneeId"
                value={form.values.assigneeId}
                onChange={(e) => form.setField('assigneeId', e.target.value)}
                placeholder="UUID du compte"
                className="font-mono text-sm"
              />
            </FormField>
          </form>
        </FormCard>
      </FormLayout>
    </div>
  );
}
