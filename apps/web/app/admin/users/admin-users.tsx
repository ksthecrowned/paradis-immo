'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  PaginatedDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import { listUsers, type AdminUser } from '@/lib/admin/users';

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
  const [error, setError] = useState<string | null>(null);

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
        render: (value) => (
          <span className="font-medium text-foreground">
            {value ? String(value) : '—'}
          </span>
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
        key: 'countryId',
        label: 'Pays',
        sortable: true,
        className: 'hidden sm:table-cell',
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

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Utilisateurs" />

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <PaginatedDataTable
        fetchFn={listUsers}
        columns={columns}
        entityLabel="utilisateurs"
        searchPlaceholder="Rechercher un utilisateur…"
        emptyMessage="Aucun utilisateur trouvé."
        onError={handleError}
        tableId="admin-users-table"
      />
    </section>
  );
}
