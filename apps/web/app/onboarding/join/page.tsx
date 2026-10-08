'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const fieldClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent';

/** Paste an agency invitation code and land on its validation page. */
export default function JoinAgencyPage(): React.JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Collez le code reçu de votre gérant.');
      return;
    }
    // The emailed link is /invitations/<token> — accept a pasted full URL too.
    const token = trimmed.split('/invitations/').pop()!.split(/[/?#]/)[0]!;
    router.push(`/invitations/${token}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <form
        onSubmit={submit}
        className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold text-foreground">
          Rejoindre une agence
        </h1>
        <p className="text-sm text-muted">
          Saisissez le code d’invitation reçu de votre gérant. Vous pourrez vous
          connecter par e-mail et mot de passe, ou avec Google.
        </p>
        <input
          className={fieldClass}
          placeholder="Code d’invitation"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition"
        >
          Continuer
        </button>
      </form>
    </main>
  );
}
