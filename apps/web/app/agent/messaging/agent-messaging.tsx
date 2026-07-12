'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatCard,
  type ListColumn,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  fetchOrgMessagingBalance,
  formatXaf,
  type PublicMessageCharge,
} from '@/lib/agent/messaging';
import {
  listMyOrganizations,
  type PublicOrganization,
} from '@/lib/me';
import { useRequireSession } from '@/hooks/use-require-session';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function AgentMessagingPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [orgs, setOrgs] = useState<PublicOrganization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [openBalanceXaf, setOpenBalanceXaf] = useState(0);
  const [rows, setRows] = useState<PublicMessageCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    const all = await listMyOrganizations();
    const agentOrgs = all.filter((o) => o.memberRole === 'AGENT');
    setOrgs(agentOrgs);
    setOrganizationId((prev) => {
      if (prev && agentOrgs.some((o) => o.id === prev)) return prev;
      return agentOrgs[0]?.id ?? '';
    });
  }, []);

  const loadBalance = useCallback(async (orgId: string) => {
    if (!orgId) {
      setOpenBalanceXaf(0);
      setRows([]);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchOrgMessagingBalance(orgId);
      setOpenBalanceXaf(data.openBalanceXaf);
      setRows(data.charges);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le solde messaging.',
      );
      setOpenBalanceXaf(0);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      setLoading(true);
      try {
        await loadOrgs();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de charger les organisations.',
        );
        setLoading(false);
      }
    })();
  }, [loadOrgs, ready]);

  useEffect(() => {
    if (!ready || !organizationId) {
      if (ready && !organizationId) setLoading(false);
      return;
    }
    void loadBalance(organizationId);
  }, [loadBalance, organizationId, ready]);

  const columns = useMemo<ListColumn<PublicMessageCharge>[]>(
    () => [
      {
        key: 'occurredAt',
        label: 'Date',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'recipientPhone',
        label: 'Destinataire',
        sortable: true,
        render: (value) => (
          <span className="font-mono text-xs">{String(value)}</span>
        ),
      },
      {
        key: 'billingMonth',
        label: 'Mois',
        sortable: true,
      },
      {
        key: 'amountXaf',
        label: 'Montant',
        sortable: true,
        render: (value) => formatXaf(Number(value)),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
      },
    ],
    [],
  );

  return (
    <div>
      <DashboardPageHeader
        title="Messaging SMS"
        actions={
          orgs.length > 1 ? (
            <label className="flex items-center gap-2 text-sm text-muted">
              Organisation
              <select
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-heading"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      />

      {error ? (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!organizationId && !loading ? (
        <p className="text-sm text-muted">
          Aucune organisation agent associée à votre compte.
        </p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Solde SMS ouvert"
              value={formatXaf(openBalanceXaf)}
            />
          </div>

          <ListDataTable
            data={rows}
            columns={columns}
            loading={loading}
            emptyMessage="Aucune charge SMS ouverte."
            entityLabel="charges SMS"
          />
        </>
      )}
    </div>
  );
}
