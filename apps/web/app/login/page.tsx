'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { DashIcon } from '@/components/dash-icon';
import { useTheme } from '@/components/theme-provider';
import { DASH_ICONS, DASH_STAT_ICONS } from '@/lib/dash-icons';
import { useSession } from 'next-auth/react';
import { requestOtp, loginWithOtp, getClientSession } from '@/lib/auth';
import { DEV_TEST_ACCOUNTS } from '@/lib/dev-test-accounts';

const isDev = process.env.NODE_ENV === 'development';

const inputClass =
  'block w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-input-focus-border focus:ring-input-focus-border';

const btnPrimaryClass =
  'inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50';

const btnSecondaryClass =
  'inline-flex w-full items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-sidebar';

function resolvePostLoginPath(phone: string, roles: string[]): string {
  const devAccount = DEV_TEST_ACCOUNTS.find((a) => a.phone === phone);
  if (devAccount?.path && devAccount.path !== '—') {
    return devAccount.path;
  }
  if (roles.includes('PLATFORM_ADMIN')) {
    return '/admin/dashboard';
  }
  return '/owner/dashboard';
}

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [phone, setPhone] = useState('+242');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      router.replace(
        resolvePostLoginPath(session.user.phone, session.user.roles ?? []),
      );
    }
  }, [status, session, router]);

  async function onRequestOtp(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestOtp(phone.trim());
      setStage('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la requête');
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await loginWithOtp(phone.trim(), code.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const session = await getClientSession();
      const roles = session?.user?.roles ?? [];
      router.replace(resolvePostLoginPath(phone.trim(), roles));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute end-4 top-4 inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-card-hover hover:text-active"
        aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
        title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
      >
        <DashIcon
          icon={theme === 'dark' ? DASH_ICONS.sun : DASH_ICONS.moon}
          width={22}
          height={22}
        />
      </button>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent shadow-[0_4px_14px_rgba(102,88,221,0.35)]">
            <DashIcon icon={DASH_STAT_ICONS.buildings} width={28} height={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Paradis Immo</h1>
          <p className="mt-2 text-sm text-muted">
            Connectez-vous avec votre numéro WhatsApp
          </p>
        </div>

        {stage === 'phone' ? (
          <form
            onSubmit={onRequestOtp}
            className="rounded-xl border border-border bg-card p-6 shadow-lg"
          >
            <label
              htmlFor="phone"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Numéro de téléphone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              placeholder="+242069000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
            <p className="mt-2 text-xs text-muted">
              Nous vous enverrons un code à 6 chiffres (WhatsApp ou logs API en local).
            </p>
            {isDev ? (
              <div className="mt-4 rounded-lg border border-border bg-search/80 p-3 text-left">
                <p className="text-xs font-semibold text-heading">Comptes de test (seed)</p>
                <ul className="mt-2 space-y-1.5 text-xs text-muted">
                  {DEV_TEST_ACCOUNTS.map((account) => (
                    <li key={account.phone}>
                      <button
                        type="button"
                        onClick={() => setPhone(account.phone)}
                        className="text-start hover:text-foreground"
                      >
                        <span className="font-medium text-foreground">{account.role}</span>
                        {' — '}
                        <span className="font-mono">{account.phone}</span>
                        {account.path !== '—' ? (
                          <span className="text-muted"> → {account.path}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-muted">
                  Après « Recevoir le code », regarde le terminal API pour le code OTP.
                </p>
              </div>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className={`mt-5 ${btnPrimaryClass}`}>
              {busy ? 'Envoi…' : 'Recevoir le code'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={onVerifyOtp}
            className="rounded-xl border border-border bg-card p-6 shadow-lg"
          >
            <label
              htmlFor="code"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Code reçu par WhatsApp
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              required
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="1234"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputClass}
            />
            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className={`mt-5 ${btnPrimaryClass}`}>
              {busy ? 'Vérification…' : 'Se connecter'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage('phone');
                setCode('');
                setError(null);
              }}
              className={`mt-2 ${btnSecondaryClass}`}
            >
              Modifier le numéro
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
