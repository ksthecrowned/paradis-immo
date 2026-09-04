'use client';

import { LeaseForm, leaseToFormInitial } from '@/components/leases/lease-form';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import { getLease } from '@/lib/owner/leases';
import {
  DEFAULT_PHONE_COUNTRY,
  parseE164Phone,
  type PhoneCountrySelection,
} from '@/lib/phone';
import { ROUTES } from '@/lib/routes';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OwnerLeaseEditPage(): React.JSX.Element {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const leaseId = String(params.id ?? '');
  const { ready } = useRequireSession();
  const [initial, setInitial] = useState<
    (ReturnType<typeof leaseToFormInitial> & {
      tenantPhoneNational?: string;
      tenantName?: string;
    }) | null
  >(null);
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountrySelection>(
    DEFAULT_PHONE_COUNTRY,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !leaseId) return;
    let cancelled = false;
    void (async () => {
      try {
        const lease = await getLease(leaseId);
        if (cancelled) return;
        if (lease.status !== 'DRAFT') {
          router.replace(ROUTES.owner.lease(leaseId));
          return;
        }
        const parsed = parseE164Phone(lease.tenantPhone);
        if (parsed) {
          setPhoneCountry({
            countryCode: parsed.countryCode,
            callingCode: parsed.callingCode,
          });
        }
        setInitial({
          ...leaseToFormInitial(lease),
          tenantPhoneNational: parsed?.national ?? '',
        });
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Impossible de charger le bail.',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, leaseId, router]);

  if (!ready || (!initial && !error)) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  if (error || !initial) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error ?? 'Bail introuvable.'}
      </p>
    );
  }

  return (
    <LeaseForm
      leaseId={leaseId}
      initial={initial}
      initialPhoneCountry={phoneCountry}
      submitLabel="Enregistrer"
      onCancel={() => router.push(ROUTES.owner.lease(leaseId))}
    />
  );
}
