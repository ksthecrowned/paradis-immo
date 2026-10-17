'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import {
  ApiErrorBanner,
  FormField,
  Input,
  PhoneInput,
  getPhoneE164,
  isPhoneComplete,
} from '@/components/forms';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import {
  agencyClientKindLabel,
  createExternalAgencyClient,
  linkExistingAgencyClient,
  listAgencyClients,
  lookupAgencyClientAccount,
  type AgencyClientLookupResult,
  type ListAgencyClientsFilter,
  type PublicAgencyClient,
} from '@/lib/agent/clients';
import { ApiError } from '@/lib/api';
import {
  agentOrganizationIds,
  isAgencyGerant,
  listMyOrganizations,
} from '@/lib/me';
import {
  DEFAULT_PHONE_COUNTRY,
  type PhoneCountrySelection,
} from '@/lib/phone';
import { ROUTES } from '@/lib/routes';

const FILTERS: { value: ListAgencyClientsFilter; label: string }[] = [
  { value: 'all', label: 'Actifs' },
  { value: 'linked', label: 'Avec compte' },
  { value: 'external', label: 'Externes' },
  { value: 'archived', label: 'Archivés' },
];

function kindTone(
  client: PublicAgencyClient,
): 'success' | 'warning' | 'neutral' {
  if (client.archivedAt) return 'neutral';
  return client.hasAccount ? 'success' : 'warning';
}

export function AgentClientsPage(): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isGerant, setIsGerant] = useState(false);
  const [rows, setRows] = useState<PublicAgencyClient[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<ListAgencyClientsFilter>('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState<'external' | 'link'>('external');
  const [displayName, setDisplayName] = useState('');
  const [phoneNational, setPhoneNational] = useState('');
  const [phoneCountry, setPhoneCountry] =
    useState<PhoneCountrySelection>(DEFAULT_PHONE_COUNTRY);
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<AgencyClientLookupResult | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const orgs = await listMyOrganizations();
        if (cancelled) return;
        setOrganizationId(agentOrganizationIds(orgs)[0] ?? null);
        setIsGerant(isAgencyGerant(orgs));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Impossible de charger votre agence.',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const load = useCallback(async () => {
    if (!organizationId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await listAgencyClients(organizationId, {
        filter,
        q: q.trim() || undefined,
        pageSize: 50,
      });
      setRows(res.data);
      setTotal(res.meta.total);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les clients.',
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId, filter, q]);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  const phoneE164 = getPhoneE164(phoneNational, phoneCountry);

  const handleLookup = async () => {
    if (!organizationId || !phoneE164) {
      setError('Numéro de téléphone invalide.');
      return;
    }
    setBusy(true);
    try {
      setLookup(await lookupAgencyClientAccount(organizationId, phoneE164));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Recherche impossible.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreateExternal = async () => {
    if (!organizationId || !phoneE164 || displayName.trim().length < 2) {
      setError('Nom et téléphone valides requis.');
      return;
    }
    setBusy(true);
    try {
      await createExternalAgencyClient(organizationId, {
        displayName: displayName.trim(),
        phone: phoneE164,
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setDisplayName('');
      setPhoneNational('');
      setEmail('');
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Création impossible.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleLink = async () => {
    if (!organizationId || !phoneE164) {
      setError('Numéro de téléphone invalide.');
      return;
    }
    setBusy(true);
    try {
      await linkExistingAgencyClient(organizationId, phoneE164);
      setLookup(null);
      setPhoneNational('');
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Liaison impossible.',
      );
    } finally {
      setBusy(false);
    }
  };

  const columns: ListColumn<PublicAgencyClient>[] = useMemo(
    () => [
      {
        key: 'displayName',
        label: 'Client',
        render: (_value, row) => (
          <div>
            <p className="font-medium text-heading">{row.displayName}</p>
            {row.phoneE164 ? (
              <p className="text-xs text-muted">{row.phoneE164}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: 'hasAccount',
        label: 'Type',
        render: (_value, row) => (
          <StatusBadge
            tone={kindTone(row)}
            label={agencyClientKindLabel(row)}
          />
        ),
      },
      {
        key: 'email',
        label: 'E-mail',
        render: (value) => (typeof value === 'string' && value ? value : '—'),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Clients"
        description="Portefeuille CRM de l’agence — contacts externes et comptes Paradis Immo."
      />

      {error ? <ApiErrorBanner message={error} /> : null}

      {isGerant ? (
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mode === 'external' ? 'primary' : 'secondary'}
              onClick={() => setMode('external')}
            >
              Contact externe
            </Button>
            <Button
              type="button"
              variant={mode === 'link' ? 'primary' : 'secondary'}
              onClick={() => setMode('link')}
            >
              Compte existant
            </Button>
          </div>

          <FormField name="phone" label="Téléphone" required>
            <PhoneInput
              name="clientPhone"
              label=""
              value={phoneNational}
              country={phoneCountry}
              onCountryChange={setPhoneCountry}
              onChange={setPhoneNational}
            />
          </FormField>

          {mode === 'external' ? (
            <>
              <FormField name="displayName" label="Nom" required>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nom du propriétaire"
                />
              </FormField>
              <FormField name="email" label="E-mail (facultatif)">
                <Input
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemple.com"
                />
              </FormField>
              <Button
                type="button"
                disabled={busy || !isPhoneComplete(phoneNational, phoneCountry)}
                onClick={() => void handleCreateExternal()}
              >
                Ajouter le contact
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    busy || !isPhoneComplete(phoneNational, phoneCountry)
                  }
                  onClick={() => void handleLookup()}
                >
                  Rechercher
                </Button>
                <Button
                  type="button"
                  disabled={
                    busy ||
                    !lookup?.exists ||
                    lookup.alreadyLinkedInOrg ||
                    !phoneE164
                  }
                  onClick={() => void handleLink()}
                >
                  Ajouter au CRM
                </Button>
              </div>
              {lookup ? (
                <p className="text-sm text-muted">
                  {lookup.exists
                    ? lookup.alreadyLinkedInOrg
                      ? `Déjà client de l’agence (${lookup.displayName ?? 'compte'}).`
                      : `Compte trouvé : ${lookup.displayName ?? 'utilisateur'}. Confirmez pour l’ajouter au CRM (sans accès aux biens).`
                    : 'Aucun compte Paradis Immo pour ce numéro.'}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Seul le gérant peut créer ou lier des fiches clients. Vous pouvez
          sélectionner un client existant lors de la création d’un bien.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <FormField name="q" label="Recherche">
          <Input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, téléphone…"
          />
        </FormField>
        <FormField name="filter" label="Filtre">
          <select
            id="filter"
            className="block w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-base"
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as ListAgencyClientsFilter)
            }
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </FormField>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Actualiser
        </Button>
      </div>

      <ListDataTable
        data={rows}
        columns={columns}
        loading={loading}
        onRefresh={() => void load()}
        entityLabel="clients"
        emptyMessage="Aucun client dans le portefeuille."
        tableId="agent-clients-table"
        onRowClick={(row) => {
          router.push(ROUTES.agent.client(row.id));
        }}
        actions={(row) => (
          <Link
            href={ROUTES.agent.client(row.id)}
            className="text-xs font-medium text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Voir
          </Link>
        )}
      />
      {!loading && total > 0 ? (
        <p className="text-xs text-muted">{total} client(s)</p>
      ) : null}
    </div>
  );
}
