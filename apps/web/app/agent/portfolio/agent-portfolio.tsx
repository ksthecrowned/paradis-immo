'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import {
  assignMandate,
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
  formatPropertyPrice,
  propertyModeLabel,
  propertyStatusLabel,
  propertyStatusTone,
  type PublicProperty,
} from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function AgentPortfolioPage(): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicProperty[]>([]);
  const [mandates, setMandates] = useState<PublicMandate[]>([]);
  const [agents, setAgents] = useState<PublicOrgAgent[]>([]);
  const [canAssign, setCanAssign] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orgs = await listMyOrganizations();
      const orgIds = agentOrganizationIds(orgs);
      // Product rule: one agent ↔ one agency. Take the sole membership.
      const agencyId = orgIds[0] ?? null;
      setCanAssign(isAgencyGerant(orgs));

      const [managedProperties, managedMandates] = await Promise.all([
        listManagedProperties(),
        listManagedMandates(),
      ]);
      setRows(managedProperties);
      setMandates(managedMandates);

      if (agencyId) {
        setAgents(await listOrganizationAgents(agencyId));
      } else {
        setAgents([]);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le portefeuille.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const propertyTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of rows) map.set(p.id, p.title);
    return map;
  }, [rows]);

  const handleAssign = useCallback(
    async (mandateId: string, agentUserId: string | null) => {
      setAssigningId(mandateId);
      try {
        const updated = await assignMandate(mandateId, agentUserId);
        setMandates((prev) =>
          prev.map((m) => (m.id === mandateId ? updated : m)),
        );
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de modifier l’affectation.',
        );
      } finally {
        setAssigningId(null);
      }
    },
    [],
  );

  const columns = useMemo<ListColumn<PublicProperty>[]>(
    () => [
      {
        key: 'title',
        label: 'Titre',
        sortable: true,
        render: (_value, row) => (
          <Link
            href={ROUTES.agent.property(row.id)}
            className="font-medium text-heading hover:text-accent hover:underline"
          >
            {row.title}
          </Link>
        ),
      },
      {
        key: 'mode',
        label: 'Mode',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'RENT_LONG', label: 'Location longue' },
          { value: 'RENT_SHORT', label: 'Location courte' },
          { value: 'SALE', label: 'Vente' },
        ],
        render: (value) => propertyModeLabel(String(value)),
      },
      {
        key: 'price',
        label: 'Prix',
        sortable: true,
        render: (value, row) =>
          formatPropertyPrice(Number(value), row.currency, row.priceUnit),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'ACTIVE', label: 'Actif' },
          { value: 'DRAFT', label: 'Brouillon' },
          { value: 'PAUSED', label: 'En pause' },
          { value: 'ARCHIVED', label: 'Archivé' },
        ],
        render: (value) => (
          <StatusBadge
            label={propertyStatusLabel(String(value))}
            tone={propertyStatusTone(String(value))}
          />
        ),
      },
      {
        key: 'quartier',
        label: 'Quartier',
        className: 'hidden md:table-cell',
        render: (_value, row) => row.quartier.name,
      },
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Portefeuille"
        actions={
          <Link href={ROUTES.agent.portfolioAdd}>
            <Button type="button">Ajouter un bien</Button>
          </Link>
        }
      />

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <ListDataTable
        data={rows}
        columns={columns}
        loading={loading}
        onRefresh={load}
        entityLabel="biens"
        searchPlaceholder="Rechercher un bien…"
        emptyMessage="Aucun bien dans votre portefeuille."
        tableId="agent-portfolio-table"
        onRowClick={(row) => {
          router.push(ROUTES.agent.property(row.id));
        }}
        actions={(row) => (
          <div className="flex items-center gap-2">
            <Link
              href={ROUTES.agent.property(row.id)}
              className="text-xs font-medium text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Voir
            </Link>
            <Link
              href={ROUTES.agent.propertyEdit(row.id)}
              className="text-xs font-medium text-muted hover:text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Modifier
            </Link>
          </div>
        )}
      />

      <div className="space-y-3 rounded-lg border border-border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold text-heading">
            Mandats à affecter
          </h2>
          <p className="mt-1 text-sm text-muted">
            {canAssign
              ? 'En tant que gérant, assignez un agent de terrain à chaque mandat (un seul agent par bien).'
              : 'Vos mandats affectés (lecture seule).'}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted">Chargement…</p>
        ) : mandates.length === 0 ? (
          <p className="text-sm text-muted">Aucun mandat géré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="px-2 py-2 font-medium">Bien</th>
                  <th className="px-2 py-2 font-medium">Statut</th>
                  <th className="px-2 py-2 font-medium">Agent</th>
                </tr>
              </thead>
              <tbody>
                {mandates.map((m) => {
                  const assignee = agents.find((a) => a.id === m.assignedAgentId);
                  const title =
                    propertyTitleById.get(m.propertyId) ??
                    `${m.propertyId.slice(0, 8)}…`;
                  return (
                    <tr key={m.id} className="border-b border-border/60">
                      <td className="px-2 py-3 text-heading">
                        <Link
                          href={ROUTES.agent.property(m.propertyId)}
                          className="hover:text-accent hover:underline"
                        >
                          {title}
                        </Link>
                      </td>
                      <td className="px-2 py-3">
                        <StatusBadge
                          label={m.status === 'ACTIVE' ? 'Actif' : m.status}
                          tone={m.status === 'ACTIVE' ? 'success' : 'neutral'}
                        />
                      </td>
                      <td className="px-2 py-3">
                        {canAssign ? (
                          <select
                            value={m.assignedAgentId ?? ''}
                            disabled={assigningId === m.id}
                            onChange={(e) => {
                              const value = e.target.value;
                              void handleAssign(
                                m.id,
                                value === '' ? null : value,
                              );
                            }}
                            className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2"
                          >
                            <option value="">Non affecté (gérant seul)</option>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
