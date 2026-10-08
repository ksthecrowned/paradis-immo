'use client';

import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { DetailCard } from '@/components/detail';
import { ApiErrorBanner } from '@/components/forms';
import { FormTabs } from '@/components/forms/FormTabs';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  approvalEffectPreview,
  approvalStatusLabel,
  commissionSummary,
  decideApproval,
  listMyMandates,
  listPendingApprovals,
  mandateActionLabel,
  mandateScopeLabel,
  mandateStatusLabel,
  mandateStatusTone,
  type PublicMandate,
  type PublicMandateApproval,
} from '@/lib/owner/mandates';
import { listPublicAgencies } from '@/lib/public/agencies';
import { ROUTES } from '@/lib/routes';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatDateOnly(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function OwnerMandatePage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [approvals, setApprovals] = useState<PublicMandateApproval[]>([]);
  const [mandates, setMandates] = useState<PublicMandate[]>([]);
  const [agencyNames, setAgencyNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [approvalRows, mandateRows, agencies] = await Promise.all([
        listPendingApprovals(),
        listMyMandates(),
        listPublicAgencies().catch(() => []),
      ]);
      setApprovals(approvalRows);
      setMandates(mandateRows);
      setAgencyNames(new Map(agencies.map((a) => [a.id, a.name])));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger vos mandats.',
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
    async (id: string, decision: 'APPROVE' | 'REJECT') => {
      const label = decision === 'APPROVE' ? 'approuver' : 'refuser';
      if (!confirm(`Confirmer : ${label} cette demande ?`)) return;
      setActionId(id);
      try {
        await decideApproval(id, decision, comments[id] || undefined);
        setComments((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
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
    [comments, load],
  );

  const activeCount = useMemo(
    () => mandates.filter((m) => m.status === 'ACTIVE' || m.status === 'TERMINATING').length,
    [mandates],
  );

  if (!ready) {
    return <p className="text-base text-muted">Chargement de la session…</p>;
  }

  const mandatesTab = (
    <div className="space-y-4">
      {mandates.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-10 text-center">
          <Icon icon="mdi:handshake-outline" className="h-10 w-10 text-muted" />
          <p className="text-base text-muted">
            Aucun mandat. Confiez la gestion d’un bien à une agence.
          </p>
          <Link href={ROUTES.owner.mandateAdd}>
            <Button icon="mdi:plus" variant="primary">
              Déléguer un bien
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {mandates.map((m) => (
            <li key={m.id}>
              <DetailCard
                title={agencyNames.get(m.organizationId) ?? `Agence ${m.organizationId.slice(0, 8)}…`}
                actions={
                  <Link
                    href={ROUTES.owner.mandateDetail(m.id)}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Voir le détail
                  </Link>
                }
              >
                <div className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={mandateStatusLabel(m.status)}
                      tone={mandateStatusTone(m.status)}
                    />
                    {m.exclusive ? (
                      <StatusBadge label="Exclusif" tone="accent" />
                    ) : null}
                    {m.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="inline-flex rounded-md bg-border/60 px-2 py-0.5 text-xs font-medium text-muted"
                      >
                        {mandateScopeLabel(scope)}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-muted">{commissionSummary(m)}</p>
                  <p className="text-sm text-muted">
                    Début le {formatDateOnly(m.startDate)}
                    {m.endDate ? ` · échéance le ${formatDateOnly(m.endDate)}` : ' · durée indéterminée'}
                    {m.acceptedAt
                      ? ` · accepté le ${formatDateOnly(m.acceptedAt)}`
                      : ''}
                  </p>
                  {m.status === 'TERMINATING' && m.terminationEffectiveAt ? (
                    <p className="text-sm text-warning">
                      Résiliation en cours — effective le{' '}
                      {formatDateOnly(m.terminationEffectiveAt)}.
                    </p>
                  ) : null}
                  {m.signedDocumentKey ? (
                    <p className="flex items-center gap-1.5 text-sm text-success">
                      <Icon icon="mdi:file-sign" className="h-4 w-4" />
                      Mandat signé par les deux parties
                    </p>
                  ) : null}
                </div>
              </DetailCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const approvalsTab = (
    <div className="space-y-4">
      {approvals.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-10 text-center">
          <Icon icon="mdi:clipboard-check-outline" className="h-10 w-10 text-muted" />
          <p className="text-base text-muted">Aucune approbation en attente.</p>
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
                        onClick={() => void handleDecide(item.id, 'APPROVE')}
                      >
                        Approuver
                      </Button>
                      <Button
                        icon="mdi:close"
                        variant="secondary"
                        size="sm"
                        disabled={actionId === item.id}
                        onClick={() => void handleDecide(item.id, 'REJECT')}
                      >
                        Refuser
                      </Button>
                    </div>
                  ) : null
                }
              >
                <div className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={approvalStatusLabel(item.status)}
                      tone={
                        item.status === 'PENDING'
                          ? 'warning'
                          : item.status === 'APPROVED'
                            ? 'success'
                            : 'neutral'
                      }
                    />
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-foreground">
                    <Icon icon="mdi:lightbulb-on-outline" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <p>{approvalEffectPreview(item.actionType, item.payload)}</p>
                  </div>
                  <p className="text-sm text-muted">
                    Demandé le {formatDate(item.createdAt)} · expire le{' '}
                    {formatDate(item.expiresAt)}
                  </p>
                  {item.status === 'PENDING' ? (
                    <div className="space-y-1">
                      <label
                        htmlFor={`comment-${item.id}`}
                        className="text-sm font-medium text-heading"
                      >
                        Commentaire {item.status === 'PENDING' ? '(optionnel)' : ''}
                      </label>
                      <textarea
                        id={`comment-${item.id}`}
                        rows={2}
                        maxLength={500}
                        value={comments[item.id] ?? ''}
                        onChange={(e) =>
                          setComments((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="Visible par l’agence (obligatoire pour un refus…)"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  ) : item.comment ? (
                    <p className="text-sm text-muted">
                      Votre commentaire : « {item.comment} »
                    </p>
                  ) : null}
                </div>
              </DetailCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

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
          Déléguez la gestion d’un bien à une agence, suivez ses propositions et
          validez ici les actions qui nécessitent votre accord.
          {activeCount > 0 ? ` ${activeCount} mandat(s) actif(s).` : ''}
        </div>
      </DetailCard>

      {loading ? (
        <p className="text-base text-muted">Chargement…</p>
      ) : (
        <FormTabs
          tabs={[
            {
              id: 'mandates',
              label: 'Mandats',
              icon: 'mdi:handshake-outline',
              content: mandatesTab,
            },
            {
              id: 'approvals',
              label: 'Approbations',
              icon: 'mdi:clipboard-check-outline',
              content: approvalsTab,
            },
          ]}
        />
      )}
    </section>
  );
}
