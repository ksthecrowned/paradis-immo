'use client';

import { DashboardPageHeader } from '@/components/dashboard';
import { ApiErrorBanner } from '@/components/forms';
import { MandateDetailView } from '@/components/mandates/mandate-detail';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  getMandateDetail,
  type PublicMandateDetail,
} from '@/lib/owner/mandates';
import { ROUTES } from '@/lib/routes';
import { useCallback, useEffect, useState } from 'react';

export function OwnerMandateDetail({
  mandateId,
}: {
  mandateId: string;
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const [detail, setDetail] = useState<PublicMandateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await getMandateDetail(mandateId));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger ce mandat.',
      );
    } finally {
      setLoading(false);
    }
  }, [mandateId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  if (!ready) {
    return <p className="text-base text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Détail du mandat"
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.owner.dashboard },
          { label: 'Mes mandats', href: ROUTES.owner.mandate },
          { label: 'Détail' },
        ]}
      />
      <ApiErrorBanner message={error} />
      {loading ? (
        <p className="text-base text-muted">Chargement…</p>
      ) : detail ? (
        <MandateDetailView detail={detail} onChanged={load} />
      ) : null}
    </section>
  );
}
