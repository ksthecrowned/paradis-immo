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
  PhoneInput,
  getPhoneE164,
  isPhoneComplete,
  SelectSearch,
  TipBox,
} from '@/components/forms';
import { useRequireSession } from '@/hooks/use-require-session';
import { useResourceForm } from '@/hooks/use-resource-form';
import { ApiError } from '@/lib/api';
import {
  DEFAULT_PHONE_COUNTRY,
  type PhoneCountrySelection,
} from '@/lib/phone';
import { listManagedProperties } from '@/lib/agent/portfolio';
import {
  createLease,
  lookupUserByPhone,
  updateLease,
  type PublicLease,
} from '@/lib/owner/leases';
import { listMyProperties } from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  parseNumeric,
  validateRequired,
} from '@/lib/validation';

type FormValues = {
  propertyId: string;
  tenantPhoneNational: string;
  tenantName: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
  currency: string;
  dueDay: string;
  chargesAmount: string;
  chargesMode: string;
  noticeMonthsTenant: string;
  noticeMonthsLandlord: string;
  indexationRate: string;
  lateFeeAfterDays: string;
  lateFeeAmount: string;
  autoRenew: string;
};

const defaultValues = (): FormValues => ({
  propertyId: '',
  tenantPhoneNational: '',
  tenantName: '',
  startDate: '',
  endDate: '',
  monthlyRent: '',
  deposit: '',
  currency: 'XAF',
  dueDay: '5',
  chargesAmount: '0',
  chargesMode: 'FLAT',
  noticeMonthsTenant: '3',
  noticeMonthsLandlord: '6',
  indexationRate: '',
  lateFeeAfterDays: '',
  lateFeeAmount: '',
  autoRenew: 'yes',
});

const validate = (
  v: FormValues,
  country: PhoneCountrySelection,
): Record<string, string> => {
  const e: Record<string, string> = {};
  e.propertyId = validateRequired(v.propertyId, 'Le bien') ?? '';
  if (!isPhoneComplete(v.tenantPhoneNational, country)) {
    e.tenantPhoneNational = 'Numéro de téléphone invalide.';
  }
  const name = v.tenantName.trim();
  if (!name || name.length < 2) {
    e.tenantName = 'Indiquez le nom du locataire (2 caractères min.).';
  }
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

  const dueDay = parseNumeric(v.dueDay);
  if (dueDay === null || dueDay < 1 || dueDay > 28) {
    e.dueDay = 'Le jour d’échéance doit être compris entre 1 et 28.';
  }
  if (v.chargesAmount.trim() && (parseNumeric(v.chargesAmount) ?? -1) < 0) {
    e.chargesAmount = 'Le montant des charges est invalide.';
  }
  const noticeFields = [
    ['noticeMonthsTenant', 'Le préavis locataire'],
    ['noticeMonthsLandlord', 'Le préavis bailleur'],
  ] as const;
  for (const [field, label] of noticeFields) {
    const n = parseNumeric(v[field]);
    if (n === null || n < 0 || n > 24) e[field] = `${label} est invalide.`;
  }
  if (v.indexationRate.trim()) {
    const rate = parseNumeric(v.indexationRate);
    if (rate === null || rate <= 0 || rate > 1) {
      e.indexationRate =
        'Le taux doit être compris entre 0 et 1 (0,03 = +3 %).';
    }
  }
  if (v.lateFeeAfterDays.trim() && (parseNumeric(v.lateFeeAfterDays) ?? -1) < 0) {
    e.lateFeeAfterDays = 'Le délai de pénalité est invalide.';
  }
  if (v.lateFeeAmount.trim() && (parseNumeric(v.lateFeeAmount) ?? -1) < 0) {
    e.lateFeeAmount = 'Le montant de la pénalité est invalide.';
  }
  return e;
};

export type LeaseFormProps = {
  initial?: Partial<FormValues> & { tenantPhoneE164?: string };
  initialPhoneCountry?: PhoneCountrySelection;
  leaseId?: string;
  submitLabel: string;
  onCancel?: () => void;
  role?: 'owner' | 'agent';
};

export function LeaseForm({
  initial,
  initialPhoneCountry,
  leaseId,
  submitLabel,
  onCancel,
  role = 'owner',
}: LeaseFormProps): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const leaseDetail =
    role === 'agent' ? ROUTES.agent.lease : ROUTES.owner.lease;
  const leasesList =
    role === 'agent' ? ROUTES.agent.leases : ROUTES.owner.leases;
  const [properties, setProperties] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountrySelection>(
    initialPhoneCountry ?? DEFAULT_PHONE_COUNTRY,
  );
  const [tenantPreview, setTenantPreview] = useState<{
    name: string | null;
    phone: string;
  } | null>(null);
  /** null = not checked yet; true/false = lookup result */
  const [accountFound, setAccountFound] = useState<boolean | null>(
    initial?.tenantName ? true : null,
  );
  const [lookupHint, setLookupHint] = useState<string | null>(null);

  const form = useResourceForm<FormValues>({
    initial: {
      ...defaultValues(),
      ...initial,
      tenantPhoneNational: initial?.tenantPhoneNational ?? '',
      tenantName: initial?.tenantName ?? '',
    },
    validate: (v) => validate(v, phoneCountry),
    onSubmit: async (values) => {
      const e164 = getPhoneE164(values.tenantPhoneNational, phoneCountry);
      if (!e164) throw new Error('Numéro invalide');
      const tenantName = values.tenantName.trim();
      const optional = (raw: string): number | undefined => {
        const trimmed = raw.trim();
        return trimmed === '' ? undefined : Number(trimmed);
      };
      const payload = {
        propertyId: values.propertyId,
        // Spec 04: the phone is an invitation target. Unknown numbers are
        // never turned into a `User` behind the scenes.
        invitedPhone: e164,
        ...(tenantName ? { tenantName } : {}),
        startDate: values.startDate,
        endDate: values.endDate,
        monthlyRent: Number(values.monthlyRent),
        deposit: Number(values.deposit),
        currency: values.currency.trim().toUpperCase(),
        dueDay: Number(values.dueDay),
        chargesAmount: Number(values.chargesAmount || 0),
        chargesMode:
          values.chargesMode === 'PROVISION'
            ? ('PROVISION' as const)
            : ('FLAT' as const),
        noticeMonthsTenant: Number(values.noticeMonthsTenant),
        noticeMonthsLandlord: Number(values.noticeMonthsLandlord),
        ...(optional(values.indexationRate) !== undefined
          ? { indexationRate: optional(values.indexationRate) }
          : {}),
        ...(optional(values.lateFeeAfterDays) !== undefined
          ? { lateFeeAfterDays: optional(values.lateFeeAfterDays) }
          : {}),
        ...(optional(values.lateFeeAmount) !== undefined
          ? { lateFeeAmount: optional(values.lateFeeAmount) }
          : {}),
        autoRenew: values.autoRenew === 'yes',
      };
      if (leaseId) {
        const { propertyId: _p, ...update } = payload;
        const lease = await updateLease(leaseId, update);
        router.push(leaseDetail(lease.id));
        return;
      }
      const lease = await createLease(payload);
      router.push(leaseDetail(lease.id));
    },
  });

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows =
          role === 'agent'
            ? await listManagedProperties()
            : await listMyProperties();
        if (!cancelled) {
          setProperties(rows.map((p) => ({ id: p.id, title: p.title })));
        }
      } catch {
        if (!cancelled) setProperties([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, role]);

  const resolveTenant = async (): Promise<void> => {
    setLookupHint(null);
    setTenantPreview(null);
    setAccountFound(null);
    if (!isPhoneComplete(form.values.tenantPhoneNational, phoneCountry)) return;
    const e164 = getPhoneE164(form.values.tenantPhoneNational, phoneCountry);
    if (!e164) return;
    try {
      const user = await lookupUserByPhone(e164);
      setAccountFound(user.exists);
      if (user.exists) {
        setTenantPreview({ name: user.displayName, phone: user.phone });
        // The API only returns a masked name ("Jean M."), so the real tenant
        // name is never prefilled from it.
        setLookupHint(null);
      } else {
        setTenantPreview(null);
        setLookupHint(
          'Pas de compte Paradis Immo : le locataire sera invité par WhatsApp à créer son compte et à signer le bail.',
        );
      }
    } catch (err) {
      setTenantPreview(null);
      setAccountFound(null);
      setLookupHint(
        err instanceof ApiError
          ? err.message
          : 'Impossible de vérifier ce numéro.',
      );
    }
  };

  if (!ready) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  const sidebar = (
    <FormSidebar
      sections={[
        {
          title: 'À propos',
          icon: 'mdi:information-outline',
          children: (
            <p className="text-sm text-muted">
              {leaseId
                ? 'Modifiez ce bail brouillon. Une fois activé, les montants et dates ne pourront plus être changés.'
                : 'Vous allez créer un bail en brouillon. Il pourra être activé depuis la page du bail.'}
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
                  icon: 'mdi:cellphone',
                  title: 'Locataire inscrit ou non',
                  body: 'Avec un compte existant, le profil est reconnu. Sinon, indiquez le nom : le locataire reçoit une invitation WhatsApp et le compte n’est créé qu’à son acceptation.',
                },
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
              onCancel={onCancel ?? (() => router.push(leasesList))}
              submitLabel={submitLabel}
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
                disabled={properties.length === 0 || Boolean(leaseId)}
                invalid={!!form.errors.propertyId}
              />
            </FormField>

            <FormField
              name="tenantPhoneNational"
              label="Téléphone du locataire"
              required
              error={form.errors.tenantPhoneNational}
            >
              <PhoneInput
                name="tenantPhoneNational"
                label=""
                value={form.values.tenantPhoneNational}
                country={phoneCountry}
                onCountryChange={setPhoneCountry}
                onChange={(v) => {
                  form.setField('tenantPhoneNational', v);
                  setTenantPreview(null);
                  setAccountFound(null);
                  setLookupHint(null);
                }}
                required
                invalid={!!form.errors.tenantPhoneNational}
                hint="Indicatif pays + numéro national"
              />
              <button
                type="button"
                onClick={() => void resolveTenant()}
                className="mt-2 text-sm font-medium text-accent hover:underline"
              >
                Vérifier le compte
              </button>
              {tenantPreview ? (
                <p className="mt-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-foreground">
                  Compte trouvé :{' '}
                  <strong>{tenantPreview.name ?? 'Sans nom'}</strong> (
                  {tenantPreview.phone})
                </p>
              ) : null}
              {lookupHint ? (
                <p
                  className={`mt-2 rounded-md border px-3 py-2 text-sm ${
                    accountFound === false
                      ? 'border-accent/30 bg-accent/10 text-foreground'
                      : 'border-danger/30 bg-danger/10 text-danger'
                  }`}
                >
                  {lookupHint}
                </p>
              ) : null}
            </FormField>

            <FormField
              name="tenantName"
              label="Nom du locataire"
              required
              error={form.errors.tenantName}
            >
              <Input
                id="tenantName"
                value={form.values.tenantName}
                onChange={(e) => form.setField('tenantName', e.target.value)}
                placeholder="Prénom et nom"
                invalid={!!form.errors.tenantName}
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
              <FormField
                name="currency"
                label="Devise"
                required
                error={form.errors.currency}
              >
                <Input
                  id="currency"
                  value={form.values.currency}
                  onChange={(e) => form.setField('currency', e.target.value)}
                  maxLength={3}
                  invalid={!!form.errors.currency}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                name="dueDay"
                label="Jour d’échéance"
                required
                error={form.errors.dueDay}
              >
                <NumberInput
                  name="dueDay"
                  min={1}
                  max={28}
                  value={form.values.dueDay}
                  onChange={(v) => form.setField('dueDay', v)}
                  invalid={!!form.errors.dueDay}
                />
              </FormField>
              <FormField
                name="chargesAmount"
                label="Charges mensuelles"
                error={form.errors.chargesAmount}
              >
                <NumberInput
                  name="chargesAmount"
                  min={0}
                  value={form.values.chargesAmount}
                  onChange={(v) => form.setField('chargesAmount', v)}
                  invalid={!!form.errors.chargesAmount}
                />
              </FormField>
              <FormField
                name="chargesMode"
                label="Mode des charges"
                error={form.errors.chargesMode}
              >
                <SelectSearch
                  name="chargesMode"
                  value={form.values.chargesMode}
                  onChange={(v) => form.setField('chargesMode', v)}
                  options={[
                    { value: 'FLAT', label: 'Forfait' },
                    { value: 'PROVISION', label: 'Provision' },
                  ]}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                name="noticeMonthsTenant"
                label="Préavis locataire (mois)"
                required
                error={form.errors.noticeMonthsTenant}
              >
                <NumberInput
                  name="noticeMonthsTenant"
                  min={0}
                  max={24}
                  value={form.values.noticeMonthsTenant}
                  onChange={(v) => form.setField('noticeMonthsTenant', v)}
                  invalid={!!form.errors.noticeMonthsTenant}
                />
              </FormField>
              <FormField
                name="noticeMonthsLandlord"
                label="Préavis bailleur (mois)"
                required
                error={form.errors.noticeMonthsLandlord}
              >
                <NumberInput
                  name="noticeMonthsLandlord"
                  min={0}
                  max={24}
                  value={form.values.noticeMonthsLandlord}
                  onChange={(v) => form.setField('noticeMonthsLandlord', v)}
                  invalid={!!form.errors.noticeMonthsLandlord}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                name="indexationRate"
                label="Révision annuelle (0,03 = +3 %)"
                error={form.errors.indexationRate}
              >
                <NumberInput
                  name="indexationRate"
                  min={0}
                  step={0.005}
                  value={form.values.indexationRate}
                  onChange={(v) => form.setField('indexationRate', v)}
                  invalid={!!form.errors.indexationRate}
                />
              </FormField>
              <FormField
                name="lateFeeAfterDays"
                label="Pénalité après (jours)"
                error={form.errors.lateFeeAfterDays}
              >
                <NumberInput
                  name="lateFeeAfterDays"
                  min={0}
                  value={form.values.lateFeeAfterDays}
                  onChange={(v) => form.setField('lateFeeAfterDays', v)}
                  invalid={!!form.errors.lateFeeAfterDays}
                />
              </FormField>
              <FormField
                name="lateFeeAmount"
                label="Pénalité (montant)"
                error={form.errors.lateFeeAmount}
              >
                <NumberInput
                  name="lateFeeAmount"
                  min={0}
                  value={form.values.lateFeeAmount}
                  onChange={(v) => form.setField('lateFeeAmount', v)}
                  invalid={!!form.errors.lateFeeAmount}
                />
              </FormField>
            </div>

            <FormField
              name="autoRenew"
              label="Reconduction tacite"
              error={form.errors.autoRenew}
            >
              <SelectSearch
                name="autoRenew"
                value={form.values.autoRenew}
                onChange={(v) => form.setField('autoRenew', v)}
                options={[
                  { value: 'yes', label: 'Oui' },
                  { value: 'no', label: 'Non' },
                ]}
              />
            </FormField>
          </form>
        </FormCard>
      </FormLayout>
    </div>
  );
}

/** Prefill helper for edit page from an existing lease. */
export function leaseToFormInitial(lease: PublicLease): Partial<FormValues> {
  return {
    propertyId: lease.propertyId,
    tenantName: lease.tenantName ?? '',
    startDate: lease.startDate.slice(0, 10),
    endDate: lease.endDate.slice(0, 10),
    monthlyRent: String(Number(lease.monthlyRent)),
    deposit: String(Number(lease.deposit)),
    currency: lease.currency,
    dueDay: String(lease.dueDay),
    chargesAmount: String(Number(lease.chargesAmount)),
    chargesMode: lease.chargesMode,
    noticeMonthsTenant: String(lease.noticeMonthsTenant),
    noticeMonthsLandlord: String(lease.noticeMonthsLandlord),
    indexationRate: lease.indexationRate
      ? String(Number(lease.indexationRate))
      : '',
    lateFeeAfterDays:
      lease.lateFeeAfterDays === null ? '' : String(lease.lateFeeAfterDays),
    lateFeeAmount: lease.lateFeeAmount
      ? String(Number(lease.lateFeeAmount))
      : '',
    autoRenew: lease.autoRenew ? 'yes' : 'no',
  };
}
