'use client';

import { DashboardPageHeader, StatusBadge, UserIdentity } from '@/components/dashboard';
import { DetailCard } from '@/components/detail';
import { appDialog } from '@/components/dialogs/app-dialog';
import { ApiErrorBanner } from '@/components/forms';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  getAdminUser,
  suspendUser,
  unsuspendUser,
  type AdminUserDetail,
} from '@/lib/admin/users';
import { ROUTES } from '@/lib/routes';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/primitives/Button';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AdminUserDetailPage({
  userId,
}: {
  userId: string;
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setUser(await getAdminUser(userId));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger cet utilisateur.',
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  const handleStatusAction = useCallback(async () => {
    if (!user || user.status === 'DELETED') return;

    if (user.status === 'SUSPENDED') {
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

      setActionLoading(true);
      setError(null);
      try {
        await suspendUser(user.id, reason.trim());
        await load(true);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de suspendre cet utilisateur.',
        );
      } finally {
        setActionLoading(false);
      }
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await unsuspendUser(user.id);
      await load(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de réactiver cet utilisateur.',
      );
    } finally {
      setActionLoading(false);
    }
  }, [load, user]);

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title={user?.name?.trim() || user?.phone || 'Détail utilisateur'}
        actions={
          user && user.status !== 'DELETED' ? (
            <Button
              variant={user.status === 'SUSPENDED' ? 'primary' : 'danger'}
              icon={
                user.status === 'SUSPENDED'
                  ? 'solar:check-circle-linear'
                  : 'solar:pause-circle-linear'
              }
              loading={actionLoading}
              onClick={() => void handleStatusAction()}
            >
              {user.status === 'SUSPENDED' ? 'Réactiver le compte' : 'Suspendre le compte'}
            </Button>
          ) : null
        }
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.admin.dashboard },
          { label: 'Utilisateurs', href: ROUTES.admin.users },
          { label: user?.name?.trim() || user?.phone || 'Détail' },
        ]}
      />
      <ApiErrorBanner message={error} />
      {!ready || loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : user ? (
        <>
          <DetailCard title="Profil">
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Utilisateur
                </p>
                <UserIdentity
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  fallbackName="Utilisateur"
                />
              </div>
              <DetailValue label="Identifiant" value={user.id} mono />
              <DetailValue label="Téléphone" value={user.phone} />
              <DetailValue label="Adresse e-mail" value={user.email} />
              <DetailValue label="Pays" value={user.countryName} />
              <DetailValue label="Inscrit le" value={formatDate(user.createdAt)} />
            </div>
          </DetailCard>

          <DetailCard title="Compte">
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Statut
                </p>
                {user.status === 'SUSPENDED' ? (
                  <StatusBadge label="Suspendu" tone="danger" />
                ) : user.status === 'DELETED' ? (
                  <StatusBadge label="Supprimé" tone="neutral" />
                ) : (
                  <StatusBadge label="Actif" tone="success" />
                )}
              </div>
              <DetailValue
                label="Vérification d’identité"
                value={user.kycStatus}
              />
              <DetailValue
                label="Rôles"
                value={user.roles.length > 0 ? user.roles.join(', ') : 'Aucun'}
              />
              {user.status === 'SUSPENDED' ? (
                <>
                  <DetailValue
                    label="Suspendu le"
                    value={formatDate(user.suspendedAt)}
                  />
                  <DetailValue
                    label="Motif de suspension"
                    value={user.suspendedReason}
                  />
                </>
              ) : null}
            </div>
          </DetailCard>
        </>
      ) : null}
    </section>
  );
}

function DetailValue({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`break-words text-sm text-active ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </p>
    </div>
  );
}
