'use client';

import { apiFetch } from '@/lib/api';
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

interface MyOrgRequest {
  id: string;
  reference: string;
  type: 'OWNER' | 'AGENCY';
  status: 'PENDING' | 'INVITED' | 'REJECTED';
  rejectionReason: string | null;
}

export default function OnboardingRolePage(): React.JSX.Element {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [myRequest, setMyRequest] = useState<MyOrgRequest | null>(null);
  const [checking, setChecking] = useState(true);
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
      return;
    }

    // Already submitted a dossier in a previous session? Show its follow-up
    // state instead of asking the user to choose a parcours again (spec 02).
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ requests: MyOrgRequest[] }>(
          '/organizations/requests/mine',
        );
        if (cancelled) return;
        const latest =
          res.requests.find((r) => r.status === 'PENDING') ??
          res.requests[0] ??
          null;
        setMyRequest(latest);
      } catch {
        // Non-blocking: fall back to the normal chooser.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session, router]);

  function submitNewRequest(): void {
    router.push('/onboarding/request');
  }

  function joinAgency(): void {
    router.push('/onboarding/join');
  }

  if (status === 'loading' || (status === 'authenticated' && checking)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <p className="text-sm text-muted">Chargement…</p>
      </main>
    );
  }

  if (myRequest?.status === 'PENDING') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-lg space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-bold text-foreground">
            Votre demande est en cours d’examen
          </h1>
          <p className="text-sm text-muted">
            Vous avez déjà enregistré une demande ({' '}
            {myRequest.type === 'AGENCY' ? 'Agence' : 'Propriétaire'} — «{' '}
            {myRequest.reference} » ). Un administrateur va vérifier votre
            dossier puis vous adresser un lien d’invitation. Rien d’autre à
            faire pour l’instant.
          </p>
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

  if (myRequest?.status === 'REJECTED') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-lg space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-bold text-foreground">
            Votre demande a été refusée
          </h1>
          <p className="text-sm text-muted">
            Dossier « {myRequest.reference} » rejeté le{' '}
            {new Date().toLocaleDateString('fr-FR')}
            {myRequest.rejectionReason ? ` : ${myRequest.rejectionReason}` : ''}
            . Vous pouvez soumettre une nouvelle demande.
          </p>
          <button
            type="button"
            onClick={submitNewRequest}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Déposer une nouvelle demande
          </button>
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
          className={btnClass}
          onClick={submitNewRequest}
        >
          <span className="text-lg font-semibold text-foreground">
            Propriétaire
          </span>
          <span className="mt-1 text-sm text-muted">
            Déposez votre demande : vous recevrez un lien d’invitation.
          </span>
        </button>

        <button
          type="button"
          className={btnClass}
          onClick={submitNewRequest}
        >
          <span className="text-lg font-semibold text-foreground">
            Je crée mon agence
          </span>
          <span className="mt-1 text-sm text-muted">
            Nom, RCCM, NIU : l’administrateur vérifie puis vous invite.
          </span>
        </button>

        <button
          type="button"
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
