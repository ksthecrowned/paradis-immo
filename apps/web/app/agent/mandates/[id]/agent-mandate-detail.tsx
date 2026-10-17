'use client';

import { DashboardPageHeader } from '@/components/dashboard';
import { ApiErrorBanner } from '@/components/forms';
import { MandateDetailView } from '@/components/mandates/mandate-detail';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  getMandateDetail,
  type PublicMandateDetail,
} from '@/lib/agent/mandates';
import { agentOrganizationIds, isAgencyGerant, listMyOrganizations } from '@/lib/me';
import { ROUTES } from '@/lib/routes';
import { useCallback, useEffect, useState } from 'react';

export function AgentMandateDetail({
  mandateId,
}: {
  mandateId: string;
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const [detail, setDetail] = useState<PublicMandateDetail | null>(null);
  const [canTerminate, setCanTerminate] = useState(false);
  const [canDepositPaper, setCanDepositPaper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, orgs] = await Promise.all([
        getMandateDetail(mandateId),
        listMyOrganizations().catch(() => []),
      ]);
      setDetail(rows);
      const gerant =
        isAgencyGerant(orgs) && agentOrganizationIds(orgs).length > 0;
      setCanTerminate(gerant);
      setCanDepositPaper(gerant);
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
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  if (!ready) {
    return <p className="text-base text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Détail du mandat"
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.agent.dashboard },
          { label: 'Mandats', href: ROUTES.agent.mandates },
          { label: 'Détail' },
        ]}
      />
      <ApiErrorBanner message={error} />
      {loading ? (
        <p className="text-base text-muted">Chargement…</p>
      ) : detail ? (
        <MandateDetailView
          detail={detail}
          onChanged={load}
          canTerminate={canTerminate}
          canDepositPaper={canDepositPaper}
        />
      ) : null}
    </section>
  );
}
