'use client';

import { UserIdentity } from '@/components/dashboard';
import { appDialog } from '@/components/dialogs/app-dialog';
import { ApiErrorBanner, FormField, Input } from '@/components/forms';
import { Button } from '@/components/primitives/Button';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import { logout } from '@/lib/auth';
import {
  getMe,
  updateMe,
  type PublicUser,
} from '@/lib/me';
import { useCallback, useEffect, useState } from 'react';

export function ProfileAccount(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getMe();
      setUser(me);
      setName(me.name ?? '');
      setEmail(me.email ?? '');
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger votre profil.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  async function handleSave(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const updated = await updateMe({
        name: name.trim() || undefined,
        email: email.trim(),
      });
      setUser(updated);
      setNotice('Modifications enregistrées.');
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’enregistrer les modifications.',
      );
    } finally {
      setSaving(false);
    }
  }

  function handleReset(): void {
    if (!user) return;
    setName(user.name ?? '');
    setEmail(user.email ?? '');
    setNotice(null);
    setError(null);
  }

  async function handleLogoutAll(): Promise<void> {
    if (
      !(await appDialog.confirm({
        title: 'Se déconnecter',
        message:
          'Vous allez être déconnecté de cette session. Reconnectez-vous pour continuer.',
        confirmLabel: 'Se déconnecter',
      }))
    ) {
      return;
    }
    await logout('/login');
  }

  if (!ready || loading) {
    return <p className="text-sm text-muted">Chargement du profil…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold leading-7 text-foreground">
          Détails du compte
        </h2>
        <p className="mt-1 text-sm text-muted">
          Mettez à jour vos informations visibles sur le portail.
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

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserIdentity
            name={name || user?.name}
            avatarUrl={user?.avatarUrl}
            fallbackName="Mon compte"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <FormField name="name" label="Nom complet">
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jean Mabiala"
            />
          </FormField>

          <FormField name="email" label="Adresse e-mail" required>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              required
            />
          </FormField>

          <FormField name="phone" label="Téléphone">
            <Input
              id="phone"
              name="phone"
              value={user?.phone ?? ''}
              readOnly
              disabled
              className="opacity-80"
            />
          </FormField>

          <FormField name="createdAt" label="Membre depuis">
            <Input
              id="createdAt"
              name="createdAt"
              value={
                user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'
              }
              readOnly
              disabled
              className="opacity-80"
            />
          </FormField>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleReset}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            Enregistrer
          </Button>
        </div>
      </form>

      <div className="border-t border-border pt-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="mb-1 text-sm font-medium text-foreground">
              Se déconnecter
            </p>
            <p className="text-xs text-muted">
              Terminer la session active sur ce navigateur.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon="solar:logout-2-linear"
            onClick={() => void handleLogoutAll()}
          >
            Déconnexion
          </Button>
        </div>
      </div>
    </div>
  );
}
