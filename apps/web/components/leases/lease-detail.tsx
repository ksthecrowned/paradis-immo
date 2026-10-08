'use client';

import {
    DashboardPageHeader,
    StatusBadge,
} from '@/components/dashboard';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
    activateLease,
    cancelLease,
    closeLease,
    getLease,
    getLeaseSchedule,
    leaseStatusLabel,
    leaseStatusTone,
    listCoTenants,
    rentScheduleStatusLabel,
    renewLease,
    scheduleBalance,
    sendLeaseForSignature,
    signLease,
    terminateLease,
    withdrawTermination,
    type PublicCoTenant,
    type PublicLease,
    type PublicRentScheduleEntry,
} from '@/lib/owner/leases';
import {
  deleteLeaseDocument,
  LEASE_DOCUMENT_DISPLAY_LABELS,
  LEASE_DOCUMENT_TYPE_LABELS,
  listLeaseDocuments,
  uploadLeaseDocument,
  type LeaseDocumentItem,
  type LeaseDocumentType,
} from '@/lib/owner/lease-documents';
import {
  deductionStatusLabel,
  deductionStatusTone,
  getLeaseDeposit,
  proposeDeduction,
  settleDeposit,
  type PublicDepositSummary,
} from '@/lib/owner/deposits';
import {
  getLeaseBalance,
  sendLeaseReminder,
  type LeaseBalance,
} from '@/lib/owner/arrears';
import {
  FORMAL_NOTICE_DAYS,
  sendFormalNotice,
  waiveLateFee,
} from '@/lib/owner/enforcement';
import {
  amendmentChangesLabel,
  createAmendment,
  listAmendments,
  signAmendment,
  type PublicAmendment,
} from '@/lib/owner/amendments';
import {
  indexationStatusLabel,
  indexationStatusTone,
  listIndexations,
  type IndexationRecord,
} from '@/lib/owner/indexation';
import { ManagedDocumentsSection } from '@/components/tenants/managed-documents-section';
import { decideApproval } from '@/lib/owner/mandates';
import { RecordCashPaymentButton } from '@/components/payments/record-cash-payment-button';
import { ROUTES } from '@/lib/routes';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const RECORDABLE_SCHEDULE_STATUSES = new Set([
  'PENDING',
  'OVERDUE',
  'PARTIAL',
]);

/** Spec 04 — the schedule mixes rents, the deposit and late fees. */
function scheduleKindLabel(kind: string): string {
  if (kind === 'DEPOSIT') return 'Caution';
  if (kind === 'LATE_FEE') return 'Pénalité';
  if (kind === 'CHARGES_ADJUSTMENT') return 'Régularisation';
  return 'Loyer';
}


export interface LeaseDetailProps {
  leaseId: string;
  role?: 'owner' | 'agent';
}

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

export function LeaseDetail({
  leaseId,
  role = 'owner',
}: LeaseDetailProps): React.JSX.Element {
  const paths =
    role === 'agent'
      ? {
          dashboard: ROUTES.agent.dashboard,
          list: ROUTES.agent.leases,
          edit: ROUTES.agent.leaseEdit,
          property: ROUTES.agent.property,
        }
      : {
          dashboard: ROUTES.owner.dashboard,
          list: ROUTES.owner.leases,
          edit: ROUTES.owner.leaseEdit,
          property: ROUTES.owner.property,
        };
  const { ready } = useRequireSession();
  const [lease, setLease] = useState<PublicLease | null>(null);
  const [schedule, setSchedule] = useState<PublicRentScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [leaseDocs, setLeaseDocs] = useState<LeaseDocumentItem[]>([]);
  const [docsBusy, setDocsBusy] = useState(false);
  /** Spec 04 — OTP signature: a code was requested, waiting for the 6 digits. */
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [deposit, setDeposit] = useState<PublicDepositSummary | null>(null);
  const [balance, setBalance] = useState<LeaseBalance | null>(null);
  const [amendments, setAmendments] = useState<PublicAmendment[]>([]);
  /** Version of the amendment waiting for its 6-digit code. */
  const [amendmentOtp, setAmendmentOtp] = useState<number | null>(null);
  const [amendmentCode, setAmendmentCode] = useState('');
  /** Spec 04 US 8 — propositions de révision annuelle du loyer. */
  const [indexations, setIndexations] = useState<IndexationRecord[]>([]);
  /** Spec 04 US 7 — colocataires du bail. */
  const [coTenants, setCoTenants] = useState<PublicCoTenant[]>([]);
  const [coTenantPhone, setCoTenantPhone] = useState('');
  /** Spec 04 US 11 — formulaire de renouvellement (nouveau terme). */
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewRent, setRenewRent] = useState('');

  const loadDocs = useCallback(async () => {
    try {
      const rows = await listLeaseDocuments(leaseId);
      setLeaseDocs(rows);
    } catch {
      setLeaseDocs([]);
    }
  }, [leaseId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLease(leaseId);
      setLease(data);
      if (
        data.status === 'ACTIVE' ||
        data.status === 'TERMINATING' ||
        data.status === 'TERMINATED'
      ) {
        const rows = await getLeaseSchedule(leaseId);
        setSchedule(rows);
      } else {
        setSchedule([]);
      }
      setError(null);
      await loadDocs();
      try {
        setDeposit(await getLeaseDeposit(leaseId));
      } catch {
        setDeposit(null);
      }
      try {
        setBalance(await getLeaseBalance(leaseId));
      } catch {
        setBalance(null);
      }
      try {
        setAmendments(await listAmendments(leaseId));
      } catch {
        setAmendments([]);
      }
      try {
        setIndexations(await listIndexations(leaseId));
      } catch {
        setIndexations([]);
      }
      try {
        setCoTenants(await listCoTenants(leaseId));
      } catch {
        setCoTenants([]);
      }
      setRenewEndDate((current) =>
        current ||
        new Date(new Date(data.endDate).getTime() + 365 * 86_400_000)
          .toISOString()
          .slice(0, 10),
      );
    } catch (err) {
      setLease(null);
      setSchedule([]);
      setDeposit(null);
      setBalance(null);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le bail.',
      );
    } finally {
      setLoading(false);
    }
  }, [leaseId, loadDocs]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  useEffect(() => {
    setOtpRequested(false);
    setOtpCode('');
  }, [leaseId]);

  const runAction = useCallback(
    async (name: string, fn: () => Promise<unknown>) => {
      setAction(name);
      setError(null);
      try {
        await fn();
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Action impossible.');
      } finally {
        setAction(null);
      }
    },
    [load],
  );

  const handleActivate = useCallback(() => {
    if (
      !confirm(
        'Activer ce bail ? Le bien passe en occupé et l’échéancier de loyers est généré.',
      )
    ) {
      return;
    }
    void runAction('activate', () => activateLease(leaseId));
  }, [leaseId, runAction]);

  const handleSendForSignature = useCallback(() => {
    void runAction('signature', () => sendLeaseForSignature(leaseId));
  }, [leaseId, runAction]);

  const handleRequestOtp = useCallback(() => {
    void runAction('otp', async () => {
      await signLease(leaseId);
      setOtpRequested(true);
    });
  }, [leaseId, runAction]);

  const handleSign = useCallback(() => {
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError('Saisissez le code à 6 chiffres reçu par WhatsApp.');
      return;
    }
    void runAction('sign', async () => {
      await signLease(leaseId, code);
      setOtpCode('');
      setOtpRequested(false);
    });
  }, [leaseId, otpCode, runAction]);

  const handleCancel = useCallback(() => {
    if (!confirm('Annuler ce bail ?')) return;
    void runAction('cancel', () => cancelLease(leaseId));
  }, [leaseId, runAction]);

  const handleTerminate = useCallback(() => {
    const requestedEndDate = prompt(
      'Date de sortie souhaitée (AAAA-MM-JJ) ?',
      new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    );
    if (!requestedEndDate) return;
    void runAction('terminate', () =>
      terminateLease(leaseId, {
        initiator: role === 'agent' ? 'LANDLORD' : 'LANDLORD',
        requestedEndDate,
      }),
    );
  }, [leaseId, role, runAction]);

  const handleWithdrawTermination = useCallback(() => {
    if (!confirm('Retirer le congé déposé ?')) return;
    void runAction('withdraw', () => withdrawTermination(leaseId));
  }, [leaseId, runAction]);

  const handleClose = useCallback(() => {
    if (!confirm('Clôturer ce bail ? Le bien redevient disponible.')) return;
    void runAction('close', () => closeLease(leaseId));
  }, [leaseId, runAction]);

  const handleProposeDeduction = useCallback(() => {
    const label = prompt('Motif de la retenue ?', 'Dégâts constatés à la sortie');
    if (!label) return;
    const raw = prompt('Montant de la retenue (XAF) ?', '25000');
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Montant de retenue invalide.');
      return;
    }
    void runAction('deduction', () => proposeDeduction(leaseId, { label, amount }));
  }, [leaseId, runAction]);

  const handleSettleDeposit = useCallback(() => {
    if (
      !confirm(
        'Régler la caution ? Le reversement est créé pour validation et la sortie est inscrite au grand livre.',
      )
    ) {
      return;
    }
    void runAction('settle', () => settleDeposit(leaseId));
  }, [leaseId, runAction]);

  const handleReminder = useCallback(() => {
    const message = prompt(
      'Message de relance (vide = message standard) ?',
      '',
    );
    if (message === null) return;
    void runAction('reminder', () =>
      sendLeaseReminder(leaseId, message ? { message } : {}),
    );
  }, [leaseId, runAction]);

  const handleFormalNotice = useCallback(() => {
    if (
      !confirm(
        'Émettre une mise en demeure ? Un PDF est généré et le locataire est prévenu.',
      )
    ) {
      return;
    }
    void runAction('formal-notice', () => sendFormalNotice(leaseId));
  }, [leaseId, runAction]);

  const loadAmendments = useCallback(async () => {
    try {
      setAmendments(await listAmendments(leaseId));
    } catch {
      setAmendments([]);
    }
  }, [leaseId]);

  const handleCreateAmendment = useCallback(() => {
    const rawRent = prompt('Nouveau loyer mensuel (XAF) — vide pour inchangé', '');
    if (rawRent === null) return;
    const changes: Parameters<typeof createAmendment>[1]['changes'] = {};
    if (rawRent.trim() !== '') {
      const rent = Number(rawRent);
      if (!Number.isFinite(rent) || rent < 0) {
        setError('Loyer invalide.');
        return;
      }
      changes.monthlyRent = rent;
    }
    const rawCharges = prompt('Nouveau forfait de charges (XAF) — vide pour inchangé', '');
    if (rawCharges === null) return;
    if (rawCharges.trim() !== '') {
      const charges = Number(rawCharges);
      if (!Number.isFinite(charges) || charges < 0) {
        setError('Charges invalides.');
        return;
      }
      changes.chargesAmount = charges;
    }
    const reason = prompt('Motif de l’avenant ?', 'Avenant commercial');
    if (reason === null) return;
    if (Object.keys(changes).length === 0) {
      setError('Un avenant doit modifier au moins un terme.');
      return;
    }
    void runAction('amendment', async () => {
      await createAmendment(leaseId, { changes, reason: reason || undefined });
      await loadAmendments();
    });
  }, [leaseId, loadAmendments, runAction]);

  /** Spec 04 US 7 — propose un avenant qui fait entrer un colocataire. */
  const handleAddCoTenant = useCallback(() => {
    const phone = coTenantPhone.trim();
    if (!/^\+?\d{6,15}$/.test(phone)) {
      setError('Numéro de téléphone invalide (ex. +242061234567).');
      return;
    }
    void runAction('co-tenant-add', async () => {
      await createAmendment(leaseId, {
        changes: { coTenants: { add: [phone] } },
        reason: 'Colocation — ajout',
      });
      setCoTenantPhone('');
      await loadAmendments();
    });
  }, [coTenantPhone, leaseId, loadAmendments, runAction]);

  /** Spec 04 US 7 — propose un avenant qui fait sortir un colocataire. */
  const handleRemoveCoTenant = useCallback(
    (coTenant: PublicCoTenant) => {
      const label = coTenant.name ?? coTenant.phone ?? 'ce colocataire';
      if (!confirm(`Retirer ${label} du bail (avenant à signer) ?`)) return;
      void runAction('co-tenant-remove', async () => {
        await createAmendment(leaseId, {
          changes: { coTenants: { remove: [coTenant.userId] } },
          reason: 'Colocation — départ',
        });
        await loadAmendments();
      });
    },
    [leaseId, loadAmendments, runAction],
  );

  /** Spec 04 US 11 — renouvellement : nouveau terme (+ loyer du terme). */
  const handleRenew = useCallback(() => {
    if (!renewEndDate) {
      setError('Indiquez la nouvelle date de fin du bail.');
      return;
    }
    const rent = renewRent.trim() === '' ? undefined : Number(renewRent);
    if (rent !== undefined && (!Number.isFinite(rent) || rent < 0)) {
      setError('Loyer du nouveau terme invalide.');
      return;
    }
    if (!confirm(`Renouveler ce bail jusqu’au ${formatDate(renewEndDate)} ?`)) {
      return;
    }
    void runAction('renew', async () => {
      const result = await renewLease(leaseId, {
        newEndDate: renewEndDate,
        ...(rent !== undefined ? { newMonthlyRent: rent } : {}),
      });
      if (result.applied) {
        setRenewRent('');
      } else {
        setError(
          'Renouvellement soumis : en attente de l’approbation du propriétaire.',
        );
      }
    });
  }, [leaseId, renewEndDate, renewRent, runAction]);

  const handleAmendmentOtp = useCallback(
    (version: number, submit: boolean) => {
      if (!submit) {
        void runAction(`amendment-otp-${version}`, async () => {
          await signAmendment(leaseId, version);
          setAmendmentOtp(version);
        });
        return;
      }
      const code = amendmentCode.trim();
      if (!/^\d{6}$/.test(code)) {
        setError('Saisissez le code à 6 chiffres reçu par WhatsApp.');
        return;
      }
      void runAction(`amendment-sign-${version}`, async () => {
        await signAmendment(leaseId, version, code);
        setAmendmentOtp(null);
        setAmendmentCode('');
        await loadAmendments();
      });
    },
    [amendmentCode, leaseId, loadAmendments, runAction],
  );

  /** Spec 04 US 8 — the owner validates (or refuses) the indexed rent. */
  const handleIndexationDecision = useCallback(
    (record: IndexationRecord, decision: 'APPROVE' | 'REJECT') => {
      const label =
        decision === 'APPROVE' ? 'Approuver' : 'Refuser la révision';
      if (!confirm(`${label} le loyer révisé au ${formatDate(record.effectiveFrom ?? record.createdAt)} ?`)) {
        return;
      }
      void runAction(`indexation-${decision.toLowerCase()}-${record.id}`, () =>
        decideApproval(record.id, decision),
      );
    },
    [runAction],
  );

  if (!ready || loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  if (!lease) {
    return (
      <section className="space-y-4">
        <DashboardPageHeader title="Détail du bail" />
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error ?? 'Bail introuvable.'}
        </div>
        <Link
          href={paths.list}
          className="inline-block text-sm text-accent hover:underline"
        >
          ← Retour aux baux
        </Link>
      </section>
    );
  }

  const shortId = `${lease.id.slice(0, 8)}…`;
  const maxDaysOverdue = balance
    ? Math.max(
        0,
        ...balance.lines
          .filter((line) => line.kind !== 'DEPOSIT')
          .map((line) => line.daysOverdue),
      )
    : 0;

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title={`Bail ${shortId}`}
        breadcrumb={[
          { label: 'Paradis Immo', href: paths.dashboard },
          { label: 'Baux', href: paths.list },
          { label: shortId },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={leaseStatusLabel(lease.status)}
              tone={leaseStatusTone(lease.status)}
            />
            {lease.status === 'DRAFT' ? (
              <>
                <Link
                  href={paths.edit(lease.id)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover"
                >
                  Modifier
                </Link>
                <button
                  type="button"
                  disabled={action !== null}
                  onClick={handleSendForSignature}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                >
                  {action === 'signature' ? 'Envoi…' : 'Envoyer pour signature'}
                </button>
                <button
                  type="button"
                  disabled={action !== null}
                  onClick={handleCancel}
                  className="rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                  Annuler
                </button>
              </>
            ) : null}
            {lease.status === 'DRAFT' || lease.status === 'PENDING_SIGNATURE' ? (
              <button
                type="button"
                disabled={action !== null}
                onClick={handleActivate}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
              >
                {action === 'activate' ? 'Activation…' : 'Activer'}
              </button>
            ) : null}
            {lease.status === 'ACTIVE' ? (
              <button
                type="button"
                disabled={action !== null}
                onClick={handleTerminate}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
              >
                {action === 'terminate' ? 'Envoi…' : 'Déposer un congé'}
              </button>
            ) : null}
            {lease.status === 'TERMINATING' ? (
              <>
                <button
                  type="button"
                  disabled={action !== null}
                  onClick={handleWithdrawTermination}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                >
                  {action === 'withdraw' ? 'Retrait…' : 'Retirer le congé'}
                </button>
                <button
                  type="button"
                  disabled={action !== null}
                  onClick={handleClose}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
                >
                  {action === 'close' ? 'Clôture…' : 'Clôturer le bail'}
                </button>
              </>
            ) : null}
            <Link
              href={paths.list}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover"
            >
              Liste
            </Link>
          </div>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Bien
          </p>
          <Link
            href={paths.property(lease.propertyId)}
            className="mt-1 inline-block font-mono text-sm text-accent hover:underline"
          >
            {lease.propertyId}
          </Link>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Locataire
          </p>
          <p className="mt-1 text-sm text-foreground">
            {lease.tenantName ?? 'Sans nom'}
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            {lease.tenantPhone ?? lease.invitedPhone ?? lease.tenantId ?? '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Période
          </p>
          <p className="mt-1 text-sm text-foreground">
            {formatDate(lease.startDate)} → {formatDate(lease.endDate)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Loyer / caution
          </p>
          <p className="mt-1 text-sm text-foreground">
            {formatMoney(lease.monthlyRent, lease.currency)} / mois · caution{' '}
            {formatMoney(lease.deposit, lease.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Échéance
          </p>
          <p className="mt-1 text-sm text-foreground">
            Le {lease.dueDay}
            {Number(lease.chargesAmount) > 0
              ? ` · charges ${formatMoney(lease.chargesAmount, lease.currency)} (${
                  lease.chargesMode === 'PROVISION' ? 'provision' : 'forfait'
                })`
              : ' · aucune charge'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Préavis / révision
          </p>
          <p className="mt-1 text-sm text-foreground">
            {lease.noticeMonthsTenant} mois (locataire) ·{' '}
            {lease.noticeMonthsLandlord} mois (bailleur)
            {lease.indexationRate
              ? ` · révision ${(Number(lease.indexationRate) * 100).toFixed(1)} %`
              : ''}
          </p>
        </div>
        {lease.invitedPhone && !lease.tenantId ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Invitation
            </p>
            <p className="mt-1 text-sm text-foreground">
              {lease.invitedPhone} — compte en attente de création
            </p>
          </div>
        ) : null}
        {lease.status === 'TERMINATING' ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Congé
            </p>
            <p className="mt-1 text-sm text-foreground">
              Déposé par {lease.terminationInitiator ?? '—'}
              {lease.terminationNoticeAt
                ? ` le ${formatDate(lease.terminationNoticeAt)}`
                : ''}
              {lease.terminationEffectiveAt
                ? ` · sortie le ${formatDate(lease.terminationEffectiveAt)}`
                : ''}
            </p>
            {lease.terminationReason ? (
              <p className="mt-0.5 text-xs text-muted">{lease.terminationReason}</p>
            ) : null}
          </div>
        ) : null}
        {lease.terminatedAt ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Clôture
            </p>
            <p className="mt-1 text-sm text-foreground">
              Bail clos le {formatDate(lease.terminatedAt)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-heading">Signature</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="text-muted">
            Locataire :{' '}
            <span className="text-foreground">
              {lease.tenantSignedAt
                ? `signé le ${formatDate(lease.tenantSignedAt)}`
                : 'en attente'}
            </span>
          </p>
          <p className="text-muted">
            Bailleur :{' '}
            <span className="text-foreground">
              {lease.landlordSignedAt
                ? `signé le ${formatDate(lease.landlordSignedAt)}`
                : 'en attente'}
            </span>
          </p>
        </div>
        {lease.status === 'PENDING_SIGNATURE' ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              La signature se fait par code à 6 chiffres envoyé sur WhatsApp. Le
              bail devient actif dès que les deux parties ont signé.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {!otpRequested ? (
                <button
                  type="button"
                  disabled={action !== null}
                  onClick={handleRequestOtp}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                >
                  {action === 'otp' ? 'Envoi…' : 'Recevoir le code'}
                </button>
              ) : (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value)}
                    placeholder="000000"
                    className="w-32 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
                  />
                  <button
                    type="button"
                    disabled={action !== null}
                    onClick={handleSign}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
                  >
                    {action === 'sign' ? 'Signature…' : 'Signer le bail'}
                  </button>
                  <button
                    type="button"
                    disabled={action !== null}
                    onClick={handleRequestOtp}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                  >
                    Renvoyer le code
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {balance ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-heading">Solde</h2>
            {balance.overdueCount > 0 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={action !== null}
                  onClick={handleReminder}
                  className="rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                  {action === 'reminder' ? 'Envoi…' : 'Relancer'}
                </button>
                {maxDaysOverdue >= FORMAL_NOTICE_DAYS ? (
                  <button
                    type="button"
                    disabled={action !== null}
                    onClick={handleFormalNotice}
                    className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90 disabled:opacity-50"
                  >
                    {action === 'formal-notice' ? 'Génération…' : 'Mise en demeure'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p className="text-muted">
              Dû au total :{' '}
              <span className="text-foreground">
                {formatMoney(balance.totalDue, balance.currency)}
              </span>
            </p>
            <p className="text-muted">
              Réglé :{' '}
              <span className="text-foreground">
                {formatMoney(balance.totalPaid, balance.currency)}
              </span>
            </p>
            <p className="text-muted">
              Solde :{' '}
              <span className="text-foreground">
                {formatMoney(balance.balance, balance.currency)}
              </span>
            </p>
            <p className="text-muted">
              En retard :{' '}
              <span className="text-danger">
                {formatMoney(balance.overdueAmount, balance.currency)}
              </span>{' '}
              ({balance.overdueCount} échéance(s))
            </p>
            {balance.nextDueDate ? (
              <p className="text-muted">
                Prochaine échéance :{' '}
                <span className="text-foreground">
                  {formatDate(balance.nextDueDate)} ·{' '}
                  {formatMoney(
                    balance.nextDueAmount ?? '0',
                    balance.currency,
                  )}
                </span>
              </p>
            ) : null}
            {maxDaysOverdue > 0 ? (
              <p className="text-muted">
                Impayé le plus ancien :{' '}
                <span className="text-foreground">{maxDaysOverdue} j</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {deposit ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-heading">Caution</h2>
            <div className="flex flex-wrap gap-2">
              {deposit.leaseStatus === 'TERMINATING' ||
              deposit.leaseStatus === 'TERMINATED' ? (
                <>
                  <button
                    type="button"
                    disabled={action !== null || Boolean(deposit.settlement)}
                    onClick={handleProposeDeduction}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                  >
                    {action === 'deduction' ? 'Envoi…' : 'Proposer une retenue'}
                  </button>
                  <button
                    type="button"
                    disabled={action !== null || Boolean(deposit.settlement)}
                    onClick={handleSettleDeposit}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
                  >
                    {action === 'settle' ? 'Règlement…' : 'Régler la caution'}
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p className="text-muted">
              Caution contractuelle :{' '}
              <span className="text-foreground">
                {formatMoney(deposit.depositAmount, deposit.currency)}
              </span>
            </p>
            <p className="text-muted">
              Encaissée :{' '}
              <span className="text-foreground">
                {formatMoney(deposit.heldAmount, deposit.currency)}
              </span>
              {deposit.schedule
                ? ` (échéance du ${formatDate(deposit.schedule.dueDate)} — ${deposit.schedule.status})`
                : ''}
            </p>
            <p className="text-muted">
              Retenus acceptées :{' '}
              <span className="text-foreground">
                {formatMoney(deposit.deductedTotal, deposit.currency)}
              </span>
            </p>
            <p className="text-muted">
              En attente d’arbitrage :{' '}
              <span className="text-foreground">
                {formatMoney(deposit.openTotal, deposit.currency)}
              </span>
            </p>
          </div>
          {deposit.refundDeadline ? (
            <p className="text-xs text-muted">
              Restitution à effectuer avant le {formatDate(deposit.refundDeadline)}{' '}
              (30 jours après la sortie).
            </p>
          ) : null}
          {deposit.deductions.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-md text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-card text-muted">
                    <th className="px-3 py-2 font-medium">Motif</th>
                    <th className="px-3 py-2 font-medium">Montant</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                    <th className="px-3 py-2 font-medium">Contestation</th>
                  </tr>
                </thead>
                <tbody>
                  {deposit.deductions.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="px-3 py-2">{row.label}</td>
                      <td className="px-3 py-2">
                        {formatMoney(row.amount, deposit.currency)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          label={deductionStatusLabel(row.status)}
                          tone={deductionStatusTone(row.status)}
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted">
                        {row.tenantComment ?? '—'}
                        {row.contestable
                          ? ` · contestable jusqu’au ${formatDate(row.contestableUntil)}`
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {deposit.settlement ? (
            <p className="text-sm text-foreground">
              Restitution :{' '}
              {formatMoney(
                deposit.settlement.refundAmount,
                deposit.currency,
              )}{' '}
              après retenues de{' '}
              {formatMoney(deposit.settlement.deducted, deposit.currency)}
              {deposit.settlement.settledAt
                ? ` — réglée le ${formatDate(deposit.settlement.settledAt)}`
                : ''}
              {deposit.settlement.payoutId
                ? ' · reversement à valider'
                : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      {lease.status === 'ACTIVE' ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-heading">
              Révision annuelle
            </h2>
            {lease.indexationRate ? (
              <span className="text-xs text-muted">
                Taux contractuel{' '}
                {(
                  Number(lease.indexationRate) * 100
                ).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                %
              </span>
            ) : null}
          </div>
          {indexations.length === 0 ? (
            <p className="text-sm text-muted">
              {lease.indexationRate
                ? 'Aucune révision proposée. La proposition est ouverte 30 jours avant la date anniversaire.'
                : 'Aucune clause de révision sur ce bail.'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-lg text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-card text-muted">
                    <th className="px-3 py-2 font-medium">Effet</th>
                    <th className="px-3 py-2 font-medium">Loyer</th>
                    <th className="px-3 py-2 font-medium">Taux</th>
                    <th className="px-3 py-2 font-medium">Anniversaire</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                    {role === 'owner' ? (
                      <th className="px-3 py-2 font-medium">Décision</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {indexations.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="px-3 py-2 text-xs">
                        {row.actionType === 'RENT_REDUCTION'
                          ? 'Réduction'
                          : 'Augmentation'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.previousMonthlyRent
                          ? formatMoney(row.previousMonthlyRent, lease.currency)
                          : '—'}
                        {' → '}
                        <span className="font-medium">
                          {row.newMonthlyRent
                            ? formatMoney(row.newMonthlyRent, lease.currency)
                            : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.rate
                          ? `${(
                              Number(row.rate) * 100
                            ).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.effectiveFrom ? formatDate(row.effectiveFrom) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          label={indexationStatusLabel(row.status)}
                          tone={indexationStatusTone(row.status)}
                        />
                      </td>
                      {role === 'owner' ? (
                        <td className="px-3 py-2">
                          {row.status === 'PENDING' ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={action !== null}
                                onClick={() =>
                                  handleIndexationDecision(row, 'APPROVE')
                                }
                                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
                              >
                                Approuver
                              </button>
                              <button
                                type="button"
                                disabled={action !== null}
                                onClick={() =>
                                  handleIndexationDecision(row, 'REJECT')
                                }
                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                              >
                                Refuser
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">
                              {row.decidedAt
                                ? `Décidé le ${formatDate(row.decidedAt)}`
                                : '—'}
                            </span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {lease.status === 'ACTIVE' ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-heading">Renouvellement</h2>
            <button
              type="button"
              disabled={action !== null}
              onClick={handleRenew}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
            >
              {action === 'renew' ? 'Renouvellement…' : 'Renouveler le bail'}
            </button>
          </div>
          <p className="text-sm text-muted">
            Échéance actuelle le {formatDate(lease.endDate)} ·{' '}
            {lease.autoRenew
              ? 'renouvellement tacite activé (prolongation automatique d’un an)'
              : 'renouvellement tacite désactivé — renouveler ou donner congé'}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs text-muted">
              Nouvelle date de fin
              <input
                type="date"
                value={renewEndDate}
                onChange={(event) => setRenewEndDate(event.target.value)}
                className="block rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1 text-xs text-muted">
              Loyer du nouveau terme ({lease.currency}, vide = inchangé)
              <input
                type="number"
                min={0}
                value={renewRent}
                onChange={(event) => setRenewRent(event.target.value)}
                placeholder={lease.monthlyRent}
                className="block w-40 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
          </div>
          <p className="text-xs text-muted">
            Sous mandat, un changement de loyer est soumis au propriétaire
            avant d’être appliqué.
          </p>
        </div>
      ) : null}

      {lease.status === 'ACTIVE' ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-heading">Colocation</h2>
          </div>
          {coTenants.length === 0 ? (
            <p className="text-sm text-muted">
              Aucun colocataire déclaré — seul le locataire principal est au
              bail.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {coTenants.map((coTenant) => (
                <li
                  key={coTenant.userId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="text-foreground">
                    {coTenant.name ?? coTenant.phone ?? coTenant.userId.slice(0, 8)}
                  </span>
                  <span className="text-xs text-muted">{coTenant.phone}</span>
                  <button
                    type="button"
                    disabled={action !== null}
                    onClick={() => handleRemoveCoTenant(coTenant)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                  >
                    Retirer (avenant)
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="tel"
              value={coTenantPhone}
              onChange={(event) => setCoTenantPhone(event.target.value)}
              placeholder="+242061234567"
              className="w-48 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <button
              type="button"
              disabled={action !== null}
              onClick={handleAddCoTenant}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
            >
              {action === 'co-tenant-add' ? 'Création…' : 'Ajouter (avenant)'}
            </button>
          </div>
          <p className="text-xs text-muted">
            L’avenant doit être signé par les deux parties avant que le
            colocataire soit ajouté ; le numéro doit déjà avoir un compte.
          </p>
        </div>
      ) : null}

      {lease.status === 'ACTIVE' ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-heading">Avenants</h2>
            <button
              type="button"
              disabled={action !== null}
              onClick={handleCreateAmendment}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
            >
              {action === 'amendment' ? 'Création…' : 'Créer un avenant'}
            </button>
          </div>
          {amendments.length === 0 ? (
            <p className="text-sm text-muted">Aucun avenant sur ce bail.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-lg text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-card text-muted">
                    <th className="px-3 py-2 font-medium">Version</th>
                    <th className="px-3 py-2 font-medium">Modifications</th>
                    <th className="px-3 py-2 font-medium">Effet</th>
                    <th className="px-3 py-2 font-medium">Signatures</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {amendments.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="px-3 py-2">v{row.version}</td>
                      <td className="px-3 py-2 text-xs">
                        {amendmentChangesLabel(row.changes, lease.currency)}
                        {row.reason ? (
                          <span className="ml-1 text-muted">— {row.reason}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {formatDate(row.effectiveFrom)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted">
                        Locataire {row.tenantSignedAt ? '✓' : '—'} · bailleur{' '}
                        {row.landlordSignedAt ? '✓' : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row.applied ? (
                          <StatusBadge label="Appliqué" tone="success" />
                        ) : amendmentOtp === row.version ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={6}
                              value={amendmentCode}
                              onChange={(event) =>
                                setAmendmentCode(event.target.value)
                              }
                              placeholder="000000"
                              className="w-24 rounded-lg border border-border bg-background px-2 py-1 font-mono text-xs text-foreground"
                            />
                            <button
                              type="button"
                              disabled={action !== null}
                              onClick={() =>
                                handleAmendmentOtp(row.version, true)
                              }
                              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
                            >
                              Signer
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={action !== null}
                            onClick={() => handleAmendmentOtp(row.version, false)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                          >
                            Recevoir le code
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <ManagedDocumentsSection
        title="Contrats"
        emptyHint="Aucun contrat ou avenant déposé."
        typeOptions={(
          Object.keys(LEASE_DOCUMENT_TYPE_LABELS) as LeaseDocumentType[]
        ).map((value) => ({
          value,
          label: LEASE_DOCUMENT_TYPE_LABELS[value],
        }))}
        typeLabels={LEASE_DOCUMENT_DISPLAY_LABELS}
        items={leaseDocs}
        busy={docsBusy}
        onUpload={async (file, type) => {
          setDocsBusy(true);
          try {
            await uploadLeaseDocument(
              leaseId,
              file,
              type as LeaseDocumentType,
            );
            await loadDocs();
          } finally {
            setDocsBusy(false);
          }
        }}
        onDelete={async (id) => {
          setDocsBusy(true);
          try {
            await deleteLeaseDocument(leaseId, id);
            await loadDocs();
          } finally {
            setDocsBusy(false);
          }
        }}
      />

      {lease.status === 'ACTIVE' ||
      lease.status === 'TERMINATING' ||
      lease.status === 'TERMINATED' ? (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-heading">
            Échéancier de loyers
          </h2>
          {schedule.length === 0 ? (
            <p className="text-sm text-muted">Aucune échéance générée.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-md text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-card text-muted">
                    <th className="px-3 py-2 font-medium">Échéance</th>
                    <th className="px-3 py-2 font-medium">Nature</th>
                    <th className="px-3 py-2 font-medium">Montant</th>
                    <th className="px-3 py-2 font-medium">Payé</th>
                    <th className="px-3 py-2 font-medium">Solde</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="px-3 py-2">{formatDate(row.dueDate)}</td>
                      <td className="px-3 py-2 text-xs text-muted">
                        {scheduleKindLabel(row.kind)}
                      </td>
                      <td className="px-3 py-2">
                        {formatMoney(row.amount, row.currency)}
                        {Number(row.chargesPart) > 0 ? (
                          <span className="ml-1 text-xs text-muted">
                            dont {formatMoney(row.chargesPart, row.currency)} de
                            charges
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {formatMoney(row.amountPaid, row.currency)}
                      </td>
                      <td className="px-3 py-2">
                        {formatMoney(
                          String(scheduleBalance(row)),
                          row.currency,
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {rentScheduleStatusLabel(row.status)}
                      </td>
                      <td className="px-3 py-2">
                        {row.kind === 'LATE_FEE' &&
                        row.status !== 'CANCELLED' ? (
                          <button
                            type="button"
                            disabled={action !== null}
                            onClick={() =>
                              runAction('waive', () => waiveLateFee(row.id))
                            }
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                          >
                            {action === 'waive' ? 'Annulation…' : 'Annuler'}
                          </button>
                        ) : RECORDABLE_SCHEDULE_STATUSES.has(row.status) ? (
                          <RecordCashPaymentButton
                            rentScheduleId={row.id}
                            amount={String(scheduleBalance(row))}
                            currency={row.currency}
                            dueDateLabel={formatDate(row.dueDate)}
                            onRecorded={load}
                            onError={setError}
                          />
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
