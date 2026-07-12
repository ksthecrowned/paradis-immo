'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { DashIcon } from '@/components/dash-icon';
import { useTheme } from '@/components/theme-provider';
import { DASH_ICONS, DASH_STAT_ICONS } from '@/lib/dash-icons';
import { loginWithPassword } from '@/lib/auth';
import { resolveDashboardPath } from '@/lib/web-account';

const inputClass =
  'block w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-input-focus-border focus:ring-input-focus-border';

const btnPrimaryClass =
  'inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50';

const btnSecondaryClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-sidebar disabled:opacity-50';

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';

function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute end-4 top-4 inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted"
        aria-label="Basculer le thème"
      >
        <DashIcon
          icon={theme === 'dark' ? DASH_ICONS.sun : DASH_ICONS.moon}
          width={22}
          height={22}
        />
      </button>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent">
            <DashIcon
              icon={DASH_STAT_ICONS.buildings}
              width={28}
              height={28}
              className="text-white"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Paradis Immo</h1>
          <p className="mt-2 text-sm text-muted">
            Connexion propriétaire, agent ou admin
          </p>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-lg"
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="vous@exemple.com"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Mot de passe</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={busy} className={btnPrimaryClass}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        {googleEnabled ? (
          <button
            type="button"
            disabled={busy}
            className={`mt-4 ${btnSecondaryClass}`}
            onClick={() => void signIn('google', { callbackUrl: '/onboarding/role' })}
          >
            Continuer avec Google
          </button>
        ) : null}

        <p className="mt-6 text-center text-sm text-muted">
          Pas encore de compte ?{' '}
          <Link href="/register" className="font-semibold text-accent hover:underline">
            Créer un compte
          </Link>
        </p>

        {process.env.NODE_ENV === 'development' ? (
          <p className="mt-4 rounded-lg border border-border bg-card p-3 text-xs text-muted">
            Seed admin : admin@paradisimmo.cg / Admin123!
          </p>
        ) : null}
      </div>
    </main>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted">Chargement…</div>}>
      <LoginForm />
    </Suspense>
  );
}
