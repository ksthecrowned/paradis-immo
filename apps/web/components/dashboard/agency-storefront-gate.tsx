'use client';

import { DashIcon } from '@/components/dash-icon';
import { useRequireSession } from '@/hooks/use-require-session';
import {
  AGENCY_STOREFRONT_GATE_EVENT,
  agencyStorefrontNeedsSetup,
  isAgencyStorefrontCompleteCached,
  setAgencyStorefrontCompleteCached,
} from '@/lib/agent/storefront-gate-storage';
import { listMyOrganizations } from '@/lib/me';
import { ROUTES } from '@/lib/routes';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const STOREFRONT_ROUTE = ROUTES.agent.storefront;

type GatePhase = 'boot' | 'checking' | 'ready' | 'error';

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

  const [cacheVersion, setCacheVersion] = useState(0);
  const cachedComplete =
    Boolean(userId) && isAgencyStorefrontCompleteCached(userId);

  const [retry, setRetry] = useState(0);
  const [phase, setPhase] = useState<GatePhase>('boot');
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    function onCacheChange(): void {
      setCacheVersion((value) => value + 1);
    }
    window.addEventListener(AGENCY_STOREFRONT_GATE_EVENT, onCacheChange);
    return () =>
      window.removeEventListener(AGENCY_STOREFRONT_GATE_EVENT, onCacheChange);
  }, []);

  useEffect(() => {
    if (!ready || !userId || cachedComplete) return;

    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setPhase('checking');
      try {
        const organizations = await listMyOrganizations();
        if (cancelled) return;
        const incomplete = agencyStorefrontNeedsSetup(organizations);
        if (!incomplete) {
          setAgencyStorefrontCompleteCached(userId, true);
        }
        setNeedsSetup(incomplete);
        setPhase('ready');
      } catch {
        if (!cancelled) setPhase('error');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cachedComplete, ready, retry, userId, cacheVersion]);

  const showBlockingModal =
    !isStorefrontPage && !cachedComplete && phase === 'ready' && needsSetup;

  useEffect(() => {
    if (!showBlockingModal) return;
    function blockEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') event.preventDefault();
    }
    window.addEventListener('keydown', blockEscape, true);
    return () => window.removeEventListener('keydown', blockEscape, true);
  }, [showBlockingModal]);

  if (isStorefrontPage || cachedComplete) {
    return <>{children}</>;
  }

  if (phase === 'error') {
    return (
      <div className="mx-auto flex min-h-72 max-w-xl items-center justify-center">
        <div className="w-full rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold text-heading">
            Vérification impossible
          </h1>
          <p className="mt-2 text-sm text-muted">
            Nous n’avons pas pu vérifier la configuration de votre vitrine.
            Réessayez pour accéder à votre espace.
          </p>
          <button
            type="button"
            onClick={() => {
              setPhase('boot');
              setRetry((value) => value + 1);
            }}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (phase !== 'ready') {
    return (
      <div className="mx-auto flex min-h-72 max-w-xl items-center justify-center">
        <div className="w-full rounded-2xl border border-border bg-card p-6 text-center">
          <p role="status" className="text-sm text-muted">
            Vérification de la vitrine de votre agence…
          </p>
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
            className="w-full max-w-md rounded-2xl border border-border bg-table p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <DashIcon icon="mdi:storefront-outline" className="size-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <h2
                  id="agency-storefront-gate-title"
                  className="text-base font-semibold text-heading"
                >
                  Configuration manquante
                </h2>
                <p
                  id="agency-storefront-gate-desc"
                  className="text-sm text-muted"
                >
                  La vitrine publique de votre agence n’est pas encore
                  configurée. Complétez-la pour accéder à votre espace.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Link
                href={STOREFRONT_ROUTE}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Configurer la vitrine
                <DashIcon
                  icon="solar:alt-arrow-right-linear"
                  className="size-4"
                />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
