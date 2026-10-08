'use client';

import Link from 'next/link';
import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { DetailCard } from '@/components/detail';
import { ApiErrorBanner } from '@/components/forms';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import {
  acceptMandate,
  assignMandate,
  counterMandate,
  declineMandate,
  listManagedMandates,
  listOrganizationAgents,
  type PublicMandate,
  type PublicOrgAgent,
} from '@/lib/agent/mandates';
import { listManagedProperties } from '@/lib/agent/portfolio';
import { ApiError } from '@/lib/api';
import {
  agentOrganizationIds,
  isAgencyGerant,
  listMyOrganizations,
} from '@/lib/me';
import {
  commissionSummary,
  mandateScopeLabel,
  mandateStatusLabel,
  mandateStatusTone,
} from '@/lib/owner/mandates';
import { ROUTES } from '@/lib/routes';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const STATUS_FILTERS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'PROPOSED', label: 'Proposés' },
  { value: 'COUNTERED', label: 'Contre-proposés' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'TERMINATING', label: 'En préavis' },
  { value: 'TERMINATED', label: 'Terminés' },
  { value: 'EXPIRED', label: 'Expirés' },
  { value: 'DECLINED', label: 'Refusés' },
];

type CounterForm = {
  mandateId: string;
  managementFeeRatePct: string;
  saleCommissionRatePct: string;
  endDate: string;
  noticeDays: string;
  reason: string;
};

export function AgentMandatesPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [mandates, setMandates] = useState<PublicMandate[]>([]);
  const [agents, setAgents] = useState<PublicOrgAgent[]>([]);
  const [propertyTitles, setPropertyTitles] = useState<Map<string, string>>(
    new Map(),
  );
  const [canAct, setCanAct] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [counter, setCounter] = useState<CounterForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orgs = await listMyOrganizations();
      const agencyId = agentOrganizationIds(orgs)[0] ?? null;
      setCanAct(isAgencyGerant(orgs));
      const [rows, props] = await Promise.all([
        listManagedMandates(statusFilter ? { status: statusFilter } : {}),
        listManagedProperties().catch(() => []),
      ]);
      setMandates(rows);
      setPropertyTitles(new Map(props.map((p) => [p.id, p.title])));
      setAgents(agencyId ? await listOrganizationAgents(agencyId) : []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les mandats.',
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const title = useCallback(
    (propertyId: string) =>
      propertyTitles.get(propertyId) ?? `${propertyId.slice(0, 8)}…`,
    [propertyTitles],
  );

  const proposals = useMemo(
    () =>
      mandates.filter(
        (m) => m.status === 'PROPOSED' || m.status === 'COUNTERED',
      ),
    [mandates],
  );
  const others = useMemo(
    () =>
      mandates.filter(
        (m) => m.status !== 'PROPOSED' && m.status !== 'COUNTERED',
      ),
    [mandates],
  );

  const run = useCallback(
    async (mandateId: string, fn: () => Promise<unknown>) => {
      setBusyId(mandateId);
      setError(null);
      try {
        await fn();
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'L’action a échoué.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const handleAccept = useCallback(
    (mandateId: string) => {
      if (!confirm('Accepter cette proposition de mandat ?')) return;
      void run(mandateId, () => acceptMandate(mandateId));
    },
    [run],
  );

  const handleDecline = useCallback(
    (mandateId: string) => {
      const reason = window.prompt('Motif du refus :');
      if (!reason || reason.trim().length < 3) return;
      void run(mandateId, () => declineMandate(mandateId, reason.trim()));
    },
    [run],
  );

  const handleCounter = useCallback(() => {
    if (!counter) return;
    const pct = (value: string) =>
      value.trim() === '' ? undefined : Number(value) / 100;
    const num = (value: string) =>
      value.trim() === '' ? undefined : Number(value);
    void run(counter.mandateId, () =>
      counterMandate(counter.mandateId, {
        ...(pct(counter.managementFeeRatePct) !== undefined
          ? { managementFeeRate: pct(counter.managementFeeRatePct) }
          : {}),
        ...(pct(counter.saleCommissionRatePct) !== undefined
          ? { saleCommissionRate: pct(counter.saleCommissionRatePct) }
          : {}),
        ...(num(counter.noticeDays) !== undefined
          ? { noticeDays: num(counter.noticeDays) }
          : {}),
        ...(counter.endDate
          ? { endDate: new Date(counter.endDate).toISOString() }
          : {}),
        ...(counter.reason.trim()
          ? { reason: counter.reason.trim() }
          : {}),
      }),
    ).then(() => setCounter(null));
  }, [counter, run]);

  const handleAssign = useCallback(
    (mandateId: string, agentUserId: string | null) => {
      void run(mandateId, () => assignMandate(mandateId, agentUserId));
    },
    [run],
  );

  if (!ready) {
    return <p className="text-base text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Mandats" />
      <ApiErrorBanner message={error} />

      {loading ? (
        <p className="text-base text-muted">Chargement…</p>
      ) : (
        <>
          <DetailCard title={`Propositions reçues (${proposals.length})`}>
            {proposals.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">
                Aucune proposition en attente.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {proposals.map((m) => (
                  <li key={m.id} className="space-y-3 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={ROUTES.agent.mandate(m.id)}
                          className="text-base font-semibold text-heading hover:text-accent hover:underline"
                        >
                          {title(m.propertyId)}
                        </Link>
                        <StatusBadge
                          label={mandateStatusLabel(m.status)}
                          tone={mandateStatusTone(m.status)}
                        />
                        {m.exclusive ? (
                          <StatusBadge label="Exclusif" tone="accent" />
                        ) : null}
                      </div>
                      {canAct ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            icon="mdi:check"
                            variant="primary"
                            size="sm"
                            loading={busyId === m.id}
                            onClick={() => handleAccept(m.id)}
                          >
                            Accepter
                          </Button>
                          <Button
                            icon="mdi:close"
                            variant="secondary"
                            size="sm"
                            disabled={busyId === m.id}
                            onClick={() => handleDecline(m.id)}
                          >
                            Refuser
                          </Button>
                          <Button
                            icon="mdi:swap-horizontal"
                            variant="secondary"
                            size="sm"
                            disabled={busyId === m.id}
                            onClick={() =>
                              setCounter({
                                mandateId: m.id,
                                managementFeeRatePct:
                                  m.managementFeeRate != null
                                    ? String(Number(m.managementFeeRate) * 100)
                                    : '',
                                saleCommissionRatePct:
                                  m.saleCommissionRate != null
                                    ? String(Number(m.saleCommissionRate) * 100)
                                    : '',
                                endDate: '',
                                noticeDays: String(m.noticeDays),
                                reason: '',
                              })
                            }
                          >
                            Contre-proposer
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted">
                      {commissionSummary(m)} · périmètre{' '}
                      {m.scopes.map(mandateScopeLabel).join(' + ')} · préavis{' '}
                      {m.noticeDays} j
                    </p>

                    {counter?.mandateId === m.id ? (
                      <div className="space-y-3 rounded-lg border border-border bg-background p-4">
                        <p className="text-sm font-medium text-heading">
                          Contre-proposition (nouvelle version)
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                          <label className="space-y-1 text-sm">
                            Gestion (%)
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={counter.managementFeeRatePct}
                              onChange={(e) =>
                                setCounter((c) =>
                                  c
                                    ? {
                                        ...c,
                                        managementFeeRatePct: e.target.value,
                                      }
                                    : c,
                                )
                              }
                              className="w-full rounded-lg border border-border bg-card px-3 py-2"
                            />
                          </label>
                          <label className="space-y-1 text-sm">
                            Vente (%)
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={counter.saleCommissionRatePct}
                              onChange={(e) =>
                                setCounter((c) =>
                                  c
                                    ? {
                                        ...c,
                                        saleCommissionRatePct: e.target.value,
                                      }
                                    : c,
                                )
                              }
                              className="w-full rounded-lg border border-border bg-card px-3 py-2"
                            />
                          </label>
                          <label className="space-y-1 text-sm">
                            Échéance
                            <input
                              type="date"
                              value={counter.endDate}
                              onChange={(e) =>
                                setCounter((c) =>
                                  c ? { ...c, endDate: e.target.value } : c,
                                )
                              }
                              className="w-full rounded-lg border border-border bg-card px-3 py-2"
                            />
                          </label>
                          <label className="space-y-1 text-sm">
                            Préavis (jours)
                            <input
                              type="number"
                              min="0"
                              value={counter.noticeDays}
                              onChange={(e) =>
                                setCounter((c) =>
                                  c ? { ...c, noticeDays: e.target.value } : c,
                                )
                              }
                              className="w-full rounded-lg border border-border bg-card px-3 py-2"
                            />
                          </label>
                        </div>
                        <label className="space-y-1 text-sm">
                          Motif
                          <input
                            type="text"
                            maxLength={500}
                            value={counter.reason}
                            onChange={(e) =>
                              setCounter((c) =>
                                c ? { ...c, reason: e.target.value } : c,
                              )
                            }
                            placeholder="Ex. : commission trop basse…"
                            className="w-full rounded-lg border border-border bg-card px-3 py-2"
                          />
                        </label>
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            loading={busyId === m.id}
                            onClick={handleCounter}
                          >
                            Envoyer la contre-proposition
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCounter(null)}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </DetailCard>

          <DetailCard
            title="Tous les mandats"
            actions={
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filtrer par statut"
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            }
          >
            {others.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">
                Aucun mandat pour ce filtre.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="px-4 py-2 font-medium">Bien</th>
                      <th className="px-4 py-2 font-medium">Statut</th>
                      <th className="px-4 py-2 font-medium">Commission</th>
                      <th className="px-4 py-2 font-medium">Agent</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {others.map((m) => {
                      const assignee = agents.find(
                        (a) => a.id === m.assignedAgentId,
                      );
                      return (
                        <tr key={m.id} className="border-b border-border/60">
                          <td className="px-4 py-2">
                            <Link
                              href={ROUTES.agent.mandate(m.id)}
                              className="font-medium text-heading hover:text-accent hover:underline"
                            >
                              {title(m.propertyId)}
                            </Link>
                          </td>
                          <td className="px-4 py-2">
                            <StatusBadge
                              label={mandateStatusLabel(m.status)}
                              tone={mandateStatusTone(m.status)}
                            />
                          </td>
                          <td className="px-4 py-2 text-muted">
                            {commissionSummary(m)}
                          </td>
                          <td className="px-4 py-2">
                            {canAct ? (
                              <select
                                value={m.assignedAgentId ?? ''}
                                disabled={busyId === m.id}
                                onChange={(e) =>
                                  handleAssign(
                                    m.id,
                                    e.target.value === '' ? null : e.target.value,
                                  )
                                }
                                className="w-full max-w-[14rem] rounded-lg border border-border bg-background px-2 py-1.5"
                              >
                                <option value="">Non affecté</option>
                                {agents.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name ?? a.phone ?? a.id.slice(0, 8)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-muted">
                                {assignee?.name ??
                                  assignee?.phone ??
                                  (m.assignedAgentId
                                    ? `${m.assignedAgentId.slice(0, 8)}…`
                                    : 'Non affecté')}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Link
                              href={ROUTES.agent.mandate(m.id)}
                              className="text-xs font-medium text-accent hover:underline"
                            >
                              <Icon
                                icon="mdi:arrow-right-circle-outline"
                                className="mr-1 inline h-4 w-4"
                              />
                              Détail
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </DetailCard>
        </>
      )}
    </section>
  );
}
