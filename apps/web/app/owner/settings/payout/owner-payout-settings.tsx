'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import { listMyOrganizations, type PublicOrganization } from '@/lib/me';
import {
  createPayoutAccount,
  deletePayoutAccount,
  getPayoutSettings,
  listPayoutAccounts,
  updatePayoutAccount,
  updatePayoutSettings,
  verifyPayoutAccount,
  type PayoutAccount,
  type PayoutSettings,
} from '@/lib/owner/payouts';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';
import Link from 'next/link';

type Notice = { tone: 'success' | 'danger'; message: string } | null;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Spec 05 — /owner/settings/payout : comptes de reversement (création,
 * vérification sandbox, défaut, suppression) et paramètres (fréquence,
 * montant minimum).
 */
export function OwnerPayoutSettingsPage(): React.JSX.Element {
  const { ready } = useRequireSession();

  const [orgs, setOrgs] = useState<PublicOrganization[]>([]);
  const [orgId, setOrgId] = useState('');
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [settings, setSettings] = useState<PayoutSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const [freq, setFreq] = useState<'MONTHLY' | 'ON_DEMAND'>('MONTHLY');
  const [minAmount, setMinAmount] = useState('10000');
  const [savingSettings, setSavingSettings] = useState(false);

  const [type, setType] = useState<'MOBILE_MONEY' | 'BANK'>('MOBILE_MONEY');
  const [holderName, setHolderName] = useState('');
  const [phone, setPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadAccounts = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const [accountRows, currentSettings] = await Promise.all([
        listPayoutAccounts(id),
        getPayoutSettings(id),
      ]);
      setAccounts(accountRows);
      setSettings(currentSettings);
      setFreq(
        currentSettings.payoutFrequency === 'ON_DEMAND' ? 'ON_DEMAND' : 'MONTHLY',
      );
      setMinAmount(currentSettings.minPayoutAmount);
      setNotice(null);
    } catch (err) {
      setNotice({
        tone: 'danger',
        message: errorMessage(err, 'Impossible de charger les comptes.'),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      try {
        const organizations = await listMyOrganizations();
        const ownerOrgs = organizations.filter((o) => o.memberRole === 'OWNER');
        const usable = ownerOrgs.length > 0 ? ownerOrgs : organizations;
        setOrgs(usable);
        if (usable[0]) setOrgId(usable[0].id);
        await loadAccounts(usable[0]?.id ?? '');
      } catch (err) {
        setNotice({
          tone: 'danger',
          message: errorMessage(err, 'Impossible de charger votre organisation.'),
        });
        setLoading(false);
      }
    })();
  }, [ready, loadAccounts]);

  const handleSaveSettings = useCallback(async () => {
    if (!orgId) return;
    setSavingSettings(true);
    try {
      const updated = await updatePayoutSettings(orgId, {
        payoutFrequency: freq,
        minPayoutAmount: Number(minAmount),
      });
      setSettings(updated);
      setNotice({ tone: 'success', message: 'Paramètres enregistrés.' });
    } catch (err) {
      setNotice({
        tone: 'danger',
        message: errorMessage(err, 'Impossible d’enregistrer les paramètres.'),
      });
    } finally {
      setSavingSettings(false);
    }
  }, [orgId, freq, minAmount]);

  const handleCreate = useCallback(async () => {
    if (!orgId) return;
    setCreating(true);
    try {
      await createPayoutAccount(orgId, {
        type,
        holderName,
        ...(type === 'MOBILE_MONEY' ? { phone } : { bankName, accountNumber }),
        isDefault,
      });
      setNotice({ tone: 'success', message: 'Compte créé.' });
      setHolderName('');
      setPhone('');
      setBankName('');
      setAccountNumber('');
      setIsDefault(false);
      await loadAccounts(orgId);
    } catch (err) {
      setNotice({
        tone: 'danger',
        message: errorMessage(err, 'Impossible de créer le compte.'),
      });
    } finally {
      setCreating(false);
    }
  }, [orgId, type, holderName, phone, bankName, accountNumber, isDefault, loadAccounts]);

  const handleVerify = useCallback(
    async (account: PayoutAccount) => {
      if (!orgId) return;
      const code = window.prompt(
        'Code de vérification (sandbox : 1 = micro-dépôt de 1 XAF, 000000 = OTP simulé)',
      );
      if (!code) return;
      try {
        await verifyPayoutAccount(orgId, account.id, code.trim());
        setNotice({ tone: 'success', message: 'Compte vérifié.' });
        await loadAccounts(orgId);
      } catch (err) {
        setNotice({
          tone: 'danger',
          message: errorMessage(err, 'Vérification impossible.'),
        });
      }
    },
    [orgId, loadAccounts],
  );

  const handleSetDefault = useCallback(
    async (account: PayoutAccount) => {
      if (!orgId) return;
      try {
        await updatePayoutAccount(orgId, account.id, { isDefault: true });
        setNotice({ tone: 'success', message: 'Compte par défaut mis à jour.' });
        await loadAccounts(orgId);
      } catch (err) {
        setNotice({
          tone: 'danger',
          message: errorMessage(err, 'Impossible de définir le défaut.'),
        });
      }
    },
    [orgId, loadAccounts],
  );

  const handleDelete = useCallback(
    async (account: PayoutAccount) => {
      if (!orgId) return;
      if (!confirm('Supprimer ce compte de reversement ?')) return;
      try {
        await deletePayoutAccount(orgId, account.id);
        setNotice({ tone: 'success', message: 'Compte supprimé.' });
        await loadAccounts(orgId);
      } catch (err) {
        setNotice({
          tone: 'danger',
          message: errorMessage(err, 'Impossible de supprimer le compte.'),
        });
      }
    },
    [orgId, loadAccounts],
  );

  if (!ready) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-muted">Chargement…</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Comptes de reversement"
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.owner.dashboard },
          { label: 'Paiements', href: ROUTES.owner.payments },
          { label: 'Reversements' },
        ]}
        actions={
          <Link
            href={ROUTES.owner.payments}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover"
          >
            Retour aux paiements
          </Link>
        }
      />

      {notice ? (
        <div
          role="alert"
          className={
            notice.tone === 'success'
              ? 'rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success'
              : 'rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger'
          }
        >
          {notice.message}
        </div>
      ) : null}

      {orgs.length > 1 ? (
        <label className="block text-sm">
          <span className="text-muted">Organisation</span>
          <select
            value={orgId}
            onChange={(e) => {
              setOrgId(e.target.value);
              void loadAccounts(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Paramètres de reversement */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium">Paramètres de reversement</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">Fréquence</span>
            <select
              value={freq}
              onChange={(e) =>
                setFreq(e.target.value === 'ON_DEMAND' ? 'ON_DEMAND' : 'MONTHLY')
              }
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="MONTHLY">Mensuelle</option>
              <option value="ON_DEMAND">À la demande</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted">Seuil minimum (XAF)</span>
            <input
              type="number"
              min={0}
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={savingSettings || !orgId}
          onClick={() => void handleSaveSettings()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
        >
          {savingSettings ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {settings ? (
          <p className="text-xs text-muted">
            Actuel : {settings.payoutFrequency === 'ON_DEMAND' ? 'à la demande' : 'mensuelle'}{' '}
            · seuil {settings.minPayoutAmount} XAF
          </p>
        ) : null}
      </div>

      {/* Liste des comptes */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium">Comptes</h2>
        {loading ? (
          <p className="text-sm text-muted">Chargement…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted">
            Aucun compte. Ajoutez un compte mobile money ou bancaire puis
            vérifiez-le (sandbox : code 1 ou 000000).
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {account.type === 'BANK' ? 'Banque' : 'Mobile money'}
                      {account.bankName ? ` · ${account.bankName}` : ''}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {account.type === 'BANK'
                        ? `****${(account.accountNumber ?? '').slice(-4)}`
                        : account.phone}
                    </span>
                    {account.isDefault ? (
                      <StatusBadge label="Défaut" tone="accent" />
                    ) : null}
                    {account.verifiedAt ? (
                      <StatusBadge label="Vérifié" tone="success" />
                    ) : (
                      <StatusBadge label="À vérifier" tone="warning" />
                    )}
                  </div>
                  <div className="text-xs text-muted">{account.holderName}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!account.verifiedAt ? (
                    <button
                      type="button"
                      onClick={() => void handleVerify(account)}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent/90"
                    >
                      Vérifier
                    </button>
                  ) : null}
                  {!account.isDefault ? (
                    <button
                      type="button"
                      onClick={() => void handleSetDefault(account)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
                    >
                      Défaut
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleDelete(account)}
                    className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Création */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium">Ajouter un compte</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">Type</span>
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value === 'BANK' ? 'BANK' : 'MOBILE_MONEY')
              }
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="MOBILE_MONEY">Mobile money</option>
              <option value="BANK">Banque</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted">Titulaire</span>
            <input
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </label>
          {type === 'MOBILE_MONEY' ? (
            <label className="block text-sm">
              <span className="text-muted">Numéro</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+24207…"
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </label>
          ) : (
            <>
              <label className="block text-sm">
                <span className="text-muted">Banque</span>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Numéro de compte</span>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              </label>
            </>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Compte par défaut
          </label>
        </div>
        <button
          type="button"
          disabled={creating || !orgId || !holderName}
          onClick={() => void handleCreate()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
        >
          {creating ? 'Création…' : 'Créer le compte'}
        </button>
      </div>
    </section>
  );
}
