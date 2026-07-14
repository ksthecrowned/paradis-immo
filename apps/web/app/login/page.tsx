'use client';

import { DashIcon } from '@/components/dash-icon';
import { useTheme } from '@/components/theme-provider';
import { loginWithPassword } from '@/lib/auth';
import { DASH_ICONS } from '@/lib/dash-icons';
import { resolveDashboardPath } from '@/lib/web-account';
import { signIn, useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';

const inputClass =
  'block w-full rounded-xl border border-input-border bg-search px-3.5 py-3 text-sm text-foreground placeholder:text-placeholder transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

const btnPrimaryClass =
  'inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50';

const btnSecondaryClass =
  'inline-flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-card-hover disabled:opacity-50';

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';

function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      router.replace(resolveDashboardPath(session.user));
    }
  }, [status, session, router]);

  useEffect(() => {
    const code = searchParams.get('error');
    if (!code) return;
    if (code === 'Configuration') {
      setError(
        'Connexion Google indisponible (configuration ou réseau). Utilisez email / mot de passe, ou redémarrez le serveur web.',
      );
      return;
    }
    setError('Connexion refusée. Réessayez ou créez un compte.');
  }, [searchParams]);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await loginWithPassword(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { getSession } = await import('next-auth/react');
      const next = await getSession();
      router.refresh();
      router.replace(
        next?.user ? resolveDashboardPath(next.user) : '/onboarding/role',
      );
    } catch {
      setError('Connexion impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[280px] w-[280px] translate-x-1/4 translate-y-1/4 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-5 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-foreground"
        >
          <Image
            src="/landing/logo.svg"
            alt=""
            width={32}
            height={32}
            className="size-8"
            priority
          />
          <span className="text-lg font-bold tracking-tight">Paradis Immo</span>
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-card-hover hover:text-foreground"
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
        <div className="w-full max-w-[420px]">
          <div className="mb-8 text-center sm:text-start">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Bon retour
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Connectez-vous pour gérer vos biens, mandats et paiements.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            {googleEnabled ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  className={btnSecondaryClass}
                  onClick={() =>
                    void signIn('google', { callbackUrl: '/onboarding/role' })
                  }
                >
                  <Image
                    src="/google-icon-logo-svgrepo-com.svg"
                    alt=""
                    width={22}
                    height={22}
                    className="size-[22px] shrink-0"
                    aria-hidden
                  />
                  Continuer avec Google
                </button>

                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">
                    ou
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </>
            ) : null}

            <form
              onSubmit={(e) => void onSubmit(e)}
              className="space-y-4"
            >
              <div className="space-y-2.5">
                <label
                  htmlFor="login-email"
                  className="block text-sm font-medium text-foreground"
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="vous@exemple.com"
                />
              </div>
              <div className="space-y-2.5">
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-foreground"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pe-11`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute end-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-foreground"
                    aria-label={
                      showPassword
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                  >
                    <DashIcon
                      icon={
                        showPassword ? DASH_ICONS.eyeOff : DASH_ICONS.eye
                      }
                      width={18}
                      height={18}
                    />
                  </button>
                </div>
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className={btnPrimaryClass}
              >
                {busy ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted">
            Pas encore de compte ?{' '}
            <Link
              href="/register"
              className="font-semibold text-accent hover:underline"
            >
              Créer un compte
            </Link>
          </p>

          {process.env.NODE_ENV === 'development' ? (
            <p className="mt-4 rounded-xl border border-dashed border-border bg-card/60 px-3 py-2.5 text-center text-xs text-muted">
              Seed admin : admin@paradisimmo.cg / Admin123!
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted">
          Chargement…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
