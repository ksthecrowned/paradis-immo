'use client';

import { StatusBadge } from '@/components/dashboard';
import { DetailCard } from '@/components/detail';
import { ApiErrorBanner } from '@/components/forms';
import { Button } from '@/components/primitives';
import { ApiError } from '@/lib/api';
import {
  approvalStatusLabel,
  commissionSummary,
  getMandateDocumentUrl,
  mandateActionLabel,
  mandateScopeLabel,
  mandateStatusLabel,
  mandateStatusTone,
  signMandate,
  terminateMandate,
  type PublicMandateDetail,
} from '@/lib/owner/mandates';
import { Icon } from '@iconify/react';
import { useCallback, useState } from 'react';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function percent(value: string | null): string | null {
  if (!value) return null;
  return `${(Number(value) * 100).toLocaleString('fr-FR')} %`;
}

function money(value: string | null): string | null {
  if (!value) return null;
  return `${new Intl.NumberFormat('fr-FR').format(Number(value))} XAF`;
}

function termsSummary(terms: unknown): string {
  if (!terms || typeof terms !== 'object') return 'Conditions';
  const t = terms as Record<string, unknown>;
  const parts: string[] = [];
  if (Array.isArray(t.scopes)) {
    parts.push(t.scopes.map((s) => mandateScopeLabel(String(s))).join(' + '));
  }
  if (t.exclusive === true) parts.push('exclusif');
  const fee =
    percent(typeof t.managementFeeRate === 'string' ? t.managementFeeRate : null) ??
    (typeof t.managementFeeRate === 'number'
      ? `${(t.managementFeeRate * 100).toLocaleString('fr-FR')} %`
      : null);
  if (fee) parts.push(`gestion ${fee}`);
  const sale =
    percent(typeof t.saleCommissionRate === 'string' ? t.saleCommissionRate : null) ??
    (typeof t.saleCommissionRate === 'number'
      ? `${(t.saleCommissionRate * 100).toLocaleString('fr-FR')} %`
      : null);
  if (sale) parts.push(`vente ${sale}`);
  if (typeof t.endDate === 'string') {
    parts.push(`échéance ${formatDate(t.endDate)}`);
  }
  if (typeof t.noticeDays === 'number') {
    parts.push(`préavis ${t.noticeDays} j`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Conditions révisées';
}

type MandateDetailViewProps = {
  detail: PublicMandateDetail;
  onChanged: () => Promise<void> | void;
  /** Affiche le bloc de résiliation (owner ou gérant). */
  canTerminate?: boolean;
};

export function MandateDetailView({
  detail,
  onChanged,
  canTerminate = true,
}: MandateDetailViewProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [code, setCode] = useState('');
  const [terminateReason, setTerminateReason] = useState('');
  const [terminateImmediate, setTerminateImmediate] = useState(false);
  const [showTerminate, setShowTerminate] = useState(false);

  const bothSigned = Boolean(detail.ownerSignedAt && detail.agencySignedAt);
  const signable = !bothSigned && detail.status === 'ACTIVE';

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        await onChanged();
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'Une erreur est survenue.',
        );
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const handleRequestOtp = useCallback(() => {
    void run(async () => {
      await signMandate(detail.id);
      setOtpRequested(true);
    });
  }, [detail.id, run]);

  const handleSign = useCallback(() => {
    if (!/^\d{6}$/.test(code)) {
      setError('Le code reçu par SMS doit contenir 6 chiffres.');
      return;
    }
    void run(async () => {
      await signMandate(detail.id, code);
      setCode('');
      setOtpRequested(false);
    });
  }, [code, detail.id, run]);

  const handleDownload = useCallback(() => {
    void run(async () => {
      const { url } = await getMandateDocumentUrl(detail.id);
      window.open(url, '_blank', 'noopener');
    });
  }, [detail.id, run]);

  const handleTerminate = useCallback(() => {
    if (terminateReason.trim().length < 3) {
      setError('Indiquez un motif de résiliation (3 caractères minimum).');
      return;
    }
    const label = terminateImmediate
      ? 'résilier immédiatement ce mandat pour faute ?'
      : 'résilier ce mandat avec préavis ?';
    if (!confirm(`Confirmer : ${label}`)) return;
    void run(async () => {
      await terminateMandate(detail.id, {
        reason: terminateReason.trim(),
        immediate: terminateImmediate,
      });
      setTerminateReason('');
      setTerminateImmediate(false);
      setShowTerminate(false);
    });
  }, [detail.id, run, terminateImmediate, terminateReason]);

  const conditions: Array<{ label: string; value: string | null }> = [
    { label: 'Périmètre', value: detail.scopes.map(mandateScopeLabel).join(' + ') || null },
    { label: 'Commission', value: commissionSummary(detail) },
    { label: 'Seuil réparation (approbation)', value: money(detail.repairApprovalThreshold) },
    { label: 'Prix de vente minimum', value: money(detail.minSalePrice) },
    {
      label: 'Baisse de loyer',
      value: detail.rentChangeRequiresApproval ? 'Approbation requise' : 'Libre',
    },
    {
      label: 'Signature de bail',
      value: detail.leaseSignRequiresApproval ? 'Approbation requise' : 'Libre',
    },
    { label: 'Délai d’approbation', value: `${detail.approvalTtlDays} jours` },
    { label: 'Préavis de résiliation', value: `${detail.noticeDays} jours` },
    {
      label: 'Renouvellement tacite',
      value: detail.tacitRenewal ? 'Oui' : 'Non',
    },
    {
      label: 'Échéance',
      value: detail.endDate ? formatDate(detail.endDate) : 'Durée indéterminée',
    },
  ];

  return (
    <div className="space-y-6">
      <ApiErrorBanner message={error} />

      <DetailCard
        title="Conditions"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={mandateStatusLabel(detail.status)}
              tone={mandateStatusTone(detail.status)}
            />
            {detail.exclusive ? (
              <StatusBadge label="Exclusif" tone="accent" />
            ) : null}
          </div>
        }
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
          {conditions.map((row) => (
            <div key={row.label}>
              <dt className="text-xs uppercase tracking-wide text-muted">
                {row.label}
              </dt>
              <dd className="text-sm text-foreground">{row.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-border px-5 py-3 text-sm text-muted">
          Proposé le {formatDate(detail.createdAt)}
          {detail.acceptedAt ? ` · accepté le ${formatDate(detail.acceptedAt)}` : ''}
          {detail.terminationRequestedAt
            ? ` · résiliation demandée le ${formatDate(detail.terminationRequestedAt)}`
            : ''}
          {detail.terminationEffectiveAt
            ? ` · effective le ${formatDate(detail.terminationEffectiveAt)}`
            : ''}
          {detail.terminationReason ? ` · motif : ${detail.terminationReason}` : ''}
        </p>
      </DetailCard>

      <DetailCard title="Signature électronique">
        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Icon
                icon={detail.ownerSignedAt ? 'mdi:check-circle' : 'mdi:circle-outline'}
                className={`h-4 w-4 ${detail.ownerSignedAt ? 'text-success' : 'text-muted'}`}
              />
              Propriétaire
              {detail.ownerSignedAt ? ` — ${formatDate(detail.ownerSignedAt)}` : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon
                icon={detail.agencySignedAt ? 'mdi:check-circle' : 'mdi:circle-outline'}
                className={`h-4 w-4 ${detail.agencySignedAt ? 'text-success' : 'text-muted'}`}
              />
              Agence
              {detail.agencySignedAt ? ` — ${formatDate(detail.agencySignedAt)}` : ''}
            </span>
          </div>

          {bothSigned ? (
            <Button
              icon="mdi:file-pdf-box"
              variant="primary"
              loading={busy}
              onClick={handleDownload}
            >
              Télécharger le mandat signé (PDF)
            </Button>
          ) : signable ? (
            <div className="flex flex-wrap items-end gap-3">
              {!otpRequested ? (
                <Button
                  icon="mdi:cellphone-text"
                  variant="primary"
                  loading={busy}
                  onClick={handleRequestOtp}
                >
                  Recevoir le code de signature
                </Button>
              ) : (
                <>
                  <div className="space-y-1">
                    <label
                      htmlFor="sign-code"
                      className="text-sm font-medium text-heading"
                    >
                      Code reçu par SMS
                    </label>
                    <input
                      id="sign-code"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      className="w-36 rounded-lg border border-border bg-background px-3 py-2 text-sm tracking-widest"
                      placeholder="000000"
                    />
                  </div>
                  <Button
                    icon="mdi:file-sign"
                    variant="primary"
                    loading={busy}
                    onClick={handleSign}
                  >
                    Signer
                  </Button>
                </>
              )}
              <p className="w-full text-sm text-muted">
                Les deux parties doivent signer pour générer le PDF définitif.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Ce mandat n’est pas encore accepté : la signature sera possible
              une fois les conditions actives.
            </p>
          )}
        </div>
      </DetailCard>

      <DetailCard title={`Historique des versions (${detail.versions.length})`}>
        {detail.versions.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Aucune version enregistrée.</p>
        ) : (
          <ul className="divide-y divide-border">
            {detail.versions.map((version, index) => (
              <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {termsSummary(version.terms)}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(version.createdAt)}
                  </p>
                </div>
                <StatusBadge
                  label={
                    index === 0
                      ? 'Version courante'
                      : `Version ${detail.versions.length - index}`
                  }
                  tone={index === 0 ? 'accent' : 'neutral'}
                />
              </li>
            ))}
          </ul>
        )}
      </DetailCard>

      <DetailCard title={`Approbations (${detail.approvals.length})`}>
        {detail.approvals.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">
            Aucune action soumise au propriétaire.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {detail.approvals.map((approval) => (
              <li key={approval.id} className="space-y-1 px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-foreground">
                    {mandateActionLabel(approval.actionType)}
                  </p>
                  <StatusBadge
                    label={approvalStatusLabel(approval.status)}
                    tone={
                      approval.status === 'PENDING'
                        ? 'warning'
                        : approval.status === 'APPROVED'
                          ? 'success'
                          : 'neutral'
                    }
                  />
                </div>
                {approval.comment ? (
                  <p className="text-sm text-muted">« {approval.comment} »</p>
                ) : null}
                <p className="text-xs text-muted">
                  Demandé le {formatDate(approval.createdAt)}
                  {approval.decidedAt ? ` · décidé le ${formatDate(approval.decidedAt)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DetailCard>

      {canTerminate && (detail.status === 'ACTIVE' || detail.status === 'TERMINATING') ? (
        detail.status === 'TERMINATING' ? (
          <DetailCard title="Résiliation en cours">
            <p className="px-5 py-4 text-sm text-muted">
              Ce mandat est en préavis
              {detail.terminationEffectiveAt
                ? ` jusqu’au ${formatDate(detail.terminationEffectiveAt)}`
                : ''}
              {detail.terminationReason ? ` — ${detail.terminationReason}` : ''}.
            </p>
          </DetailCard>
        ) : (
          <DetailCard title="Résilier ce mandat">
            <div className="space-y-3 px-5 py-4">
              {!showTerminate ? (
                <Button
                  icon="mdi:door-open"
                  variant="secondary"
                  onClick={() => setShowTerminate(true)}
                >
                  Demander la résiliation
                </Button>
              ) : (
                <>
                  <div className="space-y-1">
                    <label
                      htmlFor="terminate-reason"
                      className="text-sm font-medium text-heading"
                    >
                      Motif
                    </label>
                    <textarea
                      id="terminate-reason"
                      rows={2}
                      maxLength={500}
                      value={terminateReason}
                      onChange={(e) => setTerminateReason(e.target.value)}
                      placeholder="Ex. : cooperation insuffisante, faute grave…"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={terminateImmediate}
                      onChange={(e) => setTerminateImmediate(e.target.checked)}
                    />
                    Résiliation immédiate (faute) — sinon préavis de{' '}
                    {detail.noticeDays} jours
                  </label>
                  <div className="flex gap-2">
                    <Button
                      icon="mdi:alert"
                      variant="primary"
                      loading={busy}
                      onClick={handleTerminate}
                    >
                      Confirmer la résiliation
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setShowTerminate(false)}
                    >
                      Annuler
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DetailCard>
        )
      ) : null}
    </div>
  );
}
