'use client';

import {
  DashboardPageHeader,
  StatCard,
  StatusBadge,
} from '@/components/dashboard';
import { DetailCard } from '@/components/detail';
import { ApiErrorBanner } from '@/components/forms';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import {
  agencyFees,
  downloadCsv,
  exportLedgerCsv,
  formatAmount,
  type AgencyFeeRow,
} from '@/lib/accounting';
import { ApiError } from '@/lib/api';
import { listManagedProperties } from '@/lib/agent/portfolio';
import { agentOrganizationIds, isAgencyGerant, listMyOrganizations } from '@/lib/me';
import { ROUTES } from '@/lib/routes';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function AgentFinancesPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [isGerant, setIsGerant] = useState(false);
  const [checked, setChecked] = useState(false);
  const [rows, setRows] = useState<AgencyFeeRow[]>([]);
  const [total, setTotal] = useState('0');
  const [propertyTitles, setPropertyTitles] = useState<Map<string, string>>(
    new Map(),
  );
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const range = useMemo(
    () => ({
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(to).toISOString() } : {}),
    }),
    [from, to],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fees, props] = await Promise.all([
        agencyFees(range),
        listManagedProperties().catch(() => []),
      ]);
      setRows(fees.data);
      setTotal(fees.total);
      setPropertyTitles(new Map(props.map((p) => [p.id, p.title])));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les honoraires.',
      );
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const orgs = await listMyOrganizations();
        if (cancelled) return;
        setIsGerant(isAgencyGerant(orgs) && agentOrganizationIds(orgs).length > 0);
      } catch {
        setIsGerant(false);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || !checked || !isGerant) return;
    void load();
  }, [checked, isGerant, load, ready]);

  const handleExport = useCallback(() => {
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const csv = await exportLedgerCsv(range);
        downloadCsv(csv, 'honoraires.csv');
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible d’exporter le relevé.',
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [range]);

  if (!ready || !checked) {
    return <p className="text-base text-muted">Chargement de la session…</p>;
  }

  if (!isGerant) {
    return (
      <section className="space-y-6">
        <DashboardPageHeader title="Finances" />
        <DetailCard title="Accès réservé">
          <p className="px-5 py-4 text-sm text-muted">
            Le chiffre d’honoraires est réservé aux gérants d’agence. Contactez
            votre gérant pour consulter les finances de l’agence.
          </p>
        </DetailCard>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Finances de l’agence"
        actions={
          <Button
            icon="mdi:download"
            variant="secondary"
            loading={busy}
            onClick={handleExport}
          >
            Export CSV
          </Button>
        }
      />

      <ApiErrorBanner message={error} />

      <DetailCard title="Période">
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <div className="space-y-1">
            <label htmlFor="fees-from" className="text-sm font-medium text-heading">
              Du
            </label>
            <input
              id="fees-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="fees-to" className="text-sm font-medium text-heading">
              Au
            </label>
            <input
              id="fees-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Appliquer
          </Button>
          {from || to ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              Réinitialiser
            </Button>
          ) : null}
        </div>
      </DetailCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Honoraires (période)" value={formatAmount(total)} />
        <StatCard label="Mandats facturés" value={rows.length} />
        <StatCard
          label="Écritures de commission"
          value={rows.reduce((sum, row) => sum + row.entryCount, 0)}
        />
      </div>

      <DetailCard title="Honoraires par mandat">
        {loading ? (
          <p className="px-5 py-4 text-sm text-muted">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">
            Aucun honoraire encaissé sur cette période.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="px-4 py-2 font-medium">Bien</th>
                  <th className="px-4 py-2 font-medium">Mandat</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Écritures
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    Honoraires
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.propertyId}-${row.mandateId ?? 'none'}`}
                    className="border-b border-border/60"
                  >
                    <td className="px-4 py-2 text-heading">
                      {propertyTitles.get(row.propertyId) ??
                        `${row.propertyId.slice(0, 8)}…`}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge
                        label={
                          row.mandateId
                            ? `${row.mandateId.slice(0, 8)}…`
                            : 'Hors mandat'
                        }
                        tone={row.mandateId ? 'accent' : 'neutral'}
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-muted">
                      {row.entryCount}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-success">
                      {formatAmount(row.totalFee)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DetailCard>

      <p className="text-sm text-muted">
        Les honoraires sont calculés automatiquement à chaque validation de
        paiement sur un bien sous mandat. Voir aussi les{' '}
        <a href={ROUTES.agent.mandates} className="text-accent hover:underline">
          mandats
        </a>{' '}
        et les{' '}
        <a href={ROUTES.agent.expenses} className="text-accent hover:underline">
          dépenses
        </a>
        .
      </p>
    </section>
  );
}
