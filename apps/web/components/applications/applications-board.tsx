'use client';

import {
  DashboardPageHeader,
  PaginatedDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { Button } from '@/components/primitives/Button';
import { ApiError } from '@/lib/api';
import {
  acceptApplication,
  applicationStatusLabel,
  applicationStatusTone,
  createLeaseFromApplication,
  fetchPropertyApplications,
  isOpenApplication,
  rejectApplication,
  requestSolvencyCheck,
  type RentalApplication,
} from '@/lib/owner/applications';
import { useCallback, useMemo, useState } from 'react';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

/** Ratio revenus / loyer : the cheapest triage signal for a candidate. */
function incomeRatio(application: RentalApplication): number | null {
  if (!application.declaredIncome || !application.property) return null;
  const rent = Number(application.property.price);
  if (rent <= 0) return null;
  return Number(application.declaredIncome) / rent;
}

const SOLVENCY_LABELS: Record<string, string> = {
  PENDING: 'en attente',
  GRANTED: 'accordée',
  DENIED: 'refusée',
  EXPIRED: 'expirée',
};

const buttonClass =
  'rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50';
const primaryButtonClass =
  'rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50';
const dangerButtonClass =
  'rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50';

export type ApplicationsBoardProps = {
  /** Property whose candidatures are managed. */
  propertyId: string;
  propertyTitle?: string;
  /** Value for the `PaginatedDataTable` `key`, to force a refetch. */
  refreshKey?: number;
  onChanged?: () => void;
  /** Rendered next to the page title. */
  headerAction?: React.ReactNode;
};

/**
 * Spec 04 — manager view of the candidatures on one property: candidate
 * comparison, solvency request, accept (auto-rejects siblings) and creation
 * of the pre-filled DRAFT lease.
 *
 * Shared by the owner and agent dashboards; the backend decides access.
 */
export function ApplicationsBoard({
  propertyId,
  propertyTitle,
  refreshKey = 0,
  onChanged,
  headerAction,
}: ApplicationsBoardProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [reloadKey, setReloadKey] = useState(0);

  const runAction = useCallback(
    async (
      id: string,
      failureLabel: string,
      fn: () => Promise<unknown>,
      successMessage?: string,
    ) => {
      setActionId(id);
      setError(null);
      setNotice(null);
      try {
        await fn();
        if (successMessage) setNotice(successMessage);
        setReloadKey((value) => value + 1);
        onChanged?.();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : failureLabel);
      } finally {
        setActionId(null);
      }
    },
    [onChanged],
  );

  const columns = useMemo<ListColumn<RentalApplication>[]>(
    () => [
      {
        key: 'applicantName',
        label: 'Candidat',
        sortable: true,
        render: (_value, row) => (
          <span className="text-xs text-foreground">
            {row.applicant?.name ?? '—'}
            {row.applicant?.phone ? (
              <span className="ml-1 font-mono text-muted">
                {row.applicant.phone}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: 'desiredMoveIn',
        label: 'Emménagement',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'occupants',
        label: 'Occupants',
        sortable: true,
        className: 'hidden sm:table-cell',
        render: (value) => `${String(value)} pers.`,
      },
      {
        key: 'declaredIncome',
        label: 'Revenus',
        sortable: true,
        render: (_value, row) => {
          if (!row.declaredIncome || !row.property) return '—';
          return (
            <span className="text-xs">
              {formatMoney(row.declaredIncome, row.property.currency)}
              <span className="ml-1 text-muted">
                ({incomeRatio(row)?.toFixed(1) ?? '—'}× loyer)
              </span>
            </span>
          );
        },
      },
      {
        key: 'occupation',
        label: 'Profession',
        sortable: true,
        className: 'hidden md:table-cell',
        render: (value) => (value ? String(value) : '—'),
      },
      {
        key: 'solvency',
        label: 'Solvabilité',
        sortable: false,
        className: 'hidden md:table-cell',
        render: (_value, row) =>
          row.solvencyCheck ? (
            <StatusBadge
              label={SOLVENCY_LABELS[row.solvencyCheck.status] ?? row.solvencyCheck.status}
              tone={
                row.solvencyCheck.status === 'GRANTED'
                  ? 'success'
                  : row.solvencyCheck.status === 'PENDING'
                    ? 'warning'
                    : 'danger'
              }
            />
          ) : (
            <span className="text-xs text-muted">—</span>
          ),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        render: (value) => (
          <StatusBadge
            label={applicationStatusLabel(String(value))}
            tone={applicationStatusTone(String(value))}
          />
        ),
      },
    ],
    [],
  );

  const query = useMemo(
    () => (statusFilter ? { status: statusFilter } : {}),
    [statusFilter],
  );

  const fetchFn = useCallback(
    (params: { page: number; limit: number }) => {
      void reloadKey;
      return fetchPropertyApplications(propertyId, { ...query, ...params });
    },
    [propertyId, query, reloadKey],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title={propertyTitle ? `Candidatures — ${propertyTitle}` : 'Candidatures'}
        actions={headerAction}
      />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Statut
          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter(e.target.value === '' ? undefined : e.target.value)
            }
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Tous</option>
            <option value="SUBMITTED">Déposée</option>
            <option value="UNDER_REVIEW">À l’étude</option>
            <option value="SOLVENCY_PENDING">Solvabilité demandée</option>
            <option value="ACCEPTED">Acceptée</option>
            <option value="REJECTED">Refusée</option>
            <option value="WITHDRAWN">Retirée</option>
          </select>
        </label>
        {reloadKey > 0 ? (
          <Button
            icon="mdi:refresh"
            variant="ghost"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Actualiser
          </Button>
        ) : null}
      </div>

      <PaginatedDataTable
        key={`${propertyId}-${statusFilter ?? 'all'}-${refreshKey}-${reloadKey}`}
        fetchFn={fetchFn}
        columns={columns}
        entityLabel="candidatures"
        searchPlaceholder="Rechercher un candidat…"
        emptyMessage="Aucune candidature pour ce bien."
        tableId={`applications-${propertyId}`}
        onError={(err) =>
          setError(
            err instanceof ApiError
              ? err.message
              : 'Impossible de charger les candidatures.',
          )
        }
        actions={(row) => (
          <div className="flex flex-wrap gap-2">
            {isOpenApplication(row.status) ? (
              <>
                {row.status !== 'SOLVENCY_PENDING' ? (
                  <button
                    type="button"
                    disabled={actionId === row.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void runAction(
                        row.id,
                        'Impossible de demander la solvabilité.',
                        () => requestSolvencyCheck(row.id),
                        'Demande de solvabilité envoyée au candidat.',
                      );
                    }}
                    className={buttonClass}
                  >
                    Demander solvabilité
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={actionId === row.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    const message =
                      window.prompt(
                        'Message envoyé aux candidats refusés (obligatoire) :',
                        'Le bien a été attribué à un autre candidat.',
                      ) ?? '';
                    if (message.trim() === '') return;
                    void runAction(
                      row.id,
                      'Impossible de refuser la candidature.',
                      () => rejectApplication(row.id, message.trim()),
                      'Candidature refusée.',
                    );
                  }}
                  className={dangerButtonClass}
                >
                  Refuser
                </button>
                <button
                  type="button"
                  disabled={actionId === row.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      !confirm(
                        'Accepter cette candidature ? Toutes les autres candidatures du bien seront refusées.',
                      )
                    ) {
                      return;
                    }
                    void runAction(
                      row.id,
                      'Impossible d’accepter la candidature.',
                      () => acceptApplication(row.id),
                      'Candidature acceptée, les autres ont été refusées.',
                    );
                  }}
                  className={primaryButtonClass}
                >
                  Accepter
                </button>
              </>
            ) : null}

            {row.status === 'ACCEPTED' && !row.leaseId ? (
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void runAction(
                    row.id,
                    'Impossible de créer le bail.',
                    () => createLeaseFromApplication(row.id),
                    'Bail brouillon créé à partir de la candidature.',
                  );
                }}
                className={primaryButtonClass}
              >
                Créer le bail
              </button>
            ) : null}

            {row.leaseId ? (
              <span className="rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success">
                Bail lié
              </span>
            ) : null}

            {row.status === 'REJECTED' && row.rejectionMessage ? (
              <span className="max-w-xs truncate text-xs text-muted" title={row.rejectionMessage}>
                {row.rejectionMessage}
              </span>
            ) : null}
          </div>
        )}
      />
    </section>
  );
}