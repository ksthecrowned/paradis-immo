'use client';

import { AgencyStorefrontForm } from '@/components/dashboard/agency-storefront-form';
import { useRequireSession } from '@/hooks/use-require-session';
import {
  agencyStorefrontNeedsSetup,
  isAgencyStorefrontCompleteCached,
  setAgencyStorefrontCompleteCached,
} from '@/lib/agent/storefront-gate-storage';
import { listMyOrganizations } from '@/lib/me';
import { ROUTES } from '@/lib/routes';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const STOREFRONT_ROUTE = ROUTES.agent.storefront;

export function AgencyStorefrontGate({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? '';
  const pathname = usePathname() ?? '';
  const isStorefrontPage = pathname === STOREFRONT_ROUTE;

  const cachedComplete =
    Boolean(userId) && isAgencyStorefrontCompleteCached(userId);
  const [retry, setRetry] = useState(0);
  const [checking, setChecking] = useState(!cachedComplete);
  const [error, setError] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Sync after save on the settings page (no API — localStorage only).
  useEffect(() => {
    if (!userId) return;
    if (isAgencyStorefrontCompleteCached(userId)) {
      setNeedsSetup(false);
      setChecking(false);
      setError(false);
    }
  }, [pathname, userId]);

  useEffect(() => {
    if (!ready || !userId) return;

    if (isAgencyStorefrontCompleteCached(userId)) {
      setNeedsSetup(false);
      setChecking(false);
      setError(false);
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(async () => {
      setChecking(true);
      setError(false);
      try {
        const organizations = await listMyOrganizations();
        if (cancelled) return;
        const incomplete = agencyStorefrontNeedsSetup(organizations);
        if (!incomplete) {
          setAgencyStorefrontCompleteCached(userId, true);
        }
        setNeedsSetup(incomplete);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ready, retry, userId]);

  const handleComplete = useCallback(() => {
    if (userId) setAgencyStorefrontCompleteCached(userId, true);
    setNeedsSetup(false);
  }, [userId]);

  const showBlockingModal =
    !isStorefrontPage && !checking && !error && needsSetup;

  useEffect(() => {
    if (!showBlockingModal) return;
    function blockEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') event.preventDefault();
    }
    window.addEventListener('keydown', blockEscape, true);
    return () => window.removeEventListener('keydown', blockEscape, true);
  }, [showBlockingModal]);

  if (isStorefrontPage) {
    return <>{children}</>;
  }

  if ((!cachedComplete && checking) || error) {
    return (
      <div className="mx-auto flex min-h-72 max-w-xl items-center justify-center">
        <div className="w-full rounded-2xl border border-border bg-card p-6 text-center">
          {error ? (
            <>
              <h1 className="text-lg font-semibold text-heading">
                Vérification impossible
              </h1>
              <p className="mt-2 text-sm text-muted">
                Nous n’avons pas pu vérifier la configuration de votre vitrine.
                Réessayez pour accéder à votre espace.
              </p>
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Réessayer
              </button>
            </>
          ) : (
            <p role="status" className="text-sm text-muted">
              Vérification de la vitrine de votre agence…
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {showBlockingModal ? (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/55 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="agency-storefront-gate-title"
            aria-describedby="agency-storefront-gate-desc"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-table p-5 shadow-2xl sm:p-7"
            onKeyDown={(event) => {
              if (event.key === 'Escape') event.preventDefault();
            }}
          >
            <div className="mb-5 space-y-1">
              <h2
                id="agency-storefront-gate-title"
                className="text-lg font-semibold tracking-tight text-heading"
              >
                Configurer la vitrine de l’agence
              </h2>
              <p
                id="agency-storefront-gate-desc"
                className="text-sm text-muted"
              >
                Complétez les informations publiques de votre agence pour
                accéder à votre espace. Le nom public de la vitrine est
                obligatoire.
              </p>
            </div>
            <AgencyStorefrontForm
              onComplete={handleComplete}
              submitLabel="Enregistrer et continuer"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
