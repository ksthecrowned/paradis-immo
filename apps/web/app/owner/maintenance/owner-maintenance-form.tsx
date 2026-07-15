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
  Select,
  SelectSearch,
  Textarea,
  TipBox,
} from '@/components/forms';
import { useRequireSession } from '@/hooks/use-require-session';
import { useResourceForm } from '@/hooks/use-resource-form';
import { createMaintenanceTicket } from '@/lib/owner/maintenance';
import { listMyProperties } from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { validateRequired } from '@/lib/validation';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type FormValues = {
  propertyId: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
};

const defaultValues = (): FormValues => ({
  propertyId: '',
  title: '',
  description: '',
  priority: 'MEDIUM',
});

const validate = (v: FormValues): Record<string, string> => {
  const e: Record<string, string> = {};
  e.propertyId = validateRequired(v.propertyId, 'Le bien') ?? '';
  e.title = validateRequired(v.title, 'Le titre') ?? '';
  e.description = validateRequired(v.description, 'La description') ?? '';
  return e;
};

export function OwnerMaintenanceForm(): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [properties, setProperties] = useState<
    Array<{ id: string; title: string }>
  >([]);

  const form = useResourceForm<FormValues>({
    initial: defaultValues(),
    validate,
    onSubmit: async (values) => {
      const ticket = await createMaintenanceTicket({
        propertyId: values.propertyId.trim(),
        title: values.title.trim(),
        description: values.description.trim(),
        priority: values.priority,
      });
      router.push(ROUTES.owner.maintenanceTicket(ticket.id));
    },
  });

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const props = await listMyProperties();
        if (cancelled) return;
        const list = props.map((p) => ({ id: p.id, title: p.title }));
        setProperties(list);
        if (!form.values.propertyId && list[0]) {
          form.setField('propertyId', list[0].id);
        }
      } catch {
        // optional prefill
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) {
    return <p className="text-base text-muted">Chargement de la session…</p>;
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Ouvrir un ticket"
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.owner.dashboard },
          { label: 'Maintenance', href: ROUTES.owner.maintenance },
          { label: 'Nouveau ticket' },
        ]}
      />
      <ApiErrorBanner message={form.submitError} />
      <FormLayout
        sidebar={
          <FormSidebar
            sections={[
              {
                title: 'À propos',
                icon: 'mdi:information-outline',
                children: (
                  <p className="text-base text-muted">
                    Signalez un problème sur l&apos;un de vos biens. Un agent
                    ou technicien pourra prendre en charge le ticket.
                  </p>
                ),
              },
              {
                title: 'Conseils',
                icon: 'mdi:lightbulb-on-outline',
                children: (
                  <TipBox
                    tips={[
                      {
                        icon: 'mdi:text-box-outline',
                        title: 'Description précise',
                        body: 'Indiquez l’emplacement, l’urgence et ce qui a déjà été tenté.',
                      },
                      {
                        icon: 'mdi:alert-decagram-outline',
                        title: 'Priorité',
                        body: 'Réservez « Urgente » aux cas de sécurité ou dégâts des eaux.',
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        }
      >
        <FormCard
          title="Informations du ticket"
          hint="Les champs marqués d'un astérisque sont obligatoires."
          footer={
            <FormFooter
              onSubmit={() => form.handleSubmit()}
              onCancel={() => router.push(ROUTES.owner.maintenance)}
              submitLabel="Créer le ticket"
              submitIcon="mdi:plus"
              saving={form.saving}
            />
          }
        >
          <form onSubmit={(e) => void form.handleSubmit(e)} className="space-y-4">
            <FormField
              name="propertyId"
              label="Bien"
              required
              error={form.errors.propertyId}
            >
              <SelectSearch
                name="propertyId"
                value={form.values.propertyId}
                onChange={(v) => form.setField('propertyId', v)}
                options={properties.map((p) => ({
                  value: p.id,
                  label: p.title,
                }))}
                placeholder={
                  properties.length === 0
                    ? 'Aucun bien disponible'
                    : 'Sélectionner un bien'
                }
                disabled={properties.length === 0}
                invalid={!!form.errors.propertyId}
              />
            </FormField>

            <FormField name="title" label="Titre" required error={form.errors.title}>
              <Input
                id="title"
                value={form.values.title}
                onChange={(e) => form.setField('title', e.target.value)}
                placeholder="Ex. Fuite sous l’évier cuisine"
                invalid={!!form.errors.title}
              />
            </FormField>

            <FormField
              name="description"
              label="Description"
              required
              error={form.errors.description}
            >
              <Textarea
                id="description"
                rows={4}
                value={form.values.description}
                onChange={(e) => form.setField('description', e.target.value)}
                placeholder="Décrivez le problème en détail…"
                invalid={!!form.errors.description}
              />
            </FormField>

            <FormField name="priority" label="Priorité" required>
              <Select
                id="priority"
                value={form.values.priority}
                onChange={(e) =>
                  form.setField(
                    'priority',
                    e.target.value as FormValues['priority'],
                  )
                }
              >
                <option value="LOW">Basse</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="HIGH">Haute</option>
                <option value="URGENT">Urgente</option>
              </Select>
            </FormField>
          </form>
        </FormCard>
      </FormLayout>
    </div>
  );
}
