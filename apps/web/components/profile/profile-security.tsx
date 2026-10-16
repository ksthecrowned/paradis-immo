'use client';

import { DashIcon } from '@/components/dash-icon';
import { appDialog } from '@/components/dialogs/app-dialog';
import { ApiErrorBanner } from '@/components/forms';
import { Button } from '@/components/primitives/Button';
import { ApiError } from '@/lib/api';
import { logout } from '@/lib/auth';
import { DASH_ICONS } from '@/lib/dash-icons';
import { requestAccountDeletion } from '@/lib/me';
import { useState } from 'react';

const SECURITY_ROWS = [
  {
    icon: DASH_ICONS.shield,
    title: 'Mot de passe',
    description:
      'Le changement de mot de passe se fait via la procédure de connexion (e-mail / Google).',
    actionLabel: 'Compris',
    action: 'info' as const,
  },
  {
    icon: DASH_ICONS.logout,
    title: 'Session active',
    description: 'Déconnectez-vous pour sécuriser l’accès sur cet appareil.',
    actionLabel: 'Déconnecter',
    action: 'logout' as const,
  },
];

export function ProfileSecurity(): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogout(): Promise<void> {
    if (
      !(await appDialog.confirm({
        title: 'Se déconnecter',
        message: 'Vous allez quitter le portail sur cet appareil.',
        confirmLabel: 'Se déconnecter',
      }))
    ) {
      return;
    }
    await logout('/login');
  }

  async function handleDelete(): Promise<void> {
    const confirmed = await appDialog.confirm({
      title: 'Supprimer le compte',
      message:
        'La suppression est programmée (30 jours). Reconnectez-vous avant pour l’annuler. Les obligations en cours peuvent bloquer la demande.',
      confirmLabel: 'Demander la suppression',
      variant: 'danger',
    });
    if (!confirmed) return;

    setBusy(true);
    setNotice(null);
    try {
      const result = await requestAccountDeletion();
      setNotice(result.message);
      setError(null);
      await logout('/login');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de demander la suppression du compte.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold leading-7 text-foreground">
          Sécurité
        </h2>
        <p className="mt-1 text-sm text-muted">
          Protégez votre compte et gérez sa durée de vie.
        </p>
      </div>

      <ApiErrorBanner message={error} />
      {notice ? (
        <p
          className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <div className="space-y-2 divide-y divide-border">
        {SECURITY_ROWS.map((row) => (
          <div
            key={row.title}
            className="flex flex-col gap-4 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-search text-muted">
                <DashIcon icon={row.icon} width={20} height={20} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-5 text-foreground">
                  {row.title}
                </p>
                <p className="mt-1 text-xs leading-4 text-muted">
                  {row.description}
                </p>
              </div>
            </div>
            {row.action === 'logout' ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-accent hover:bg-transparent hover:text-accent-light"
                onClick={() => void handleLogout()}
              >
                {row.actionLabel}
              </Button>
            ) : (
              <span className="shrink-0 text-sm text-muted">{row.actionLabel}</span>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="mb-1 text-sm font-medium text-foreground">
              Supprimer le compte
            </p>
            <p className="text-xs text-muted">
              Suppression définitive après délai, avec contrôle des obligations
              en cours.
            </p>
          </div>
          <Button
            type="button"
            variant="danger"
            size="sm"
            icon="solar:trash-bin-trash-linear"
            loading={busy}
            onClick={() => void handleDelete()}
          >
            Supprimer le compte
          </Button>
        </div>
      </div>
    </div>
  );
}
