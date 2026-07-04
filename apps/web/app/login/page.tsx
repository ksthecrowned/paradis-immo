'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { DashIcon } from '@/components/dash-icon';
import { DASH_STAT_ICONS } from '@/lib/dash-icons';
import { requestOtp, verifyOtp, getTokens } from '@/lib/auth';
import { DEV_TEST_ACCOUNTS } from '@/lib/dev-test-accounts';

const isDev = process.env.NODE_ENV === 'development';

const inputClass =
  'block w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-input-focus-border focus:ring-input-focus-border';

const btnPrimaryClass =
  'inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50';

const btnSecondaryClass =
  'inline-flex w-full items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-sidebar';

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const [phone, setPhone] = useState('+242');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (typeof window !== 'undefined' && getTokens().accessToken) {
    router.replace('/owner/dashboard');
  }

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
      const session = await verifyOtp(phone.trim(), code.trim());
      const trimmedPhone = phone.trim();
      const devAccount = DEV_TEST_ACCOUNTS.find((a) => a.phone === trimmedPhone);
      if (devAccount?.path && devAccount.path !== '—') {
        router.replace(devAccount.path);
      } else if (session.user.roles?.includes('PLATFORM_ADMIN')) {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/owner/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
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
