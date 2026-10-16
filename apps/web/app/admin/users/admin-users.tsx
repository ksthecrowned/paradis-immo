'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DashboardPageHeader,
  PaginatedDataTable,
  type PaginatedDataTableHandle,
  StatusBadge,
  UserIdentity,
  type ListColumn,
} from '@/components/dashboard';
import { appDialog } from '@/components/dialogs/app-dialog';
import { ApiError } from '@/lib/api';
import {
  listUsers,
  suspendUser,
  unsuspendUser,
  type AdminUser,
} from '@/lib/admin/users';
import { useRequireSession } from '@/hooks/use-require-session';

const ROLE_LABELS: Record<string, string> = {
  TENANT: 'Locataire',
  BUYER: 'Acheteur',
  PLATFORM_ADMIN: 'Admin plateforme',
};

const ROLE_TONES: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  TENANT: 'neutral',
  BUYER: 'success',
  PLATFORM_ADMIN: 'warning',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AdminUsersPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const tableRef = useRef<PaginatedDataTableHandle>(null);

  const handleError = useCallback((err: unknown) => {
    const message =
      err instanceof ApiError
        ? err.message
        : 'Impossible de charger les utilisateurs.';
    setError(message);
  }, []);

  const columns = useMemo<ListColumn<AdminUser>[]>(
    () => [
      {
        key: 'name',
        label: 'Nom',
        sortable: true,
        render: (_value, row) => (
          <UserIdentity
            name={row.name ?? row.phone}
            avatarUrl={row.avatarUrl}
            fallbackName="Utilisateur"
          />
        ),
        getFilterValue: (row) => row.name ?? '',
      },
      {
        key: 'phone',
        label: 'Téléphone',
        sortable: true,
      },
      {
        key: 'roles',
        label: 'Rôles',
        filterable: true,
        filterType: 'select',
        filterOptions: Object.entries(ROLE_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
        getFilterValue: (row) => row.roles.join(' '),
        render: (_value, row) => (
          <div className="flex flex-wrap gap-1">
            {row.roles.length === 0 ? (
              <StatusBadge label="Aucun" tone="neutral" />
            ) : (
              row.roles.map((role) => (
                <StatusBadge
                  key={role}
                  label={ROLE_LABELS[role] ?? role}
                  tone={ROLE_TONES[role] ?? 'neutral'}
                />
              ))
            )}
          </div>
        ),
      },
      {
        key: 'countryName',
        label: 'Pays',
        sortable: true,
        className: 'hidden sm:table-cell',
        getFilterValue: (user) => user.countryName,
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'ACTIVE', label: 'Actif' },
          { value: 'SUSPENDED', label: 'Suspendu' },
        ],
        render: (value) =>
          value === 'SUSPENDED' ? (
            <StatusBadge label="Suspendu" tone="danger" />
          ) : (
            <StatusBadge label="Actif" tone="success" />
          ),
      },
      {
        key: 'createdAt',
        label: 'Inscrit le',
        sortable: true,
        className: 'hidden md:table-cell',
        render: (value) => formatDate(String(value)),
        getFilterValue: (row) => formatDate(row.createdAt),
      },
    ],
    [],
  );

  const handleUserStatusAction = useCallback(
    async (user: AdminUser) => {
      const isSuspended = user.status === 'SUSPENDED';
      if (isSuspended) {
        if (
          !(await appDialog.confirm({
            title: 'Réactiver ce compte',
            message: `Le compte de ${user.name?.trim() || user.phone || 'cet utilisateur'} pourra de nouveau se connecter.`,
            confirmLabel: 'Réactiver',
          }))
        ) {
          return;
        }
      } else {
        const reason = await appDialog.prompt({
          title: 'Suspendre ce compte',
          message: 'La suspension bloque les accès et révoque les sessions en cours.',
          label: 'Motif de suspension',
          placeholder: 'Expliquez pourquoi ce compte est suspendu',
          required: true,
          multiline: true,
          variant: 'danger',
          confirmLabel: 'Suspendre',
        });
        if (reason === null) return;

        setActionId(user.id);
        setError(null);
        try {
          await suspendUser(user.id, reason.trim());
          await tableRef.current?.refresh();
        } catch (err) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Impossible de suspendre cet utilisateur.',
          );
        } finally {
          setActionId(null);
        }
        return;
      }

      setActionId(user.id);
      setError(null);
      try {
        await unsuspendUser(user.id);
        await tableRef.current?.refresh();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de réactiver cet utilisateur.',
        );
      } finally {
        setActionId(null);
      }
    },
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Utilisateurs" />

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {ready ? (
        <PaginatedDataTable
          ref={tableRef}
          fetchFn={listUsers}
          columns={columns}
          entityLabel="utilisateurs"
          searchPlaceholder="Rechercher un utilisateur…"
          emptyMessage="Aucun utilisateur trouvé."
          onError={handleError}
          tableId="admin-users-table"
          enableClientFilters
          actions={(user) => (
            <button
              type="button"
              aria-label={
                user.status === 'SUSPENDED'
                  ? 'Réactiver le compte'
                  : 'Suspendre le compte'
              }
              disabled={actionId === user.id}
              onClick={() => void handleUserStatusAction(user)}
            >
              {actionId === user.id
                ? 'Mise à jour…'
                : user.status === 'SUSPENDED'
                  ? 'Réactiver le compte'
                  : 'Suspendre le compte'}
            </button>
          )}
        />
      ) : (
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card" />
      )}
    </section>
  );
}
