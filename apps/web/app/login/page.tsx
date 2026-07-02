'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Building2 } from 'lucide-react';
import { requestOtp, verifyOtp, getTokens } from '@/lib/auth';

const inputClass =
  'block w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2.5 text-sm text-dash-text placeholder:text-dash-text-muted focus:border-dash-accent focus:ring-dash-accent';

const btnPrimaryClass =
  'inline-flex w-full items-center justify-center rounded-lg bg-dash-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-dash-accent/90 disabled:opacity-50';

const btnSecondaryClass =
  'inline-flex w-full items-center justify-center rounded-lg border border-dash-border bg-dash-card px-4 py-2.5 text-sm font-medium text-dash-text hover:bg-dash-sidebar';

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
      await verifyOtp(phone.trim(), code.trim());
      router.replace('/owner/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-dash-bg px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-dash-accent/15 text-dash-accent">
            <Building2 className="size-7" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-dash-text">Paradis Immo</h1>
          <p className="mt-2 text-sm text-dash-text-muted">
            Connectez-vous avec votre numéro WhatsApp
          </p>
        </div>

        {stage === 'phone' ? (
          <form
            onSubmit={onRequestOtp}
            className="rounded-xl border border-dash-border bg-dash-card p-6 shadow-lg"
          >
            <label
              htmlFor="phone"
              className="mb-2 block text-sm font-medium text-dash-text"
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
            <p className="mt-2 text-xs text-dash-text-muted">
              Nous vous enverrons un code à 4 chiffres par WhatsApp.
            </p>
            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-dash-danger/10 px-3 py-2 text-sm text-dash-danger"
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
            className="rounded-xl border border-dash-border bg-dash-card p-6 shadow-lg"
          >
            <label
              htmlFor="code"
              className="mb-2 block text-sm font-medium text-dash-text"
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
                className="mt-3 rounded-lg bg-dash-danger/10 px-3 py-2 text-sm text-dash-danger"
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
