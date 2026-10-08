'use client';

import { logout } from '@/lib/auth';
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
  const { data: session, status } = useSession();
  const [busy, setBusy] = useState<'OWNER' | 'AGENT' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (status !== 'authenticated' || !session) return;

    // Stale session after re-seed / revoked refresh → must clear cookie.
    if (session.error === 'RefreshAccessTokenError') {
      void logout('/login');
      return;
    }

    if (session.user && isWebAccountActive(session.user)) {
      router.replace(resolveDashboardPath(session.user));
    }
  }, [status, session, router]);

  async function choose(role: 'OWNER' | 'AGENT'): Promise<void> {
    // No self-service (spec 02): owner and agency accounts are opened by a
    // PLATFORM_ADMIN invitation. Both paths start at the sign-up form.
    void role;
    router.push('/onboarding/request');
  }

  function joinAgency(): void {
    router.push('/onboarding/join');
  }

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <p className="text-sm text-muted">Chargement…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-4">
        <h1 className="text-2xl font-bold text-foreground">
          Choisissez votre parcours
        </h1>
        <p className="text-sm text-muted">
          Aucune création en libre-service : le compte propriétaire et les
          agences sont ouverts par un administrateur après examen de votre
          demande. Les agents rejoignent une agence sur invitation de leur
          gérant.
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
            Déposez votre demande : vous recevrez un lien d’invitation.
          </span>
          {busy === 'OWNER' ? (
            <span className="mt-2 text-xs text-accent">Ouverture…</span>
          ) : null}
        </button>

        <button
          type="button"
          disabled={busy != null}
          className={btnClass}
          onClick={() => void choose('AGENT')}
        >
          <span className="text-lg font-semibold text-foreground">
            Je crée mon agence
          </span>
          <span className="mt-1 text-sm text-muted">
            Nom, RCCM, NIU : l’administrateur vérifie puis vous invite.
          </span>
          {busy === 'AGENT' ? (
            <span className="mt-2 text-xs text-accent">Envoi…</span>
          ) : null}
        </button>

        <button
          type="button"
          disabled={busy != null}
          className={btnClass}
          onClick={joinAgency}
        >
          <span className="text-lg font-semibold text-foreground">
            Je rejoins une agence
          </span>
          <span className="mt-1 text-sm text-muted">
            Saisissez le code d’invitation reçu de votre gérant.
          </span>
        </button>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <p className="pt-2 text-center text-sm text-muted">
          Mauvais compte ?{' '}
          <button
            type="button"
            className="font-semibold text-accent hover:underline"
            onClick={() => void logout('/login')}
          >
            Se déconnecter
          </button>
        </p>
      </div>
    </main>
  );
}
