'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  createLeaseTemplate,
  deleteLeaseTemplate,
  listLeaseTemplates,
  updateLeaseTemplate,
  type LeaseTemplateItem,
} from '@/lib/agent/lease-templates';
import { listMyOrganizations, type PublicOrganization } from '@/lib/me';

/**
 * Spec 04 P2 — modèles de bail.
 *
 * Réservé au gérant (ADMIN) d'une agence : il rédige les corps de contrat
 * réutilisés à la création d'un bail. Un seul modèle peut être par défaut.
 */
export function LeaseTemplatesManager(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [organizations, setOrganizations] = useState<PublicOrganization[]>([]);
  const [orgId, setOrgId] = useState<string>('');
  const [rows, setRows] = useState<LeaseTemplateItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', body: '', isDefault: false });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    void listMyOrganizations()
      .then((orgs) => {
        const gerants = orgs.filter((o) => o.memberRole === 'ADMIN');
        setOrganizations(gerants);
        if (gerants[0]) setOrgId(gerants[0].id);
        else setError('Seul le gérant d’une agence peut gérer les modèles de bail.');
      })
      .catch(() => setError('Impossible de charger vos agences.'));
  }, [ready]);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      setRows(await listLeaseTemplates(orgId));
    } catch {
      setRows([]);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (name: string, fn: () => Promise<unknown>) => {
      setBusy(name);
      setError(null);
      try {
        await fn();
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Action impossible.');
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const handleSubmit = useCallback(() => {
    if (editingId) {
      void run(`edit-${editingId}`, async () => {
        await updateLeaseTemplate(orgId, editingId, form);
        setForm({ name: '', body: '', isDefault: false });
        setEditingId(null);
      });
      return;
    }
    void run('create', async () => {
      await createLeaseTemplate(orgId, form);
      setForm({ name: '', body: '', isDefault: false });
    });
  }, [editingId, form, orgId, run]);

  return (
    <div className="space-y-5">
      <DashboardPageHeader title="Modèles de bail" />

      {error ? (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {organizations.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="template-org"
            className="text-sm font-medium text-heading"
          >
            Agence
          </label>
          <select
            id="template-org"
            value={orgId}
            onChange={(event) => setOrgId(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <section className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-heading">
          {editingId ? 'Modifier le modèle' : 'Nouveau modèle'}
        </h2>
        <div className="space-y-3">
          <input
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="Nom du modèle (ex. Bail standard 3 ans)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <textarea
            value={form.body}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, body: event.target.value }))
            }
            rows={10}
            placeholder="Corps du contrat. Variables disponibles : {{loyer}}, {{caution}}, {{charges}}, {{dateDebut}}, {{dateFin}}, {{adresse}}, {{locataire}}, {{bailleur}}."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
          />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isDefault: event.target.checked }))
              }
            />
            Modèle par défaut
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy !== null || !orgId}
            onClick={handleSubmit}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
          >
            {busy === 'create' || busy?.startsWith('edit-')
              ? 'Enregistrement…'
              : editingId
                ? 'Enregistrer'
                : 'Créer le modèle'}
          </button>
          {editingId ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                setEditingId(null);
                setForm({ name: '', body: '', isDefault: false });
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
            >
              Annuler
            </button>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Aucun modèle pour cette agence.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-heading">
                      {row.name}
                    </span>
                    {row.isDefault ? (
                      <StatusBadge label="Par défaut" tone="accent" />
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">
                    {row.body}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!row.isDefault ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(`default-${row.id}`, () =>
                          updateLeaseTemplate(orgId, row.id, {
                            isDefault: true,
                          }),
                        )
                      }
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                    >
                      Définir par défaut
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setEditingId(row.id);
                      setForm({
                        name: row.name,
                        body: row.body,
                        isDefault: row.isDefault,
                      });
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      if (!confirm(`Supprimer le modèle « ${row.name} » ?`)) return;
                      void run(`delete-${row.id}`, () =>
                        deleteLeaseTemplate(orgId, row.id),
                      );
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-danger hover:bg-card-hover disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}