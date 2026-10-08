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
  scopes: string[];
  exclusive: boolean;
  /** Pourcentage saisi par l'utilisateur, ex. « 8 » pour 8 %. */
  managementFeeRatePct: string;
  saleCommissionRatePct: string;
  stayCommissionRatePct: string;
  lettingFee: string;
  repairApprovalThreshold: string;
  minSalePrice: string;
  endDate: string;
  noticeDays: string;
  approvalTtlDays: string;
  tacitRenewal: boolean;
  rentChangeRequiresApproval: boolean;
  leaseSignRequiresApproval: boolean;
};

const SCOPE_OPTIONS = [
  { value: 'LONG_TERM_RENTAL', label: 'Location longue' },
  { value: 'SHORT_STAY', label: 'Séjours' },
  { value: 'SALE', label: 'Vente' },
];

const defaultValues = (): FormValues => ({
  propertyId: '',
  organizationId: '',
  scopes: ['LONG_TERM_RENTAL'],
  exclusive: false,
  managementFeeRatePct: '8',
  saleCommissionRatePct: '',
  stayCommissionRatePct: '',
  lettingFee: '',
  repairApprovalThreshold: '',
  minSalePrice: '',
  endDate: '',
  noticeDays: '30',
  approvalTtlDays: '7',
  tacitRenewal: true,
  rentChangeRequiresApproval: true,
  leaseSignRequiresApproval: true,
});

function validateNumber(value: string, label: string, min = 0): string | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < min) {
    return `${label} doit être un nombre positif`;
  }
  return undefined;
}

const validate = (v: FormValues): Record<string, string> => {
  const e: Record<string, string> = {};
  e.propertyId = validateRequired(v.propertyId, 'Le bien') ?? '';
  e.organizationId = validateRequired(v.organizationId, 'L’agence') ?? '';
  if (v.scopes.length === 0) {
    e.scopes = 'Sélectionnez au moins un périmètre';
  }
  e.managementFeeRatePct =
    validateNumber(v.managementFeeRatePct, 'La commission de gestion', 0) ?? '';
  e.saleCommissionRatePct =
    validateNumber(v.saleCommissionRatePct, 'La commission de vente', 0) ?? '';
  e.stayCommissionRatePct =
    validateNumber(v.stayCommissionRatePct, 'La commission séjours', 0) ?? '';
  e.lettingFee = validateNumber(v.lettingFee, 'Le montant') ?? '';
  e.repairApprovalThreshold =
    validateNumber(v.repairApprovalThreshold, 'Le seuil') ?? '';
  e.minSalePrice = validateNumber(v.minSalePrice, 'Le prix minimum') ?? '';
  e.noticeDays = validateNumber(v.noticeDays, 'Le préavis (jours)', 0) ?? '';
  e.approvalTtlDays = validateNumber(v.approvalTtlDays, 'Le délai (jours)', 1) ?? '';
  return e;
};

export function OwnerMandateForm(): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [properties, setProperties] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [organizations, setOrganizations] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const form = useResourceForm<FormValues>({
    initial: defaultValues(),
    validate,
    onSubmit: async (values) => {
      const pct = (value: string) =>
        value.trim() === '' ? undefined : Number(value) / 100;
      const num = (value: string) =>
        value.trim() === '' ? undefined : Number(value);
      await createMandate({
        propertyId: values.propertyId.trim(),
        organizationId: values.organizationId.trim(),
        scopes: values.scopes,
        exclusive: values.exclusive,
        managementFeeRate: pct(values.managementFeeRatePct),
        saleCommissionRate: pct(values.saleCommissionRatePct),
        stayCommissionRate: pct(values.stayCommissionRatePct),
        lettingFee: num(values.lettingFee),
        repairApprovalThreshold: num(values.repairApprovalThreshold),
        minSalePrice: num(values.minSalePrice),
        noticeDays: num(values.noticeDays),
        approvalTtlDays: num(values.approvalTtlDays),
        tacitRenewal: values.tacitRenewal,
        rentChangeRequiresApproval: values.rentChangeRequiresApproval,
        leaseSignRequiresApproval: values.leaseSignRequiresApproval,
        ...(values.endDate ? { endDate: new Date(values.endDate).toISOString() } : {}),
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
        // Recherche par zone : le libellé embarque la ville (SelectSearch
        // filtre sur le texte affiché).
        const orgList = agencies
          .map((o) => ({
            value: o.id,
            label: o.cityLabel ? `${o.name} — ${o.cityLabel}` : o.name,
          }));
        setProperties(propList);
        setOrganizations(orgList);
        if (!form.values.propertyId && propList[0]) {
          form.setField('propertyId', propList[0].id);
        }
        if (!form.values.organizationId && orgList[0]) {
          form.setField('organizationId', orgList[0].value);
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

  const toggleScope = (scope: string): void => {
    const next = form.values.scopes.includes(scope)
      ? form.values.scopes.filter((s) => s !== scope)
      : [...form.values.scopes, scope];
    form.setField('scopes', next);
  };

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
                        icon: 'mdi:percent',
                        title: 'Commission',
                        body: 'La gestion locative est en % des loyers encaissés (8 % par défaut).',
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
          hint="Bien, agence, périmètres, commission et seuils d’approbation."
          footer={
            <FormFooter
              onSubmit={() => form.handleSubmit()}
              onCancel={() => router.push(ROUTES.owner.mandate)}
              submitLabel="Proposer le mandat"
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
                options={organizations}
                placeholder={
                  organizations.length === 0
                    ? 'Aucune agence disponible'
                    : 'Rechercher une agence (nom ou zone)…'
                }
                disabled={organizations.length === 0}
                invalid={!!form.errors.organizationId}
              />
            </FormField>

            <FormField
              name="scopes"
              label="Périmètres"
              required
              error={form.errors.scopes}
            >
              <div className="flex flex-wrap gap-3">
                {SCOPE_OPTIONS.map((scope) => (
                  <label
                    key={scope.value}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={form.values.scopes.includes(scope.value)}
                      onChange={() => toggleScope(scope.value)}
                    />
                    {scope.label}
                  </label>
                ))}
              </div>
            </FormField>

            <FormField name="exclusive" label="Exclusivité">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.values.exclusive}
                  onChange={(e) => form.setField('exclusive', e.target.checked)}
                />
                Mandat exclusif (bloque tout autre mandat sur ces périmètres)
              </label>
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                name="managementFeeRatePct"
                label="Commission gestion (%)"
                error={form.errors.managementFeeRatePct}
              >
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.values.managementFeeRatePct}
                  onChange={(e) =>
                    form.setField('managementFeeRatePct', e.target.value)
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </FormField>
              <FormField
                name="saleCommissionRatePct"
                label="Commission vente (%)"
                error={form.errors.saleCommissionRatePct}
              >
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.values.saleCommissionRatePct}
                  onChange={(e) =>
                    form.setField('saleCommissionRatePct', e.target.value)
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </FormField>
              <FormField
                name="stayCommissionRatePct"
                label="Commission séjours (%)"
                error={form.errors.stayCommissionRatePct}
              >
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.values.stayCommissionRatePct}
                  onChange={(e) =>
                    form.setField('stayCommissionRatePct', e.target.value)
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                name="lettingFee"
                label="Honoraires mise en location (XAF)"
                error={form.errors.lettingFee}
              >
                <input
                  type="number"
                  min="0"
                  value={form.values.lettingFee}
                  onChange={(e) => form.setField('lettingFee', e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </FormField>
              <FormField
                name="repairApprovalThreshold"
                label="Seuil réparation (XAF)"
                error={form.errors.repairApprovalThreshold}
              >
                <input
                  type="number"
                  min="0"
                  value={form.values.repairApprovalThreshold}
                  onChange={(e) =>
                    form.setField('repairApprovalThreshold', e.target.value)
                  }
                  placeholder="Au-delà : votre approbation"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </FormField>
              <FormField
                name="minSalePrice"
                label="Prix de vente min. (XAF)"
                error={form.errors.minSalePrice}
              >
                <input
                  type="number"
                  min="0"
                  value={form.values.minSalePrice}
                  onChange={(e) =>
                    form.setField('minSalePrice', e.target.value)
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField name="endDate" label="Échéance">
                <input
                  type="date"
                  value={form.values.endDate}
                  onChange={(e) => form.setField('endDate', e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </FormField>
              <FormField
                name="noticeDays"
                label="Préavis (jours)"
                error={form.errors.noticeDays}
              >
                <input
                  type="number"
                  min="0"
                  value={form.values.noticeDays}
                  onChange={(e) => form.setField('noticeDays', e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </FormField>
              <FormField
                name="approvalTtlDays"
                label="Délai d’approbation (jours)"
                error={form.errors.approvalTtlDays}
              >
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={form.values.approvalTtlDays}
                  onChange={(e) =>
                    form.setField('approvalTtlDays', e.target.value)
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </FormField>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.values.tacitRenewal}
                  onChange={(e) =>
                    form.setField('tacitRenewal', e.target.checked)
                  }
                />
                Renouvellement tacite à l’échéance
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.values.rentChangeRequiresApproval}
                  onChange={(e) =>
                    form.setField('rentChangeRequiresApproval', e.target.checked)
                  }
                />
                Toute baisse de loyer exige mon approbation
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.values.leaseSignRequiresApproval}
                  onChange={(e) =>
                    form.setField('leaseSignRequiresApproval', e.target.checked)
                  }
                />
                La signature d’un bail exige mon approbation
              </label>
            </div>
          </form>
        </FormCard>
      </FormLayout>
    </div>
  );
}
