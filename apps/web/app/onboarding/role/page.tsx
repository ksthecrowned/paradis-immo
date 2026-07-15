'use client';

import { backendWebSetRole } from '@/lib/backend-auth';
import {
    isWebAccountActive,
    resolveDashboardPath,
} from '@/lib/web-account';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const btnClass =
  'flex w-full flex-col items-start rounded-lg border border-border bg-card p-5 text-left shadow-sm transition hover:border-accent hover:bg-sidebar disabled:opacity-50';

export default function OnboardingRolePage(): React.JSX.Element {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [busy, setBusy] = useState<'OWNER' | 'AGENT' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (status === 'authenticated' && session?.user && isWebAccountActive(session.user)) {
      router.replace(resolveDashboardPath(session.user));
    }
  }, [status, session, router]);

  async function choose(role: 'OWNER' | 'AGENT'): Promise<void> {
    if (!session?.accessToken) return;
    setBusy(role);
    setError(null);
    try {
      const tokens = await backendWebSetRole(session.accessToken, role);
      await update({
        orgRoles: tokens.user.orgRoles,
        roles: tokens.user.roles,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      router.replace(resolveDashboardPath(tokens.user));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-4">
        <h1 className="text-2xl font-bold text-foreground">
          Choisissez votre rôle
        </h1>
        <p className="text-sm text-muted">
          Obligatoire pour activer votre compte web. Les administrateurs
          plateforme sont provisionnés séparément.
        </p>

        <button
          type="button"
          disabled={busy != null}
          className={btnClass}
          onClick={() => void choose('OWNER')}
        >
          <span className="text-lg font-semibold text-foreground">
            Propriétaire
          </span>
          <span className="mt-1 text-sm text-muted">
            Publier et gérer vos biens, baux et paiements.
          </span>
          {busy === 'OWNER' ? (
            <span className="mt-2 text-xs text-accent">Création…</span>
          ) : null}
        </button>

        <button
          type="button"
          disabled={busy != null}
          className={btnClass}
          onClick={() => void choose('AGENT')}
        >
          <span className="text-lg font-semibold text-foreground">Agent</span>
          <span className="mt-1 text-sm text-muted">
            Gérer le portefeuille Paradis Immo (agence plateforme).
          </span>
          {busy === 'AGENT' ? (
            <span className="mt-2 text-xs text-accent">Rattachement…</span>
          ) : null}
        </button>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
