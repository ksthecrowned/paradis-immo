'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { Icon } from '@iconify/react';
import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import {
  DetailCard,
  DetailHeader,
  DetailRow,
} from '@/components/detail';
import { ApiErrorBanner, StatusPill } from '@/components/forms';
import { Button } from '@/components/primitives';
import { useResourceDetail } from '@/hooks/use-resource-detail';
import { useRequireSession } from '@/hooks/use-require-session';
import {
  getMaintenanceTicket,
  maintenancePriorityLabel,
  maintenanceStatusLabel,
  maintenanceStatusTone,
  type PublicMaintenanceTicket,
} from '@/lib/owner/maintenance';
import { ROUTES } from '@/lib/routes';

export interface OwnerMaintenanceDetailProps {
  ticketId: string;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatMoney(value: string | null): string {
  if (!value || value.trim() === '') return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function OwnerMaintenanceDetail({
  ticketId,
}: OwnerMaintenanceDetailProps): React.JSX.Element {
  const { ready } = useRequireSession();

  const load = useCallback(async (id: string): Promise<PublicMaintenanceTicket> => {
    return getMaintenanceTicket(id);
  }, []);

  const { data: ticket, loading, error } = useResourceDetail(ticketId, load);

  if (!ready || loading) {
    return <p className="text-base text-muted">Chargement…</p>;
  }

  if (error || !ticket) {
    return (
      <div className="space-y-4">
        <DashboardPageHeader title="Ticket maintenance" />
        <ApiErrorBanner message={error ?? 'Ticket introuvable.'} />
        <Link
          href={ROUTES.owner.maintenance}
          className="inline-flex items-center gap-1 text-base text-accent hover:underline"
        >
          <Icon icon="mdi:arrow-left" className="h-4 w-4" />
          Retour à la maintenance
        </Link>
      </div>
    );
  }

  const shortTitle =
    ticket.title.length > 40 ? `${ticket.title.slice(0, 40)}…` : ticket.title;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={ticket.title}
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.owner.dashboard },
          { label: 'Maintenance', href: ROUTES.owner.maintenance },
          { label: shortTitle },
        ]}
      />

      <DetailHeader
        title={ticket.title}
        subtitle={`Priorité ${maintenancePriorityLabel(ticket.priority).toLowerCase()}`}
        meta={
          <StatusBadge
            label={maintenanceStatusLabel(ticket.status)}
            tone={maintenanceStatusTone(ticket.status)}
          />
        }
        avatarFallback="TK"
        actions={
          <>
            <Link href={ROUTES.owner.maintenanceEdit(ticketId)}>
              <Button icon="mdi:pencil" variant="primary">
                Modifier
              </Button>
            </Link>
            <Link href={ROUTES.owner.maintenance}>
              <Button icon="mdi:arrow-left" variant="secondary">
                Retour
              </Button>
            </Link>
          </>
        }
      />

      {ticket.requiresOwnerApproval ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-base text-foreground">
          <Icon
            icon="mdi:alert-circle-outline"
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning"
          />
          <p>
            Ce ticket nécessite une approbation propriétaire (réparation urgente
            ou coût élevé).
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <DetailCard title="Informations">
            <DetailRow label="Description" value={ticket.description} />
            <DetailRow label="Créé le" value={formatDate(ticket.createdAt)} />
            <DetailRow label="Mis à jour" value={formatDate(ticket.updatedAt)} />
            <DetailRow
              label="Bien"
              value={
                <Link
                  href={ROUTES.owner.property(ticket.propertyId)}
                  className="font-mono text-accent hover:underline"
                >
                  {ticket.propertyId}
                </Link>
              }
            />
            <DetailRow
              label="Signaleur"
              value={
                <span className="font-mono text-sm">{ticket.reporterId}</span>
              }
            />
          </DetailCard>
        </div>

        <div className="space-y-6">
          <DetailCard title="Statut">
            <div className="px-5 py-4">
              <StatusPill
                label={maintenanceStatusLabel(ticket.status)}
                tone={maintenanceStatusTone(ticket.status)}
                icon="mdi:wrench-outline"
              />
            </div>
            <DetailRow
              label="Priorité"
              value={maintenancePriorityLabel(ticket.priority)}
            />
          </DetailCard>

          <DetailCard title="Suivi">
            <DetailRow
              label="Assigné à"
              value={
                ticket.assigneeId ? (
                  <span className="font-mono text-sm">{ticket.assigneeId}</span>
                ) : (
                  'Non assigné'
                )
              }
            />
            <DetailRow label="Coût estimé" value={formatMoney(ticket.estimatedCost)} />
          </DetailCard>
        </div>
      </div>
    </div>
  );
}
