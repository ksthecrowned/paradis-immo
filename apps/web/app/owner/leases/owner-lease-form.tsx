'use client';

import { DashboardPageHeader } from '@/components/dashboard';
import {
  ApiErrorBanner,
  DateField,
  FormCard,
  FormField,
  FormFooter,
  FormLayout,
  FormSidebar,
  Input,
  NumberInput,
  SelectSearch,
  TipBox,
} from '@/components/forms';
import { useRequireSession } from '@/hooks/use-require-session';
import { useResourceForm } from '@/hooks/use-resource-form';
import { ApiError } from '@/lib/api';
import {
  leaseStatusLabel,
  leaseStatusTone,
} from '@/lib/owner/leases';
import { listMyProperties } from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StatusPill } from '@/components/forms/FormSidebar';
import {
  parseNumeric,
  validateRequired,
} from '@/lib/validation';

type FormValues = {
  propertyId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
  currency: string;
};

const defaultValues = (): FormValues => ({
  propertyId: '',
  tenantId: '',
  startDate: '',
  endDate: '',
  monthlyRent: '',
  deposit: '',
  currency: 'XAF',
});

const validate = (v: FormValues): Record<string, string> => {
  const e: Record<string, string> = {};
  e.propertyId = validateRequired(v.propertyId, 'Le bien') ?? '';
  e.tenantId = validateRequired(v.tenantId, 'Le locataire') ?? '';
  e.startDate = validateRequired(v.startDate, 'La date de début') ?? '';
  e.endDate = validateRequired(v.endDate, 'La date de fin') ?? '';
  if (!e.startDate && !e.endDate && v.startDate >= v.endDate) {
    e.endDate = 'La date de fin doit suivre la date de début.';
  }
  e.monthlyRent = validateRequired(v.monthlyRent, 'Le loyer') ?? '';
  if (!e.monthlyRent) {
    const n = parseNumeric(v.monthlyRent);
    if (n === null || n <= 0) e.monthlyRent = 'Le loyer doit être supérieur à 0.';
  }
  e.deposit = validateRequired(v.deposit, 'La caution') ?? '';
  if (!e.deposit) {
    const n = parseNumeric(v.deposit);
    if (n === null || n < 0) e.deposit = 'La caution est invalide.';
  }
  e.currency = validateRequired(v.currency, 'La devise') ?? '';
  return e;
};

const toCreateInput = (v: FormValues) => ({
  propertyId: v.propertyId,
  tenantId: v.tenantId.trim(),
  startDate: v.startDate,
  endDate: v.endDate,
  monthlyRent: Number(v.monthlyRent),
  deposit: Number(v.deposit),
  currency: v.currency.trim().toUpperCase(),
});

export type OwnerLeaseFormProps = {
  initial?: Partial<FormValues>;
  /** When provided, the form edits an existing lease. */
  leaseId?: string;
  initialStatus?: string;
  initialCreatedAt?: string;
  submitLabel: string;
  onCancel?: () => void;
};

export function OwnerLeaseForm({
  initial,
  leaseId,
  initialStatus,
  initialCreatedAt,
  submitLabel,
  onCancel,
}: OwnerLeaseFormProps): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [properties, setProperties] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [status] = useState<string>(initialStatus ?? 'DRAFT');
  const [createdAt] = useState<string | undefined>(initialCreatedAt);

  const form = useResourceForm<FormValues>({
    initial: { ...defaultValues(), ...initial },
    validate,
    onSubmit: async (values) => {
      const { createLease } = await import('@/lib/owner/leases');
      const lease = await createLease(toCreateInput(values));
      router.push(ROUTES.owner.lease(lease.id));
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
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  const statusTone = leaseStatusTone(status);
  const statusIcon =
    status === 'ACTIVE'
      ? 'mdi:check-circle'
      : status === 'TERMINATED'
        ? 'mdi:archive'
        : status === 'CANCELLED'
          ? 'mdi:close-circle'
          : 'mdi:pencil-circle';

  const sidebar = leaseId ? (
    <FormSidebar
      sections={[
        {
          title: 'Statut',
          icon: 'mdi:flag-variant-outline',
          children: (
            <div className="flex flex-col gap-2">
              <StatusPill
                label={leaseStatusLabel(status)}
                tone={statusTone}
                icon={statusIcon}
              />
              <p className="text-xs text-muted">
                {status === 'DRAFT' &&
                  'Ce bail n’est pas encore actif. Activez-le une fois les deux parties d’accord.'}
                {status === 'ACTIVE' &&
                  'Le bail est en cours d’exécution. Les paiements sont planifiés.'}
                {status === 'TERMINATED' &&
                  'Le bail s’est terminé à la date de fin prévue.'}
                {status === 'CANCELLED' &&
                  'Le bail a été annulé avant son terme.'}
              </p>
            </div>
          ),
        },
        {
          title: 'Métadonnées',
          icon: 'mdi:information-outline',
          children: (
            <div className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted">Référence</span>
                <span className="font-mono text-xs text-foreground">
                  {leaseId.slice(0, 8)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted">Créé le</span>
                <span className="text-foreground">
                  {createdAt
                    ? new Date(createdAt).toLocaleDateString('fr-FR')
                    : '—'}
                </span>
              </div>
            </div>
          ),
        },
      ]}
    />
  ) : (
    <FormSidebar
      sections={[
        {
          title: 'À propos',
          icon: 'mdi:information-outline',
          children: (
            <p className="text-sm text-muted">
              Vous allez créer un bail en <strong>brouillon</strong>. Il
              pourra être activé depuis la page du bail une fois les deux
              parties d’accord.
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
                  icon: 'mdi:calendar-range',
                  title: 'Dates cohérentes',
                  body: 'La date de fin doit toujours suivre la date de début.',
                },
                {
                  icon: 'mdi:shield-check-outline',
                  title: 'Caution raisonnable',
                  body: 'Une caution équivalente à 1 à 3 mois de loyer est la norme.',
                },
                {
                  icon: 'mdi:account-multiple-outline',
                  title: 'Locataire inscrit',
                  body: 'Le locataire doit avoir un compte Paradis Immo. Demandez-lui son identifiant.',
                },
              ]}
            />
          ),
        },
      ]}
    />
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={leaseId ? 'Modifier le bail' : 'Créer un bail'}
      />
      <ApiErrorBanner message={form.submitError} />
      <FormLayout sidebar={sidebar}>
        <FormCard
          title="Informations du bail"
          hint="Les champs marqués d'un astérisque sont obligatoires."
          footer={
            <FormFooter
              onSubmit={() => form.handleSubmit()}
              onCancel={onCancel ?? (() => router.push(ROUTES.owner.leases))}
              submitLabel={submitLabel}
              saving={form.saving}
            />
          }
        >
          <form onSubmit={(e) => void form.handleSubmit(e)} className="space-y-4">
            <FormField name="propertyId" label="Bien" required error={form.errors.propertyId}>
              <SelectSearch
                name="propertyId"
                value={form.values.propertyId}
                onChange={(v) => form.setField('propertyId', v)}
                options={properties.map((p) => ({ value: p.id, label: p.title }))}
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
              name="tenantId"
              label="Identifiant du locataire"
              required
              error={form.errors.tenantId}
              hint="Le locataire doit déjà avoir un compte sur Paradis Immo."
            >
              <Input
                id="tenantId"
                value={form.values.tenantId}
                onChange={(e) => form.setField('tenantId', e.target.value)}
                placeholder="UUID du compte locataire"
                className="font-mono text-sm"
                invalid={!!form.errors.tenantId}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                name="startDate"
                label="Date de début"
                required
                error={form.errors.startDate}
              >
                <DateField
                  id="startDate"
                  value={form.values.startDate}
                  onChange={(e) => form.setField('startDate', e.target.value)}
                  invalid={!!form.errors.startDate}
                />
              </FormField>
              <FormField
                name="endDate"
                label="Date de fin"
                required
                error={form.errors.endDate}
              >
                <DateField
                  id="endDate"
                  value={form.values.endDate}
                  onChange={(e) => form.setField('endDate', e.target.value)}
                  invalid={!!form.errors.endDate}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                name="monthlyRent"
                label="Loyer mensuel"
                required
                error={form.errors.monthlyRent}
              >
                <NumberInput
                  name="monthlyRent"
                  min={0}
                  value={form.values.monthlyRent}
                  onChange={(v) => form.setField('monthlyRent', v)}
                  invalid={!!form.errors.monthlyRent}
                />
              </FormField>
              <FormField
                name="deposit"
                label="Caution"
                required
                error={form.errors.deposit}
              >
                <NumberInput
                  name="deposit"
                  min={0}
                  value={form.values.deposit}
                  onChange={(v) => form.setField('deposit', v)}
                  invalid={!!form.errors.deposit}
                />
              </FormField>
              <FormField name="currency" label="Devise" required error={form.errors.currency}>
                <Input
                  id="currency"
                  value={form.values.currency}
                  onChange={(e) => form.setField('currency', e.target.value)}
                  maxLength={3}
                  invalid={!!form.errors.currency}
                />
              </FormField>
            </div>
          </form>
        </FormCard>
      </FormLayout>
    </div>
  );
}
