'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { backendWebMagicConsume } from '@/lib/backend-auth';
import { loginWithPassword } from '@/lib/auth';
import { DashIcon } from '@/components/dash-icon';
import { DASH_ICONS } from '@/lib/dash-icons';

const inputClass =
  'block w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder focus:border-input-focus-border focus:ring-input-focus-border';

const btnPrimaryClass =
  'inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50';

function MagicForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!token) {
      setError('Lien invalide');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tokens = await backendWebMagicConsume(token, password);
      const email = tokens.user.email;
      if (!email) {
        setError('Email manquant après vérification');
        return;
      }
      const result = await loginWithPassword(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace('/auth/continue');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-foreground">
          Définir votre mot de passe
        </h1>
        <p className="mt-2 text-sm text-muted">
          Votre email est vérifié. Choisissez un mot de passe (8 caractères
          minimum).
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Mot de passe</span>
            <div className="relative">
              <input
                id="magic-password"
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
                className="absolute inset-e-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-foreground"
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
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Confirmation</span>
            <div className="relative">
              <input
                id="magic-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="confirm-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`${inputClass} pe-11`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute inset-e-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-foreground"
                aria-label={
                  showConfirm
                    ? 'Masquer la confirmation'
                    : 'Afficher la confirmation'
                }
              >
                <DashIcon
                  icon={
                    showConfirm ? DASH_ICONS.eyeOff : DASH_ICONS.eye
                  }
                  width={18}
                  height={18}
                />
              </button>
            </div>
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={busy || !token} className={btnPrimaryClass}>
            {busy ? 'Validation…' : 'Continuer'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function MagicPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted">Chargement…</div>}>
      <MagicForm />
    </Suspense>
  );
}
