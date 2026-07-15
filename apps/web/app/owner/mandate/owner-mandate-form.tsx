'use client';

import { DashboardPageHeader } from '@/components/dashboard';
import {
  ApiErrorBanner,
  FormCard,
  FormField,
  FormFooter,
  FormLayout,
  FormSidebar,
  SelectSearch,
  TipBox,
} from '@/components/forms';
import { useRequireSession } from '@/hooks/use-require-session';
import { useResourceForm } from '@/hooks/use-resource-form';
import { createMandate } from '@/lib/owner/mandates';
import { listMyProperties } from '@/lib/owner/properties';
import { listPublicAgencies } from '@/lib/public/agencies';
import { ROUTES } from '@/lib/routes';
import { validateRequired } from '@/lib/validation';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type FormValues = {
  propertyId: string;
  organizationId: string;
};

const defaultValues = (): FormValues => ({
  propertyId: '',
  organizationId: '',
});

const validate = (v: FormValues): Record<string, string> => {
  const e: Record<string, string> = {};
  e.propertyId = validateRequired(v.propertyId, 'Le bien') ?? '';
  e.organizationId = validateRequired(v.organizationId, 'L’agence') ?? '';
  return e;
};

export function OwnerMandateForm(): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [properties, setProperties] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [organizations, setOrganizations] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const form = useResourceForm<FormValues>({
    initial: defaultValues(),
    validate,
    onSubmit: async (values) => {
      await createMandate({
        propertyId: values.propertyId.trim(),
        organizationId: values.organizationId.trim(),
      });
      router.push(ROUTES.owner.mandate);
    },
  });

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const [props, agencies] = await Promise.all([
          listMyProperties(),
          listPublicAgencies(),
        ]);
        if (cancelled) return;
        const propList = props.map((p) => ({ id: p.id, title: p.title }));
        const orgList = agencies.map((o) => ({ id: o.id, name: o.name }));
        setProperties(propList);
        setOrganizations(orgList);
        if (!form.values.propertyId && propList[0]) {
          form.setField('propertyId', propList[0].id);
        }
        if (!form.values.organizationId && orgList[0]) {
          form.setField('organizationId', orgList[0].id);
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
        title="Déléguer un bien"
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.owner.dashboard },
          { label: 'Mes mandats', href: ROUTES.owner.mandate },
          { label: 'Nouveau mandat' },
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
                  <p className="text-sm text-muted">
                    Confiez la gestion d&apos;un bien à une agence partenaire.
                    Vous conserverez la validation des actions sensibles.
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
                        icon: 'mdi:handshake-outline',
                        title: 'Agence de confiance',
                        body: 'Vérifiez que l’agence est bien enregistrée sur Paradis Immo.',
                      },
                      {
                        icon: 'mdi:shield-check-outline',
                        title: 'Approbations',
                        body: 'Les actions importantes reviendront sur la page Mes mandats.',
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
          title="Mandat de gestion"
          hint="Sélectionnez le bien et l’agence mandataire."
          footer={
            <FormFooter
              onSubmit={() => form.handleSubmit()}
              onCancel={() => router.push(ROUTES.owner.mandate)}
              submitLabel="Créer le mandat"
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

            <FormField
              name="organizationId"
              label="Agence"
              required
              error={form.errors.organizationId}
            >
              <SelectSearch
                name="organizationId"
                value={form.values.organizationId}
                onChange={(v) => form.setField('organizationId', v)}
                options={organizations.map((o) => ({
                  value: o.id,
                  label: o.name,
                }))}
                placeholder={
                  organizations.length === 0
                    ? 'Aucune agence disponible'
                    : 'Sélectionner une agence'
                }
                disabled={organizations.length === 0}
                invalid={!!form.errors.organizationId}
              />
            </FormField>
          </form>
        </FormCard>
      </FormLayout>
    </div>
  );
}
