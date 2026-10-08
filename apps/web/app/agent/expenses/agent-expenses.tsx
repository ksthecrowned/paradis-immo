'use client';

import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { DetailCard } from '@/components/detail';
import { ApiErrorBanner } from '@/components/forms';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import {
  createExpense,
  expenseCategoryLabel,
  expenseStatusLabel,
  formatAmount,
  listExpenses,
  updateExpense,
  type PublicExpense,
} from '@/lib/accounting';
import { ApiError } from '@/lib/api';
import { listManagedProperties } from '@/lib/agent/portfolio';
import type { PublicProperty } from '@/lib/owner/properties';
import { useCallback, useEffect, useState } from 'react';

const CATEGORIES = ['REPAIR', 'TAX', 'INSURANCE', 'UTILITIES', 'OTHER'];
const STATUS_FILTERS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'PENDING_APPROVAL', label: 'En attente' },
  { value: 'APPROVED', label: 'Approuvées' },
  { value: 'REJECTED', label: 'Rejetées' },
  { value: 'PAID', label: 'Payées' },
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function expenseTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
    APPROVED: 'success',
    PENDING_APPROVAL: 'warning',
    REJECTED: 'danger',
    PAID: 'success',
    DRAFT: 'neutral',
  };
  return map[status] ?? 'neutral';
}

export function AgentExpensesPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [expenses, setExpenses] = useState<PublicExpense[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [category, setCategory] = useState('REPAIR');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [incurredAt, setIncurredAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDraft, setIsDraft] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listManagedProperties();
        if (cancelled) return;
        setProperties(rows);
        if (rows[0]) setPropertyId((prev) => prev || rows[0].id);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Impossible de charger vos biens.',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const load = useCallback(async () => {
    if (!propertyId) {
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setExpenses(await listExpenses(propertyId, statusFilter || undefined));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les dépenses.',
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId, statusFilter]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleCreate = useCallback(() => {
    if (!propertyId || !label.trim() || !(Number(amount) > 0)) {
      setError('Renseignez un libellé et un montant positif.');
      return;
    }
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await createExpense(propertyId, {
          category,
          label: label.trim(),
          amount: Number(amount),
          ...(incurredAt
            ? { incurredAt: new Date(incurredAt).toISOString() }
            : {}),
          ...(file ? { file } : {}),
          ...(isDraft ? { draft: true } : {}),
        });
        setLabel('');
        setAmount('');
        setFile(null);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible d’enregistrer la dépense.',
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [amount, category, file, incurredAt, isDraft, label, load, propertyId]);

  const handleSubmit = useCallback(
    (expenseId: string) => {
      void (async () => {
        setBusy(true);
        setError(null);
        try {
          await updateExpense(expenseId, { submit: true });
          await load();
        } catch (err) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Impossible de soumettre la dépense.',
          );
        } finally {
          setBusy(false);
        }
      })();
    },
    [load],
  );

  if (!ready) {
    return <p className="text-base text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Dépenses" />
      <ApiErrorBanner message={error} />

      <DetailCard title="Nouvelle dépense">
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-muted">
            Facture jointe optionnelle. Au-delà du seuil du mandat, la dépense
            passe par l’approbation du propriétaire.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="expense-property" className="text-sm font-medium text-heading">
                Bien
              </label>
              <select
                id="expense-property"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {properties.length === 0 ? (
                  <option value="">Aucun bien</option>
                ) : (
                  properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="expense-category" className="text-sm font-medium text-heading">
                Catégorie
              </label>
              <select
                id="expense-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {expenseCategoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="expense-label" className="text-sm font-medium text-heading">
                Libellé
              </label>
              <input
                id="expense-label"
                type="text"
                maxLength={200}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex. : réparation toiture"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="expense-amount" className="text-sm font-medium text-heading">
                Montant (XAF)
              </label>
              <input
                id="expense-amount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-36 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="expense-date" className="text-sm font-medium text-heading">
                Date
              </label>
              <input
                id="expense-date"
                type="date"
                value={incurredAt}
                onChange={(e) => setIncurredAt(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="expense-file" className="text-sm font-medium text-heading">
                Facture (PDF/JPG)
              </label>
              <input
                id="expense-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm text-muted"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              icon="mdi:send"
              variant="primary"
              loading={busy}
              onClick={handleCreate}
            >
              {isDraft ? 'Enregistrer le brouillon' : 'Créer la dépense'}
            </Button>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isDraft}
                onChange={(e) => setIsDraft(e.target.checked)}
              />
              Brouillon (non soumis)
            </label>
          </div>
        </div>
      </DetailCard>

      <DetailCard
        title="Dépenses du bien"
        actions={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrer par statut"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        }
      >
        {!propertyId ? (
          <p className="px-5 py-4 text-sm text-muted">
            Sélectionnez un bien pour voir ses dépenses.
          </p>
        ) : loading ? (
          <p className="px-5 py-4 text-sm text-muted">Chargement…</p>
        ) : expenses.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Aucune dépense.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Libellé</th>
                  <th className="px-4 py-2 font-medium">Catégorie</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                  <th className="px-4 py-2 text-right font-medium">Montant</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-border/60">
                    <td className="px-4 py-2 text-muted">
                      {formatDate(expense.incurredAt)}
                    </td>
                    <td className="px-4 py-2 text-foreground">{expense.label}</td>
                    <td className="px-4 py-2 text-muted">
                      {expenseCategoryLabel(expense.category)}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge
                        label={expenseStatusLabel(expense.status)}
                        tone={expenseTone(expense.status)}
                      />
                      {expense.status === 'PENDING_APPROVAL' ? (
                        <p className="mt-1 text-xs text-muted">
                          En attente d’approbation du propriétaire
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatAmount(expense.amount, expense.currency)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {expense.status === 'DRAFT' ||
                      expense.status === 'REJECTED' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSubmit(expense.id)}
                          className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                        >
                          Soumettre
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DetailCard>
    </section>
  );
}
