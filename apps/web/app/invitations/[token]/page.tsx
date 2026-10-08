'use client';

import { API_URL } from '@/lib/config';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Preview = {
  organization: { id: string; name: string; cityLabel: string | null };
  role: string;
  email: string | null;
  hasAccount: boolean;
  methods: string[];
  expiresAt: string;
};

/**
 * Invitation landing page (spec 02): the token is validated first, then the
 * invitee signs in with e-mail + password or Google and the invitation is
 * accepted with that session.
 */
export default function InvitationPage(): React.JSX.Element {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const router = useRouter();
  const { data: session, status } = useSession();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/invitations/${token}`, {
          headers: { Accept: 'application/json' },
        });
        const body = (await res.json().catch(() => null)) as Preview | null;
        if (!res.ok || !body) {
          throw new Error(
            (body as { message?: string } | null)?.message ??
              'Invitation invalide ou expirée',
          );
        }
        if (!cancelled) setPreview(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept(): Promise<void> {
    if (!session?.accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.message ?? 'Impossible d’accepter l’invitation');
      }
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  if (error && !preview) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      </main>
    );
  }

  if (!preview) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted">Vérification du lien…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold text-foreground">
          {preview.organization.name}
        </h1>
        <p className="text-sm text-muted">
          On vous invite à rejoindre cette organisation en tant que{' '}
          <span className="font-semibold text-foreground">{preview.role}</span>.
          {preview.email ? (
            <>
              {' '}
              Adresse invitée : <span className="text-foreground">{preview.email}</span>
            </>
          ) : null}
        </p>

        {status === 'authenticated' ? (
          <div className="space-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void accept()}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {busy ? 'Acceptation…' : 'Accepter l’invitation'}
            </button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <a
              href="/login"
              className="rounded-md border border-border px-4 py-2 text-center text-sm font-semibold text-foreground hover:border-accent"
            >
              Se connecter
            </a>
            <a
              href="/register"
              className="rounded-md border border-border px-4 py-2 text-center text-sm font-semibold text-foreground hover:border-accent"
            >
              Créer un compte
            </a>
          </div>
        )}

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <p className="text-xs text-muted">
          Ce lien est à usage unique et expire le{' '}
          {new Date(preview.expiresAt).toLocaleDateString('fr-FR')}.
        </p>
      </div>
    </main>
  );
}
