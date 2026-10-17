'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboard';
import { ApiErrorBanner, FormField, Input } from '@/components/forms';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import {
  decideMandateReview,
  listMandateReviews,
  type MandateReviewRow,
} from '@/lib/admin/mandate-reviews';
import { ApiError } from '@/lib/api';

type Decision = 'APPROVED' | 'NEEDS_CORRECTION' | 'REJECTED';

export function AdminMandateReviewsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<MandateReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMandateReviews(1, 50);
      setRows(res.data);
      setTotal(res.meta.total);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger la file de revue.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  const decide = async (mandateId: string, decision: Decision) => {
    const reason = (reasonById[mandateId] ?? '').trim();
    if (reason.length < 3) {
      setError('Un motif d’au moins 3 caractères est requis.');
      return;
    }
    setBusyId(mandateId);
    try {
      await decideMandateReview(mandateId, decision, reason);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Décision impossible.',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Revue des mandats papier"
        description="Contrôle documentaire uniquement — ne certifie pas la signature ni la propriété juridique."
      />

      {error ? <ApiErrorBanner message={error} /> : null}

      {loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">Aucun mandat en attente de revue.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li
              key={row.id}
              className="space-y-3 rounded-lg border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-heading">{row.property.title}</p>
                <StatusBadge
                  label={row.documentReviewStatus}
                  tone={
                    row.documentReviewStatus === 'NEEDS_CORRECTION'
                      ? 'warning'
                      : 'accent'
                  }
                />
              </div>
              <p className="text-sm text-muted">
                Agence : {row.organization.name} · version{' '}
                {row.documentVersion} · bien {row.property.status}
              </p>
              <FormField name={`reason-${row.id}`} label="Motif de décision" required>
                <Input
                  id={`reason-${row.id}`}
                  value={reasonById[row.id] ?? ''}
                  onChange={(e) =>
                    setReasonById((prev) => ({
                      ...prev,
                      [row.id]: e.target.value,
                    }))
                  }
                  placeholder="Ex. pages manquantes, signature illisible…"
                />
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void decide(row.id, 'APPROVED')}
                >
                  Approuver (documentaire)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busyId === row.id}
                  onClick={() => void decide(row.id, 'NEEDS_CORRECTION')}
                >
                  À corriger
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busyId === row.id}
                  onClick={() => void decide(row.id, 'REJECTED')}
                >
                  Rejeter
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && total > 0 ? (
        <p className="text-xs text-muted">{total} dossier(s)</p>
      ) : null}
    </div>
  );
}
