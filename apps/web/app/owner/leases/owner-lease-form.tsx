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
  return e;
};

export type OwnerLeaseFormProps = {
  initial?: Partial<FormValues> & { tenantPhoneE164?: string };
  initialPhoneCountry?: PhoneCountrySelection;
  leaseId?: string;
  submitLabel: string;
  onCancel?: () => void;
};

export function OwnerLeaseForm({
  initial,
  initialPhoneCountry,
  leaseId,
  submitLabel,
  onCancel,
}: OwnerLeaseFormProps): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
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
      const payload = {
        propertyId: values.propertyId,
        tenantPhone: e164,
        ...(tenantName ? { tenantName } : {}),
        startDate: values.startDate,
        endDate: values.endDate,
        monthlyRent: Number(values.monthlyRent),
        deposit: Number(values.deposit),
        currency: values.currency.trim().toUpperCase(),
      };
      if (leaseId) {
        const { propertyId: _p, ...update } = payload;
        const lease = await updateLease(leaseId, update);
        router.push(ROUTES.owner.lease(lease.id));
        return;
      }
      const lease = await createLease(payload);
      router.push(ROUTES.owner.lease(lease.id));
    },
  });

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listMyProperties();
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
  }, [ready]);

  const resolveTenant = async (): Promise<void> => {
    setLookupHint(null);
    setTenantPreview(null);
    setAccountFound(null);
    if (!isPhoneComplete(form.values.tenantPhoneNational, phoneCountry)) return;
    const e164 = getPhoneE164(form.values.tenantPhoneNational, phoneCountry);
    if (!e164) return;
    try {
      const user = await lookupUserByPhone(e164);
      setAccountFound(true);
      setTenantPreview({ name: user.name, phone: user.phone });
      if (user.name && !form.values.tenantName.trim()) {
        form.setField('tenantName', user.name);
      }
      setLookupHint(null);
    } catch (err) {
      setTenantPreview(null);
      if (err instanceof ApiError && err.status === 404) {
        setAccountFound(false);
        setLookupHint(
          'Pas de compte Paradis Immo : un profil locataire sera créé avec le nom indiqué.',
        );
        return;
      }
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
                  body: 'Avec un compte existant, le profil est reconnu. Sinon, indiquez le nom : un profil minimal sera créé (connexion OTP possible plus tard).',
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
              onCancel={onCancel ?? (() => router.push(ROUTES.owner.leases))}
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
          </form>
        </FormCard>
      </FormLayout>
    </div>
  );
}

/** Prefill helper for edit page from an existing lease. */
export function leaseToFormInitial(lease: PublicLease): Partial<{
  propertyId: string;
  tenantName: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
  currency: string;
}> {
  return {
    propertyId: lease.propertyId,
    tenantName: lease.tenantName ?? '',
    startDate: lease.startDate.slice(0, 10),
    endDate: lease.endDate.slice(0, 10),
    monthlyRent: String(Number(lease.monthlyRent)),
    deposit: String(Number(lease.deposit)),
    currency: lease.currency,
  };
}
