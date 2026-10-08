'use client';

import { API_URL } from '@/lib/config';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

type RequestType = 'OWNER' | 'AGENCY';

const fieldClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent';

/**
 * Public sign-up form (spec 02 — no self-service creation).
 * Submitting grants nothing: a PLATFORM_ADMIN reviews the dossier and emails
 * an invitation link to the address given below.
 */
function RequestForm(): React.JSX.Element {
  const params = useSearchParams();
  const initialType = params.get('type') === 'AGENCY' ? 'AGENCY' : 'OWNER';

  const [type, setType] = useState<RequestType>(initialType);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [legalName, setLegalName] = useState('');
  const [rccm, setRccm] = useState('');
  const [niu, setNiu] = useState('');
  const [address, setAddress] = useState('');
  const [cityLabel, setCityLabel] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/organizations/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          type,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          legalName: legalName.trim() || undefined,
          rccm: rccm.trim() || undefined,
          niu: niu.trim() || undefined,
          address: address.trim() || undefined,
          cityLabel: cityLabel.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { reference?: string; message?: string }
        | null;
      if (!res.ok) {
        throw new Error(
          (body as { message?: string } | null)?.message ??
            'Impossible d’envoyer la demande',
        );
      }
      setReference(body?.reference ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-lg space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-bold text-foreground">Demande enregistrée</h1>
          <p className="text-sm text-muted">
            Votre dossier est en attente d’examen. Vous n’avez rien d’autre à
            faire : vous recevrez un lien d’invitation à cette adresse pour
            finaliser votre compte.
          </p>
          <p className="text-xs text-muted">Référence : {reference}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-background px-4 py-12">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold text-foreground">Demande d’ouverture</h1>
        <p className="text-sm text-muted">
          Le compte n’est pas ouvert immédiatement : un administrateur vérifie
          votre dossier puis vous adresse un lien d’invitation.
        </p>

        <div className="flex gap-2">
          {(['OWNER', 'AGENCY'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={
                'flex-1 rounded-md border px-3 py-2 text-sm font-medium ' +
                (type === t
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border text-muted')
              }
            >
              {t === 'OWNER' ? 'Propriétaire' : 'Agence'}
            </button>
          ))}
        </div>

        <input
          required
          className={fieldClass}
          placeholder="Nom *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          required
          type="email"
          className={fieldClass}
          placeholder="E-mail (recevra le lien d’invitation) *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className={fieldClass}
          placeholder="Téléphone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        {type === 'AGENCY' ? (
          <>
            <input
              className={fieldClass}
              placeholder="Raison sociale"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                className={fieldClass}
                placeholder="RCCM *"
                value={rccm}
                onChange={(e) => setRccm(e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="NIU"
                value={niu}
                onChange={(e) => setNiu(e.target.value)}
              />
            </div>
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <input
            className={fieldClass}
            placeholder="Adresse"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="Ville"
            value={cityLabel}
            onChange={(e) => setCityLabel(e.target.value)}
          />
        </div>

        <textarea
          className={fieldClass}
          rows={4}
          placeholder="Présentez votre activité"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {busy ? 'Envoi…' : 'Envoyer ma demande'}
        </button>
      </form>
    </main>
  );
}

export default function RequestPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <RequestForm />
    </Suspense>
  );
}
