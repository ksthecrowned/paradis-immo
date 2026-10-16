'use client';

import { appDialog } from '@/components/dialogs/app-dialog';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  FilterTabs,
  ListDataTable,
  StatusBadge,
  type FilterTabItem,
  type ListColumn,
} from '@/components/dashboard';
import { ApiErrorBanner } from '@/components/forms';
import { ApiError } from '@/lib/api';
import {
  listAdminOrgRequests,
  reviewAdminOrgRequest,
  orgRequestReference,
  ORG_REQUEST_STATUS_LABELS,
  ORG_REQUEST_TYPE_LABELS,
  orgRequestStatusTone,
  formatOrgRequestDate,
  type AdminOrgRequestRow,
  type OrganizationRequestStatus,
} from '@/lib/admin/organization-requests';
import { DASH_ICONS } from '@/lib/dash-icons';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

type OnboardingFilter = OrganizationRequestStatus | 'ALL';

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
  const [filter, setFilter] = useState<OnboardingFilter>('PENDING');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAdminOrgRequests({}));
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
  }, []);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  const counts = useMemo(() => {
    const next: Record<OnboardingFilter, number> = {
      ALL: rows.length,
      PENDING: 0,
      INVITED: 0,
      REJECTED: 0,
    };
    for (const row of rows) {
      next[row.status] += 1;
    }
    return next;
  }, [rows]);

  const visibleRows = useMemo(
    () =>
      filter === 'ALL' ? rows : rows.filter((row) => row.status === filter),
    [filter, rows],
  );

  const filterItems = useMemo<FilterTabItem<OnboardingFilter>[]>(
    () => [
      {
        id: 'ALL',
        label: 'Tous',
        icon: DASH_ICONS.dashboard,
        count: counts.ALL,
      },
      {
        id: 'PENDING',
        label: ORG_REQUEST_STATUS_LABELS.PENDING,
        icon: DASH_ICONS.activity,
        count: counts.PENDING,
      },
      {
        id: 'INVITED',
        label: ORG_REQUEST_STATUS_LABELS.INVITED,
        icon: 'solar:check-circle-linear',
        count: counts.INVITED,
      },
      {
        id: 'REJECTED',
        label: ORG_REQUEST_STATUS_LABELS.REJECTED,
        icon: DASH_ICONS.close,
        count: counts.REJECTED,
      },
    ],
    [counts],
  );

  const handleInvite = useCallback(
    async (id: string) => {
      if (!await appDialog.confirm({ message: 'Valider ce dossier ? Une organisation sera créée et un lien d’invitation généré.' })) {
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
      const reason = await appDialog.prompt({
        title: 'Rejeter le dossier',
        message: 'Un motif sera communiqué au demandeur.',
        label: 'Motif du rejet',
        defaultValue: 'Dossier incomplet',
        required: true,
        multiline: true,
        variant: 'danger',
        confirmLabel: 'Rejeter le dossier',
      });
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
        render: (value) =>
          formatOrgRequestDate(value == null ? null : String(value), 'compact'),
      },
    ],
    [],
  );

  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Dossiers d’ouverture" />
      <FilterTabs
        ariaLabel="Filtrer les dossiers d’ouverture"
        items={filterItems}
        value={filter}
        onChange={setFilter}
      />
      <ApiErrorBanner message={error} />
      {notice ? (
        <p
          className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
          role="status"
        >
          {notice}
        </p>
      ) : null}
      <ListDataTable
        tableId="admin-onboarding-table"
        columns={columns}
        data={visibleRows}
        loading={loading}
        onRefresh={load}
        viewHref={(row) => ROUTES.admin.onboardingRequest(row.id)}
        viewLabel="Voir les détails"
        entityLabel="dossiers"
        searchPlaceholder="Rechercher un dossier…"
        emptyMessage="Aucun dossier d’ouverture."
        actions={(row) =>
          row.status === 'PENDING' ? (
            <>
              <button
                type="button"
                disabled={actionId === row.id}
                aria-label="Valider le dossier"
                onClick={() => void handleInvite(row.id)}
              >
                {actionId === row.id ? 'Mise à jour…' : 'Valider'}
              </button>
              <button
                type="button"
                disabled={actionId === row.id}
                aria-label="Rejeter le dossier"
                onClick={() => void handleReject(row.id)}
              >
                Rejeter
              </button>
            </>
          ) : null
        }
      />
    </section>
  );
}
