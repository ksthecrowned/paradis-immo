'use client';

import { DashIcon } from '@/components/dash-icon';
import { ApiErrorBanner } from '@/components/forms';
import { Button } from '@/components/primitives/Button';
import { useTheme } from '@/components/theme-provider';
import { logout } from '@/lib/auth';
import { DASH_ICONS } from '@/lib/dash-icons';
import {
  cancelAccountDeletion,
  mapAccountDeletionCancelError,
  type AccountDeletionCancelErrorCode,
} from '@/lib/me';
import { resolveDashboardPath } from '@/lib/web-account';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ScreenState =
  | { kind: 'idle' }
  | { kind: 'success'; message: string }
  | {
      kind: 'error';
      code: AccountDeletionCancelErrorCode | 'UNKNOWN';
      message: string;
    };

export function CancelDeletionScreen(): React.JSX.Element {
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<ScreenState>({ kind: 'idle' });

  async function handleCancel(): Promise<void> {
    setBusy(true);
    setState({ kind: 'idle' });
    try {
      const result = await cancelAccountDeletion();
      setState({
        kind: 'success',
        message: result.message || 'Suppression annulée. Votre compte est de nouveau actif.',
      });
    } catch (err) {
      const mapped = mapAccountDeletionCancelError(err);
      setState({ kind: 'error', code: mapped.code, message: mapped.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleContinue(): Promise<void> {
    if (session?.user) {
      router.replace(resolveDashboardPath(session.user));
      return;
    }
    router.replace('/auth/continue');
  }

  const errorBanner =
    state.kind === 'error' ? state.message : null;

  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 h-105 w-180 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-70 w-70 translate-x-1/4 translate-y-1/4 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-5 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-foreground"
        >
          <Image
            src="/landing/logo.png"
            alt=""
            width={36}
            height={36}
            className="size-9"
            priority
          />
          <span className="text-lg font-semibold tracking-tight">
            Paradis Immobilier
          </span>
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-card-hover hover:text-active"
          aria-label="Basculer le thème"
        >
          <DashIcon
            icon={theme === 'dark' ? DASH_ICONS.sun : DASH_ICONS.moon}
            width={20}
            height={20}
          />
        </button>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12 pt-4">
        <div className="w-full max-w-105">
          <div className="mb-8 text-center sm:text-start">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Compte en suppression
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Votre compte est programmé pour suppression. Vous pouvez
              l’annuler pendant 30 jours tant que les données n’ont pas été
              anonymisées.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <ApiErrorBanner message={errorBanner} className="mb-0" />

            {state.kind === 'error' && state.code === 'ACCOUNT_DELETION_WINDOW_CLOSED' ? (
              <p className="mt-3 text-sm text-muted" role="status">
                Le délai légal de récupération est écoulé. Le compte ne peut
                plus être réactivé depuis cet écran.
              </p>
            ) : null}

            {state.kind === 'error' && state.code === 'ACCOUNT_ANONYMIZED' ? (
              <p className="mt-3 text-sm text-muted" role="status">
                Les données personnelles ont déjà été anonymisées. Contactez
                le support uniquement pour une question administrative, pas
                pour une réactivation.
              </p>
            ) : null}

            {state.kind === 'success' ? (
              <div className="space-y-4">
                <p
                  className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
                  role="status"
                >
                  {state.message}
                </p>
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  onClick={() => void handleContinue()}
                >
                  Continuer vers le portail
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {state.kind === 'idle' || state.kind === 'error' ? (
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full"
                    loading={busy}
                    disabled={
                      state.kind === 'error' &&
                      (state.code === 'ACCOUNT_DELETION_WINDOW_CLOSED' ||
                        state.code === 'ACCOUNT_ANONYMIZED')
                    }
                    onClick={() => void handleCancel()}
                  >
                    Annuler la suppression
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void logout('/login')}
                >
                  Se déconnecter
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
