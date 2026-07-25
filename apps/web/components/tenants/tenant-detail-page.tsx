'use client';

import {
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboard';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  leaseStatusLabel,
  leaseStatusTone,
} from '@/lib/owner/leases';
import {
  paymentStatusLabel,
  paymentStatusTone,
  validatePayment,
} from '@/lib/owner/payments';
import {
  getManagedTenant,
  type ManagedTenantDetail,
} from '@/lib/owner/tenants';
import {
  getLatestSolvencyCheck,
  requestSolvencyCheck,
  type PublicSolvencyCheck,
} from '@/lib/owner/solvency';
import {
  deleteTenantDocument,
  listTenantDocuments,
  TENANT_DOCUMENT_TYPE_LABELS,
  uploadTenantDocument,
  type TenantDocumentItem,
  type TenantDocumentType,
} from '@/lib/owner/tenant-documents';
import { ManagedDocumentsSection } from '@/components/tenants/managed-documents-section';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function errorCode(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== 'object') {
    return null;
  }
  const code = (err.body as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export type TenantDetailPageProps = {
  tenantId: string;
  leaseHref: (id: string) => string;
  paymentHref?: (id: string) => string;
  backHref: string;
};

export function TenantDetailPage({
  tenantId,
  leaseHref,
  paymentHref,
  backHref,
}: TenantDetailPageProps): React.JSX.Element {
  const { ready } = useRequireSession();
  const [detail, setDetail] = useState<ManagedTenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [idDocs, setIdDocs] = useState<TenantDocumentItem[]>([]);
  const [docsBusy, setDocsBusy] = useState(false);
  const [solvency, setSolvency] = useState<PublicSolvencyCheck | null>(null);
  const [solvencyBusy, setSolvencyBusy] = useState(false);
  const [solvencyHint, setSolvencyHint] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    try {
      const rows = await listTenantDocuments(tenantId);
      setIdDocs(rows);
    } catch {
      setIdDocs([]);
    }
  }, [tenantId]);

  const loadSolvency = useCallback(async () => {
    try {
      const latest = await getLatestSolvencyCheck(tenantId);
      setSolvency(latest);
    } catch {
      setSolvency(null);
    }
  }, [tenantId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getManagedTenant(tenantId);
      setDetail(data);
      setError(null);
      await Promise.all([loadDocs(), loadSolvency()]);
    } catch (err) {
      setDetail(null);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le locataire.',
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId, loadDocs, loadSolvency]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleRequestSolvency = useCallback(async () => {
    setSolvencyBusy(true);
    setSolvencyHint(null);
    try {
      const created = await requestSolvencyCheck(tenantId);
      setSolvency(created);
    } catch (err) {
      if (errorCode(err) === 'NO_PAID_RENTS') {
        setSolvencyHint(
          'Aucun loyer payé sur la plateforme pour ce locataire.',
        );
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de demander la solvabilité.',
        );
      }
    } finally {
      setSolvencyBusy(false);
    }
  }, [tenantId]);

  const handleValidate = useCallback(
    async (paymentId: string, amount: string, currency: string) => {
      if (
        !confirm(
          `Valider le paiement de ${formatMoney(amount, currency)} ?`,
        )
      ) {
        return;
      }
      setValidatingId(paymentId);
      try {
        await validatePayment(paymentId);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de valider le paiement.',
        );
      } finally {
        setValidatingId(null);
      }
    },
    [load],
  );

  if (!ready || loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  if (error && !detail) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  }

  if (!detail) {
    return <p className="text-sm text-muted">Locataire introuvable.</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title={detail.name?.trim() || 'Locataire'}
        actions={
          <Link
            href={backHref}
            className="text-sm font-medium text-accent hover:underline"
          >
            ← Locataires
          </Link>
        }
      />

      {error ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-5">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Téléphone</dt>
            <dd className="font-mono text-sm">{detail.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Compte créé le</dt>
            <dd className="text-sm">{formatDate(detail.accountCreatedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Baux actifs</dt>
            <dd className="text-sm">{detail.activeLeaseCount}</dd>
          </div>
        </dl>
      </div>

      <ManagedDocumentsSection
        title="Pièces d'identité"
        emptyHint="Aucune pièce d'identité déposée."
        typeOptions={(
          Object.keys(TENANT_DOCUMENT_TYPE_LABELS) as TenantDocumentType[]
        ).map((value) => ({
          value,
          label: TENANT_DOCUMENT_TYPE_LABELS[value],
        }))}
        typeLabels={TENANT_DOCUMENT_TYPE_LABELS}
        items={idDocs}
        busy={docsBusy}
        onUpload={async (file, type) => {
          setDocsBusy(true);
          try {
            await uploadTenantDocument(
              tenantId,
              file,
              type as TenantDocumentType,
            );
            await loadDocs();
          } finally {
            setDocsBusy(false);
          }
        }}
        onDelete={async (id) => {
          setDocsBusy(true);
          try {
            await deleteTenantDocument(tenantId, id);
            await loadDocs();
          } finally {
            setDocsBusy(false);
          }
        }}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-heading">Solvabilité</h2>
          {!solvency ||
          solvency.status === 'DENIED' ||
          solvency.status === 'EXPIRED' ? (
            <Button
              type="button"
              variant="secondary"
              disabled={solvencyBusy}
              onClick={() => void handleRequestSolvency()}
            >
              Demander la solvabilité
            </Button>
          ) : null}
        </div>
        {solvencyHint ? (
          <p className="text-sm text-muted">{solvencyHint}</p>
        ) : null}
        {!solvency ? (
          <p className="text-sm text-muted">
            Demandez l’accès aux 3 derniers loyers payés (valable 7 jours après
            acceptation).
          </p>
        ) : null}
        {solvency?.status === 'PENDING' ? (
          <p className="text-sm text-muted">
            En attente de la réponse du locataire.
          </p>
        ) : null}
        {solvency?.status === 'DENIED' ? (
          <p className="text-sm text-muted">
            Le locataire a refusé la dernière demande.
          </p>
        ) : null}
        {solvency?.status === 'EXPIRED' ? (
          <p className="text-sm text-muted">
            L’accès précédent a expiré. Vous pouvez redemander.
          </p>
        ) : null}
        {solvency?.status === 'GRANTED' && solvency.snapshot ? (
          <div className="space-y-2">
            {solvency.expiresAt ? (
              <p className="text-sm text-muted">
                Expire le {formatDate(solvency.expiresAt)}
              </p>
            ) : null}
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {solvency.snapshot.map((row) => (
                <li
                  key={`${row.dueDate}-${row.paidAt}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      Échéance {formatDate(row.dueDate)}
                    </p>
                    <p className="text-muted">
                      Payé le {formatDate(row.paidAt)}
                      {row.daysLate > 0
                        ? ` · ${row.daysLate} j de retard`
                        : ' · à temps'}
                    </p>
                  </div>
                  <p className="font-medium">
                    {formatMoney(row.amount, row.currency)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-heading">Baux</h2>
        <ul className="space-y-2">
          {detail.leases.map((lease) => (
            <li
              key={lease.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div>
                <Link
                  href={leaseHref(lease.id)}
                  className="font-medium text-accent hover:underline"
                >
                  {lease.propertyTitle}
                </Link>
                <p className="text-sm text-muted">
                  {formatMoney(lease.monthlyRent, lease.currency)} / mois
                </p>
              </div>
              <StatusBadge
                label={leaseStatusLabel(lease.status)}
                tone={leaseStatusTone(lease.status)}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-heading">Échéances</h2>
        <ul className="space-y-2">
          {detail.leases
            .filter((l) => l.status === 'ACTIVE')
            .map((lease) => (
              <li
                key={`due-${lease.id}`}
                className="rounded-lg border border-border bg-card px-4 py-3 text-sm"
              >
                <p className="font-medium text-foreground">
                  {lease.propertyTitle}
                </p>
                <p className="mt-1 text-muted">
                  Prochaine :{' '}
                  {lease.nextDue
                    ? `${formatDate(lease.nextDue.dueDate)} · ${formatMoney(lease.nextDue.amount, lease.nextDue.currency)}`
                    : 'Aucune'}
                </p>
                {lease.overdueCount > 0 ? (
                  <p className="mt-1 text-danger">
                    {lease.overdueCount} échéance
                    {lease.overdueCount > 1 ? 's' : ''} en retard
                  </p>
                ) : null}
              </li>
            ))}
          {detail.leases.every((l) => l.status !== 'ACTIVE') ? (
            <li className="text-sm text-muted">Aucun bail actif.</li>
          ) : null}
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-heading">
          Paiements récents
        </h2>
        {detail.recentPayments.length === 0 ? (
          <p className="text-sm text-muted">Aucun paiement pour l’instant.</p>
        ) : (
          <ul className="space-y-2">
            {detail.recentPayments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div>
                  {paymentHref ? (
                    <Link
                      href={paymentHref(p.id)}
                      className="font-medium text-accent hover:underline"
                    >
                      {formatMoney(p.amount, p.currency)}
                    </Link>
                  ) : (
                    <span className="font-medium">
                      {formatMoney(p.amount, p.currency)}
                    </span>
                  )}
                  <p className="text-xs text-muted">
                    {p.method}
                    {p.provider ? ` · ${p.provider}` : ''} ·{' '}
                    {formatDate(p.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    label={paymentStatusLabel(p.status)}
                    tone={paymentStatusTone(p.status)}
                  />
                  {p.status === 'PENDING_VALIDATION' ? (
                    <Button
                      variant="primary"
                      loading={validatingId === p.id}
                      onClick={() =>
                        void handleValidate(p.id, p.amount, p.currency)
                      }
                    >
                      Valider
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
