'use client';

import { appDialog } from '@/components/dialogs/app-dialog';
import {
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboard';
import { DetailCard, DetailRow } from '@/components/detail';
import { ApiErrorBanner } from '@/components/forms';
import { Button } from '@/components/primitives/Button';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  getAdminOrgRequest,
  formatOrgRequestDate,
  ORG_REQUEST_STATUS_LABELS,
  ORG_REQUEST_TYPE_LABELS,
  orgRequestStatusTone,
  reviewAdminOrgRequest,
  type AdminOrgRequestDetail,
} from '@/lib/admin/organization-requests';
import { ROUTES } from '@/lib/routes';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export function AdminOnboardingDetailPage({
  requestId,
}: {
  requestId: string;
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const [request, setRequest] = useState<AdminOrgRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequest(await getAdminOrgRequest(requestId));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger ce dossier.',
      );
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  const handleInvite = useCallback(async () => {
    if (
      !(await appDialog.confirm({
        message:
          'Valider ce dossier ? Une organisation sera créée et un lien d’invitation généré.',
      }))
    ) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const { inviteUrl } = await reviewAdminOrgRequest(requestId, {
        action: 'INVITE',
      });
      setNotice(
        inviteUrl
          ? `Dossier validé — lien d’invitation à transmettre : ${inviteUrl}`
          : 'Dossier validé.',
      );
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de valider le dossier.',
      );
    } finally {
      setBusy(false);
    }
  }, [load, requestId]);

  const handleReject = useCallback(async () => {
    const reason = await appDialog.prompt({
      title: 'Rejeter le dossier',
      message: 'Un motif sera communiqué au demandeur.',
      label: 'Motif du rejet',
      defaultValue: 'Dossier incomplet',
      required: true,
      multiline: true,
      variant: 'danger',
      confirmLabel: 'Rejeter le dossier',
    });
    if (!reason || !reason.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      await reviewAdminOrgRequest(requestId, {
        action: 'REJECT',
        rejectionReason: reason.trim(),
      });
      setNotice('Dossier rejeté.');
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de rejeter le dossier.',
      );
    } finally {
      setBusy(false);
    }
  }, [load, requestId]);

  const title = request?.name ?? 'Dossier d’ouverture';

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title={title}
        description="Détail du dossier d’ouverture"
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.admin.dashboard },
          { label: 'Dossiers d’ouverture', href: ROUTES.admin.onboarding },
          { label: title },
        ]}
        actions={
          request?.status === 'PENDING' ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={busy}
                onClick={() => void handleInvite()}
              >
                Valider
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={busy}
                onClick={() => void handleReject()}
              >
                Rejeter
              </Button>
            </div>
          ) : null
        }
      />

      <ApiErrorBanner message={error} />
      {notice ? (
        <p
          className="break-all rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {!ready || loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : request ? (
        <>
          <DetailCard title="Dossier">
            <DetailRow label="Référence" value={request.reference} />
            <DetailRow
              label="Type"
              value={ORG_REQUEST_TYPE_LABELS[request.type]}
            />
            <DetailRow label="Statut">
              <StatusBadge
                label={ORG_REQUEST_STATUS_LABELS[request.status]}
                tone={orgRequestStatusTone(request.status)}
              />
            </DetailRow>
            <DetailRow
              label="Soumis le"
              value={formatOrgRequestDate(request.createdAt)}
            />
            <DetailRow
              label="Traité le"
              value={formatOrgRequestDate(request.reviewedAt)}
            />
            <DetailRow
              label="Identifiant admin ayant traité"
              value={request.reviewedBy || '—'}
            />
            {request.status === 'REJECTED' ? (
              <DetailRow
                label="Motif du rejet"
                value={request.rejectionReason || '—'}
              />
            ) : null}
          </DetailCard>

          <DetailCard title="Demandeur et organisation">
            <DetailRow label="Nom" value={request.name} />
            <DetailRow label="Raison sociale" value={request.legalName || '—'} />
            <DetailRow label="E-mail" value={request.email} />
            <DetailRow label="Téléphone" value={request.phone || '—'} />
            <DetailRow label="Ville" value={request.cityLabel || '—'} />
            <DetailRow label="Adresse" value={request.address || '—'} />
            {request.type === 'AGENCY' ? (
              <>
                <DetailRow label="RCCM" value={request.rccm || '—'} />
                <DetailRow label="NIU" value={request.niu || '—'} />
              </>
            ) : null}
            <DetailRow
              label="Identifiant du compte demandeur"
              value={request.submittedById || 'Demande publique sans compte'}
            />
          </DetailCard>

          <DetailCard title="Présentation">
            <DetailRow label="Description" value={request.description || '—'} />
          </DetailCard>

          <Link
            href={ROUTES.admin.onboarding}
            className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Retour aux dossiers d’ouverture
          </Link>
        </>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Réessayer
        </Button>
      )}
    </section>
  );
}
