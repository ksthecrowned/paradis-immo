'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { DashIcon } from '@/components/dash-icon';
import { useTheme } from '@/components/theme-provider';
import { DASH_ICONS } from '@/lib/dash-icons';

const inputClass =
  'block w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-input-focus-border focus:ring-input-focus-border';

const btnPrimaryClass =
  'inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50';

const btnSecondaryClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-sidebar disabled:opacity-50';

const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED);

function AdminLoginForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oauthError = searchParams.get('error');

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.roles?.includes('PLATFORM_ADMIN')) {
      router.replace('/admin/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (oauthError === 'AccessDenied' || oauthError === 'Configuration') {
      setError(
        oauthError === 'Configuration'
          ? 'Google n’est pas configuré sur ce serveur.'
          : 'Compte Google non autorisé pour l’admin.',
      );
    }
  }, [oauthError]);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signIn('admin-password', {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (!result || result.error) {
        setError('Email ou mot de passe incorrect');
        return;
      }
      router.replace('/admin/dashboard');
      router.refresh();
    } catch {
      setError('Connexion impossible');
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle(): Promise<void> {
    setBusy(true);
    setError(null);
    await signIn('google', { callbackUrl: '/admin/dashboard' });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <Link href="/" className="text-sm font-semibold text-accent">
          Paradis Immo
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg border border-border p-2 text-muted hover:text-foreground"
          aria-label="Basculer le thème"
        >
          <DashIcon
            icon={theme === 'dark' ? DASH_ICONS.sun : DASH_ICONS.moon}
            className="size-5"
          />
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="mt-2 text-sm text-muted">
          Connexion par email et mot de passe, ou Google. Pas d’OTP téléphone.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="admin@paradisimmo.cg"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Mot de passe</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={busy} className={btnPrimaryClass}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        {googleEnabled ? (
          <>
            <div className="my-6 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onGoogle()}
              className={btnSecondaryClass}
            >
              Continuer avec Google
            </button>
          </>
        ) : (
          <p className="mt-6 text-xs text-muted">
            Google : configurez{' '}
            <code className="rounded bg-sidebar px-1">AUTH_GOOGLE_ID</code> /{' '}
            <code className="rounded bg-sidebar px-1">AUTH_GOOGLE_SECRET</code>{' '}
            et{' '}
            <code className="rounded bg-sidebar px-1">GOOGLE_CLIENT_ID</code>{' '}
            (API).
          </p>
        )}

        <p className="mt-8 text-center text-sm text-muted">
          Propriétaire ou agent ?{' '}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Connexion WhatsApp
          </Link>
        </p>

        {process.env.NODE_ENV === 'development' ? (
          <p className="mt-4 rounded-lg border border-border bg-card p-3 text-xs text-muted">
            Seed : <strong className="text-foreground">admin@paradisimmo.cg</strong> /{' '}
            <strong className="text-foreground">Admin123!</strong>
          </p>
        ) : null}
      </main>
    </div>
  );
}

export default function AdminLoginPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted">
          Chargement…
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
