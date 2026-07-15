'use client';

import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { DetailCard } from '@/components/detail';
import { ApiErrorBanner } from '@/components/forms';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  approvalStatusLabel,
  decideApproval,
  listPendingApprovals,
  mandateActionLabel,
  type PublicMandateApproval,
} from '@/lib/owner/mandates';
import { ROUTES } from '@/lib/routes';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function payloadSummary(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof payload.propertyId === 'string') {
    parts.push(`Bien ${payload.propertyId.slice(0, 8)}…`);
  }
  if (typeof payload.amount === 'string' || typeof payload.amount === 'number') {
    parts.push(`Montant ${payload.amount}`);
  }
  if (typeof payload.title === 'string') {
    parts.push(payload.title);
  }
  return parts.length > 0 ? parts.join(' · ') : JSON.stringify(payload);
}

export function OwnerMandatePage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [approvals, setApprovals] = useState<PublicMandateApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPendingApprovals();
      setApprovals(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les approbations.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleDecide = useCallback(
    async (id: string, approve: boolean) => {
      const label = approve ? 'approuver' : 'rejeter';
      if (!confirm(`Confirmer : ${label} cette demande ?`)) return;
      setActionId(id);
      try {
        await decideApproval(id, approve);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : `Impossible de ${label} la demande.`,
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  if (!ready) {
    return <p className="text-base text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Mes mandats"
        actions={
          <Link href={ROUTES.owner.mandateAdd}>
            <Button icon="mdi:plus" variant="primary">
              Déléguer un bien
            </Button>
          </Link>
        }
      />

      <ApiErrorBanner message={error} />

      <DetailCard title="Comment ça marche ?">
        <div className="px-5 py-4 text-sm text-muted">
          Déléguez la gestion d&apos;un bien à une agence, puis validez ici les
          actions qui nécessitent votre accord.
        </div>
      </DetailCard>

      {loading ? (
        <p className="text-base text-muted">Chargement…</p>
      ) : approvals.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-10 text-center">
          <Icon icon="mdi:handshake-outline" className="h-10 w-10 text-muted" />
          <p className="text-base text-muted">Aucune approbation en attente.</p>
          <Link href={ROUTES.owner.mandateAdd}>
            <Button icon="mdi:plus" variant="primary">
              Déléguer un bien
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {approvals.map((item) => (
            <li key={item.id}>
              <DetailCard
                title={mandateActionLabel(item.actionType)}
                actions={
                  item.status === 'PENDING' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        icon="mdi:check"
                        variant="primary"
                        size="sm"
                        loading={actionId === item.id}
                        onClick={() => void handleDecide(item.id, true)}
                      >
                        Approuver
                      </Button>
                      <Button
                        icon="mdi:close"
                        variant="secondary"
                        size="sm"
                        disabled={actionId === item.id}
                        onClick={() => void handleDecide(item.id, false)}
                      >
                        Rejeter
                      </Button>
                    </div>
                  ) : null
                }
              >
                <div className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={approvalStatusLabel(item.status)}
                      tone={item.status === 'PENDING' ? 'warning' : 'neutral'}
                    />
                  </div>
                  <p className="text-base text-muted">
                    {payloadSummary(item.payload)}
                  </p>
                  <p className="text-sm text-muted">
                    Demandé le {formatDate(item.createdAt)}
                  </p>
                </div>
              </DetailCard>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
