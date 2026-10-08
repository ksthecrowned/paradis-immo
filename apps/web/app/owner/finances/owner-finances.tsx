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
  downloadCsv,
  exportLedgerCsv,
  formatAmount,
  generateStatement,
  ledgerTypeLabel,
  ledgerTypeTone,
  listStatements,
  ownerLedger,
  ownerSummary,
  type LedgerEntry,
  type StatementItem,
} from '@/lib/accounting';
import { ApiError } from '@/lib/api';
import { listMyMandates, type PublicMandate } from '@/lib/owner/mandates';
import { listMyProperties } from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useCallback, useEffect, useMemo, useState } from 'react';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function OwnerFinancesPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [summary, setSummary] = useState<{
    totals: Record<string, string>;
    net: string;
    currency: string;
    count: number;
  } | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statements, setStatements] = useState<StatementItem[]>([]);
  const [mandates, setMandates] = useState<PublicMandate[]>([]);
  const [propertyTitles, setPropertyTitles] = useState<Map<string, string>>(
    new Map(),
  );
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stmtFrom, setStmtFrom] = useState('');
  const [stmtTo, setStmtTo] = useState('');
  const [stmtMandate, setStmtMandate] = useState('');

  const range = useMemo(
    () => ({
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(to).toISOString() } : {}),
    }),
    [from, to],
  );

  const load = useCallback(
    async (currentPage = 1) => {
      setLoading(true);
      try {
        const [summaryData, ledgerData, statementRows, mandateRows, props] =
          await Promise.all([
            ownerSummary(range),
            ownerLedger({ ...range, page: currentPage, pageSize: 20 }),
            listStatements(),
            listMyMandates().catch(() => []),
            listMyProperties().catch(() => []),
          ]);
        setSummary(summaryData);
        setEntries(ledgerData.data);
        setPage(ledgerData.meta.page);
        setTotalPages(Math.max(1, ledgerData.meta.totalPages));
        setTotal(ledgerData.meta.total);
        setStatements(statementRows);
        setMandates(mandateRows);
        setPropertyTitles(new Map(props.map((p) => [p.id, p.title])));
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de charger vos finances.',
        );
      } finally {
        setLoading(false);
      }
    },
    [range],
  );

  useEffect(() => {
    if (!ready) return;
    void load(1);
  }, [load, ready]);

  const handleExport = useCallback(() => {
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const csv = await exportLedgerCsv(range);
        downloadCsv(csv, 'grand-livre.csv');
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible d’exporter le grand livre.',
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [range]);

  const handleGenerate = useCallback(() => {
    if (!stmtFrom || !stmtTo) {
      setError('Sélectionnez une date de début et de fin pour le relevé.');
      return;
    }
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await generateStatement({
          periodStart: new Date(stmtFrom).toISOString(),
          periodEnd: new Date(stmtTo).toISOString(),
          ...(stmtMandate ? { mandateId: stmtMandate } : {}),
        });
        setStatements(await listStatements());
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de générer le relevé.',
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [stmtFrom, stmtMandate, stmtTo]);

  if (!ready) {
    return <p className="text-base text-muted">Chargement de la session…</p>;
  }

  const currency = summary?.currency ?? 'XAF';
  const cards: Array<{ label: string; value: string }> = [
    {
      label: 'Loyers encaissés',
      value: formatAmount(summary?.totals.RENT_IN ?? '0', currency),
    },
    {
      label: 'Honoraires agence',
      value: formatAmount(summary?.totals.FEE ?? '0', currency),
    },
    {
      label: 'Dépenses',
      value: formatAmount(summary?.totals.EXPENSE ?? '0', currency),
    },
    { label: 'Net à reverser', value: formatAmount(summary?.net ?? '0', currency) },
  ];

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Finances"
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
            <label htmlFor="range-from" className="text-sm font-medium text-heading">
              Du
            </label>
            <input
              id="range-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="range-to" className="text-sm font-medium text-heading">
              Au
            </label>
            <input
              id="range-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load(1)}>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} />
        ))}
      </div>

      <DetailCard
        title={`Grand livre (${total} écriture${total > 1 ? 's' : ''})`}
        actions={
          totalPages > 1 ? (
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => void load(page - 1)}
              >
                Précédent
              </Button>
              <span className="text-muted">
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => void load(page + 1)}
              >
                Suivant
              </Button>
            </div>
          ) : null
        }
      >
        {loading ? (
          <p className="px-5 py-4 text-sm text-muted">Chargement…</p>
        ) : entries.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">
            Aucune écriture sur cette période.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Libellé</th>
                  <th className="px-4 py-2 font-medium">Bien</th>
                  <th className="px-4 py-2 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/60">
                    <td className="px-4 py-2 text-muted">
                      {formatDate(entry.occurredAt)}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge
                        label={ledgerTypeLabel(entry.type)}
                        tone={ledgerTypeTone(entry.type)}
                      />
                    </td>
                    <td className="px-4 py-2 text-foreground">{entry.label}</td>
                    <td className="px-4 py-2 text-muted">
                      {propertyTitles.get(entry.propertyId) ??
                        `${entry.propertyId.slice(0, 8)}…`}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        Number(entry.amount) < 0 ? 'text-danger' : 'text-success'
                      }`}
                    >
                      {formatAmount(entry.amount, entry.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DetailCard>

      <DetailCard
        title="Relevés de gérance"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <input
              type="date"
              value={stmtFrom}
              onChange={(e) => setStmtFrom(e.target.value)}
              aria-label="Début du relevé"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
            <input
              type="date"
              value={stmtTo}
              onChange={(e) => setStmtTo(e.target.value)}
              aria-label="Fin du relevé"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
            <select
              value={stmtMandate}
              onChange={(e) => setStmtMandate(e.target.value)}
              aria-label="Mandat (optionnel)"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Tous les mandats</option>
              {mandates.map((m) => (
                <option key={m.id} value={m.id}>
                  {propertyTitles.get(m.propertyId) ?? m.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <Button
              icon="mdi:file-pdf-box"
              variant="primary"
              size="sm"
              loading={busy}
              onClick={handleGenerate}
            >
              Générer
            </Button>
          </div>
        }
      >
        {statements.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">
            Aucun relevé généré. Générez un relevé pour vos déclarations.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {statements.map((statement) => (
              <li
                key={statement.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm text-foreground">
                    {formatDate(statement.periodStart)} —{' '}
                    {formatDate(statement.periodEnd)}
                  </p>
                  <p className="text-xs text-muted">
                    Généré le {formatDate(statement.generatedAt)} · net{' '}
                    {formatAmount(
                      String(
                        (statement.totals as Record<string, unknown>).net ??
                          '0',
                      ),
                      currency,
                    )}
                  </p>
                </div>
                {statement.url ? (
                  <a
                    href={statement.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Télécharger le PDF
                  </a>
                ) : (
                  <span className="text-sm text-muted">PDF indisponible</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </DetailCard>

      <p className="text-sm text-muted">
        Les relevés mensuels sont aussi générés automatiquement le 5 de chaque
        mois. Retour aux{' '}
        <a href={ROUTES.owner.mandate} className="text-accent hover:underline">
          mes mandats
        </a>
        .
      </p>
    </section>
  );
}
