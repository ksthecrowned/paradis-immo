'use client';

import { registerWeb } from '@/lib/auth';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

const inputClass =
  'block w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder focus:border-input-focus-border focus:ring-input-focus-border';

const btnPrimaryClass =
  'inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50';

export default function RegisterPage(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await registerWeb(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-foreground">Créer un compte</h1>
        <p className="mt-2 text-sm text-muted">
          Vous recevrez un email avec un lien pour vérifier votre adresse email.
        </p>

        {sent ? (
          <div className="mt-4 space-y-3 text-sm text-muted">
            <p>
              Si l&apos;adresse est valide, un lien a été envoyé à{' '}
              <strong className="text-foreground">{email}</strong>.
            </p>
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="vous@exemple.com"
              />
            </label>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className={btnPrimaryClass}>
              {busy ? 'Envoi…' : 'Recevoir le lien'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
