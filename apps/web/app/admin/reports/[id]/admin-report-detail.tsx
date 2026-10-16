'use client';

import { appDialog } from '@/components/dialogs/app-dialog';
import {
  DashboardPageHeader,
  StatusBadge,
  UserIdentity,
} from '@/components/dashboard';
import { DetailCard, DetailRow } from '@/components/detail';
import { ApiErrorBanner } from '@/components/forms';
import { Button } from '@/components/primitives/Button';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  getAdminReport,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  reportStatusTone,
  updateAdminReport,
  type AdminReportDetail,
  type PropertyReportStatus,
} from '@/lib/admin/reports';
import { ROUTES } from '@/lib/routes';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AdminReportDetailPage({
  reportId,
}: {
  reportId: string;
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const [report, setReport] = useState<AdminReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await getAdminReport(reportId));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger ce signalement.',
      );
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  async function handleUpdate(status: PropertyReportStatus): Promise<void> {
    const isDismiss = status === 'DISMISSED';
    let adminNote: string | undefined;

    if (isDismiss) {
      const note = await appDialog.prompt({
        title: 'Rejeter le signalement',
        message: 'Vous pouvez laisser une note interne pour la traçabilité.',
        label: 'Note admin (optionnel)',
        placeholder: 'Motif du rejet…',
        multiline: true,
        variant: 'danger',
        confirmLabel: 'Rejeter',
      });
      if (note === null) return;
      adminNote = note.trim() || undefined;
    } else if (
      !(await appDialog.confirm({
        title: 'Marquer comme traité',
        message: 'Confirmer le traitement de ce signalement ?',
        confirmLabel: 'Marquer comme traité',
      }))
    ) {
      return;
    }

    setBusy(true);
    try {
      await updateAdminReport(reportId, status, adminNote);
      await load();
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de mettre à jour le signalement.',
      );
    } finally {
      setBusy(false);
    }
  }

  const title = report?.propertyTitle ?? 'Signalement';

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title={title}
        description="Détail du signalement d’annonce"
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.admin.dashboard },
          { label: 'Signalements', href: ROUTES.admin.reports },
          { label: title },
        ]}
        actions={
          report?.status === 'OPEN' ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={busy}
                onClick={() => void handleUpdate('ACTIONED')}
              >
                Marquer comme traité
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={busy}
                onClick={() => void handleUpdate('DISMISSED')}
              >
                Rejeter
              </Button>
            </div>
          ) : null
        }
      />

      <ApiErrorBanner message={error} />

      {!ready || loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : report ? (
        <>
          <DetailCard title="Signalement">
            <DetailRow label="Statut">
              <StatusBadge
                label={REPORT_STATUS_LABELS[report.status]}
                tone={reportStatusTone(report.status)}
              />
            </DetailRow>
            <DetailRow
              label="Motif"
              value={REPORT_REASON_LABELS[report.reason] ?? report.reason}
            />
            <DetailRow
              label="Description"
              value={report.description || '—'}
            />
            <DetailRow
              label="Signalé le"
              value={formatDate(report.createdAt)}
            />
            <DetailRow
              label="Examiné le"
              value={formatDate(report.reviewedAt)}
            />
            <DetailRow label="Clé rapporteur" value={report.reporterKey} />
            <DetailRow label="Note admin" value={report.adminNote || '—'} />
            <DetailRow label="Identifiant" value={report.id} />
          </DetailCard>

          <DetailCard title="Annonce concernée">
            <DetailRow label="Titre" value={report.property.title} />
            <DetailRow label="Statut" value={report.property.status} />
            <DetailRow label="Mode" value={report.property.mode} />
            <DetailRow
              label="Quartier"
              value={report.property.quartierName || '—'}
            />
            <DetailRow label="Adresse" value={report.property.address} />
            <DetailRow label="Propriétaire">
              <div className="space-y-2">
                <UserIdentity
                  name={report.property.owner.name}
                  fallbackName="Propriétaire"
                />
                {report.property.owner.phone ? (
                  <p className="text-sm text-muted">
                    {report.property.owner.phone}
                  </p>
                ) : null}
                <Link
                  href={ROUTES.admin.user(report.property.owner.id)}
                  className="text-sm text-accent underline-offset-2 hover:underline"
                >
                  Voir le compte propriétaire
                </Link>
              </div>
            </DetailRow>
            <DetailRow label="Identifiant bien" value={report.property.id} />
          </DetailCard>

          <div>
            <Link
              href={ROUTES.admin.reports}
              className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              ← Retour aux signalements
            </Link>
          </div>
        </>
      ) : null}
    </section>
  );
}
