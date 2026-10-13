'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  listAdminOrgRequests,
  reviewAdminOrgRequest,
  orgRequestReference,
  ORG_REQUEST_STATUS_LABELS,
  ORG_REQUEST_TYPE_LABELS,
  orgRequestStatusTone,
  type AdminOrgRequestRow,
  type OrganizationRequestStatus,
} from '@/lib/admin/organization-requests';
import { useRequireSession } from '@/hooks/use-require-session';

/**
 * Admin validation of the public sign-up dossiers (spec 02): invite the
 * applicant (creates the organization + invitation link) or reject with a
 * reason. Backed by `PATCH /admin/organization-requests/:id`.
 */
export function AdminOnboardingPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<AdminOrgRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrganizationRequestStatus | 'ALL'>(
    'PENDING',
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(
        await listAdminOrgRequests({
          status: filter === 'ALL' ? undefined : filter,
        }),
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les dossiers.',
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  const handleInvite = useCallback(
    async (id: string) => {
      if (!confirm('Valider ce dossier ? Une organisation sera créée et un lien d’invitation généré.')) {
        return;
      }
      setActionId(id);
      setNotice(null);
      try {
        const { inviteUrl } = await reviewAdminOrgRequest(id, {
          action: 'INVITE',
        });
        setNotice(
          inviteUrl
            ? `Dossier validé — lien d’invitation à transmettre : ${inviteUrl}`
            : 'Dossier validé.',
        );
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de valider le dossier.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const handleReject = useCallback(
    async (id: string) => {
      const reason = window.prompt(
        'Motif du rejet (obligatoire) :',
        'Dossier incomplet',
      );
      if (!reason || !reason.trim()) return;
      setActionId(id);
      setNotice(null);
      try {
        await reviewAdminOrgRequest(id, {
          action: 'REJECT',
          rejectionReason: reason.trim(),
        });
        setNotice('Dossier rejeté.');
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de rejeter le dossier.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const columns = useMemo<ListColumn<AdminOrgRequestRow>[]>(
    () => [
      {
        key: 'reference',
        label: 'Référence',
        render: (_value, row) => (
          <span className="font-mono text-xs">{orgRequestReference(row)}</span>
        ),
      },
      {
        key: 'type',
        label: 'Type',
        render: (value) => ORG_REQUEST_TYPE_LABELS[value as 'OWNER' | 'AGENCY'],
      },
      { key: 'name', label: 'Nom', sortable: true },
      {
        key: 'email',
        label: 'Contact',
        render: (_value, row) => (
          <div className="text-xs">
            <p>{row.email}</p>
            {row.phone ? <p className="text-muted">{row.phone}</p> : null}
          </div>
        ),
      },
      {
        key: 'cityLabel',
        label: 'Localisation',
        render: (_value, row) => (
          <>
            {[row.cityLabel, row.address].filter(Boolean).join(' — ') || '—'}
            {row.rccm ? ` · RCCM ${row.rccm}` : ''}
          </>
        ),
      },
      {
        key: 'status',
        label: 'Statut',
        render: (value) => {
          const status = value as OrganizationRequestStatus;
          return (
            <StatusBadge
              label={ORG_REQUEST_STATUS_LABELS[status]}
              tone={orgRequestStatusTone(status)}
            />
          );
        },
      },
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        render: (value) => new Date(String(value)).toLocaleDateString('fr-FR'),
      },
      {
        key: 'id',
        label: 'Actions',
        render: (_value, row) => (
          <div className="flex flex-wrap gap-2">
            {row.status === 'PENDING' ? (
              <>
                <button
                  type="button"
                  className="text-sm text-emerald-700 underline disabled:opacity-50"
                  disabled={actionId === row.id}
                  onClick={() => void handleInvite(row.id)}
                >
                  Valider
                </button>
                <button
                  type="button"
                  className="text-sm text-red-600 underline disabled:opacity-50"
                  disabled={actionId === row.id}
                  onClick={() => void handleReject(row.id)}
                >
                  Rejeter
                </button>
              </>
            ) : (
              <span className="text-sm text-slate-400">
                {row.rejectionReason ?? '—'}
              </span>
            )}
          </div>
        ),
      },
    ],
    [actionId, handleInvite, handleReject],
  );

  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Dossiers d’ouverture"
      />
      <p className="text-sm text-muted">
        Demandes propriétaires et agences (spec 02) : valider génère
        l’organisation + le lien d’invitation.
      </p>
      <div className="flex flex-wrap gap-2">
        {(['PENDING', 'ALL', 'INVITED', 'REJECTED'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              filter === key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {key === 'ALL' ? 'Tous' : ORG_REQUEST_STATUS_LABELS[key]}
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          role="status"
        >
          {notice}
        </p>
      ) : null}
      <ListDataTable
        tableId="admin-onboarding-table"
        columns={columns}
        data={rows}
        loading={loading}
        onRefresh={load}
        entityLabel="dossiers"
        searchPlaceholder="Rechercher un dossier…"
        emptyMessage="Aucun dossier d’ouverture."
      />
    </section>
  );
}
