'use client';

import {
  getAgencyStorefront,
  updateAgencyStorefront,
  type AgencyStorefrontProfile,
  type UpdateAgencyStorefront,
} from '@/lib/agent/storefront';
import {
  agencyStorefrontNeedsSetup,
  setAgencyStorefrontCompleteCached,
} from '@/lib/agent/storefront-gate-storage';
import { ApiError } from '@/lib/api';
import { listMyOrganizations, type PublicOrganization } from '@/lib/me';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';

type StorefrontForm = {
  [Field in keyof UpdateAgencyStorefront]: string;
};

const EMPTY_FORM: StorefrontForm = {
  name: '',
  shortName: '',
  tagline: '',
  description: '',
  address: '',
  cityLabel: '',
  phone: '',
  email: '',
};

function profileToForm(profile: AgencyStorefrontProfile): StorefrontForm {
  return {
    name: profile.name,
    shortName: profile.shortName ?? '',
    tagline: profile.tagline ?? '',
    description: profile.description ?? '',
    address: profile.address ?? '',
    cityLabel: profile.cityLabel ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
  };
}

export type AgencyStorefrontFormProps = {
  /** Called when every admin agency has a public short name. */
  onComplete?: () => void;
  /** Submit button label when idle. */
  submitLabel?: string;
  className?: string;
};

export function AgencyStorefrontForm({
  onComplete,
  submitLabel = 'Enregistrer',
  className,
}: AgencyStorefrontFormProps): React.JSX.Element {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? '';
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const [organizations, setOrganizations] = useState<PublicOrganization[]>([]);
  const [organizationRetry, setOrganizationRetry] = useState(0);
  const [organizationLoadFailed, setOrganizationLoadFailed] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);
  const [profileRetry, setProfileRetry] = useState(0);
  const [form, setForm] = useState<StorefrontForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listMyOrganizations()
      .then((rows) => {
        if (cancelled) return;
        setOrganizationLoadFailed(false);
        const adminAgencies = rows.filter(
          (organization) =>
            organization.type === 'AGENCY' &&
            organization.memberRole === 'ADMIN',
        );
        setOrganizations(adminAgencies);
        const first =
          adminAgencies.find((organization) => !organization.shortName?.trim()) ??
          adminAgencies[0];
        if (first) setOrganizationId(first.id);
        else {
          setLoading(false);
          if (userId) setAgencyStorefrontCompleteCached(userId, true);
          onCompleteRef.current?.();
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setOrganizationLoadFailed(true);
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Impossible de charger vos agences.',
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizationRetry, userId]);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setLoading(true);
        setError(null);
        return getAgencyStorefront(organizationId);
      })
      .then((profile) => {
        if (!cancelled && profile) {
          setForm(profileToForm(profile));
          setLoadedProfileId(profile.id);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Impossible de charger la vitrine de cette agence.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, profileRetry]);

  const save = useCallback(async () => {
    const shortName = form.shortName.trim();
    if (!shortName) {
      setError('Le nom public de la vitrine est obligatoire.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const savedProfile = await updateAgencyStorefront(organizationId, {
        ...form,
        name: form.name.trim(),
        shortName,
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        cityLabel: form.cityLabel.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      });
      setForm(profileToForm(savedProfile));
      let refreshed: PublicOrganization[];
      try {
        refreshed = await listMyOrganizations();
      } catch {
        if (userId) setAgencyStorefrontCompleteCached(userId, true);
        onCompleteRef.current?.();
        return;
      }
      setOrganizations(
        refreshed.filter(
          (organization) =>
            organization.type === 'AGENCY' &&
            organization.memberRole === 'ADMIN',
        ),
      );
      const nextIncomplete = refreshed.find(
        (organization) =>
          organization.type === 'AGENCY' &&
          organization.memberRole === 'ADMIN' &&
          organization.id !== organizationId &&
          !organization.shortName?.trim(),
      );
      if (nextIncomplete) {
        setNotice(
          'Vitrine enregistrée. Configurez également votre autre agence.',
        );
        setOrganizationId(nextIncomplete.id);
      } else {
        const complete = !agencyStorefrontNeedsSetup(refreshed);
        if (userId) setAgencyStorefrontCompleteCached(userId, complete);
        if (complete) onCompleteRef.current?.();
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Impossible d’enregistrer la vitrine.',
      );
    } finally {
      setSaving(false);
    }
  }, [form, organizationId, userId]);

  const setField = (field: keyof StorefrontForm, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const inputClass =
    'mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-active outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
  const labelClass = 'block text-sm font-medium text-heading';

  return (
    <div className={className}>
      {organizations.length > 1 ? (
        <label className="mb-5 block max-w-md text-sm font-medium text-heading">
          Agence
          <select
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            className={inputClass}
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {notice}
        </p>
      ) : null}

      {organizations.length === 0 && organizationLoadFailed ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              setOrganizationLoadFailed(false);
              setOrganizationRetry((value) => value + 1);
            }}
            className="text-sm font-semibold text-active underline"
          >
            Réessayer de charger les agences
          </button>
        </div>
      ) : organizations.length === 0 && !loading ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted">
            Cette page est réservée aux administrateurs d’agence.
          </p>
        </div>
      ) : loading || loadedProfileId !== organizationId ? (
        <div
          role="status"
          className="rounded-2xl border border-border bg-card p-6 text-sm text-muted"
        >
          {error ? (
            <button
              type="button"
              onClick={() => setProfileRetry((value) => value + 1)}
              className="font-semibold text-active underline"
            >
              Réessayer de charger la vitrine
            </button>
          ) : (
            'Chargement de la vitrine…'
          )}
        </div>
      ) : (
        <form
          className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-7"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              Nom de l’agence
              <input
                required
                maxLength={160}
                className={inputClass}
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Nom public de la vitrine <span className="text-danger">*</span>
              <input
                required
                maxLength={80}
                className={inputClass}
                value={form.shortName}
                onChange={(event) => setField('shortName', event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Slogan
              <input
                maxLength={160}
                className={inputClass}
                value={form.tagline}
                onChange={(event) => setField('tagline', event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Ville / zone desservie
              <input
                maxLength={120}
                className={inputClass}
                value={form.cityLabel}
                onChange={(event) => setField('cityLabel', event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Adresse
              <input
                maxLength={200}
                className={inputClass}
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Téléphone public
              <input
                maxLength={40}
                className={inputClass}
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />
            </label>
            <label className={labelClass}>
              E-mail public
              <input
                type="email"
                maxLength={200}
                className={inputClass}
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </label>
          </div>
          <label className={labelClass}>
            Présentation
            <textarea
              rows={5}
              maxLength={2000}
              className={inputClass}
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
            />
          </label>
          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">
              La vitrine devient publique dès que le nom public est enregistré.
            </p>
            <button
              type="submit"
              disabled={saving || loading || !organizationId}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : submitLabel}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
