'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { requestOtp, verifyOtp, getTokens } from '@/lib/auth';

/**
 * Two-step OTP login.
 *  - Step 1: phone → server sends a 4-digit code via WhatsApp
 *  - Step 2: code → server returns the JWT pair + user
 *  On success we redirect to the marketplace home.
 */
export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const [phone, setPhone] = useState('+242');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If we already have tokens, jump straight to the home page.
  if (typeof window !== 'undefined' && getTokens().accessToken) {
    router.replace('/');
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
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-neutral-900">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900 dark:text-white">
          Connexion à Paradis Immo
        </h1>

        {stage === 'phone' ? (
          <form
            onSubmit={onRequestOtp}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <label
              htmlFor="phone"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-neutral-300"
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
              className="block w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-neutral-400">
              Nous vous enverrons un code à 4 chiffres par WhatsApp.
            </p>
            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-200"
              >
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-5 inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Envoi…' : 'Recevoir le code'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={onVerifyOtp}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <label
              htmlFor="code"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-neutral-300"
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
              className="block w-full rounded-lg border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200"
            />
            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-200"
              >
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-5 inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Vérification…' : 'Se connecter'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage('phone');
                setCode('');
                setError(null);
              }}
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
            >
              Modifier le numéro
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
