import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceTicket,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { MandateApprovalService } from '../mandates/mandate-approval.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { AuditLogService } from '../common/audit-log.service';

/**
 * MVP rule: URGENT priority combined with an estimated cost above this
 * threshold (in XAF) triggers a mandatory owner approval before work
 * can proceed. The threshold is intentionally low to err on the side of
 * caution; the owner can approve or reject via the existing
 * MandateApprovalService flow.
 */
export const URGENT_APPROVAL_THRESHOLD_XAF = 100_000;

export interface CreateMaintenanceTicketInput {
  propertyId: string;
  reporterId: string;
  title: string;
  description: string;
  priority?: MaintenancePriority;
  estimatedCost?: number;
  /** Spec 15 A1 — contexte et catégorie. */
  leaseId?: string;
  bookingId?: string;
  category?: import('@prisma/client').MaintenanceCategory;
  availability?: string;
  entryPermission?: boolean;
  /**
   * If the ticket will require owner approval, the caller must supply the
   * ACTIVE mandate ID that authorizes this agency/agent. We use it to
   * route the approval request through MandateApprovalService.
   */
  mandateId?: string;
}

export interface UpdateMaintenanceTicketInput {
  status?: MaintenanceStatus;
  estimatedCost?: number;
}

/** SLA par priorité — première action, en heures (spec 09). */
const SLA_FIRST_RESPONSE_HOURS: Record<MaintenancePriority, number> = {
  URGENT: 4,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 72,
};

/**
 * Spec 15 A1 — table de transitions seule (remplace le PATCH de statut
 * libre). Reopen modélisé RESOLVED→OPEN (statut REOPENED conservé dans
 * l'enum pour compat schéma spec 09).
 */
const ALLOWED_TRANSITIONS: ReadonlySet<string> = new Set([
  'OPEN->TRIAGED',
  'OPEN->AWAITING_QUOTE',
  'OPEN->ASSIGNED',
  'OPEN->CANCELLED',
  'TRIAGED->AWAITING_QUOTE',
  'TRIAGED->ASSIGNED',
  'TRIAGED->CANCELLED',
  'AWAITING_QUOTE->AWAITING_APPROVAL',
  'AWAITING_QUOTE->ASSIGNED',
  'AWAITING_QUOTE->CANCELLED',
  'AWAITING_APPROVAL->ASSIGNED',
  'AWAITING_APPROVAL->TRIAGED',
  'AWAITING_APPROVAL->CANCELLED',
  'ASSIGNED->SCHEDULED',
  'ASSIGNED->IN_PROGRESS',
  'ASSIGNED->CANCELLED',
  'SCHEDULED->IN_PROGRESS',
  'SCHEDULED->CANCELLED',
  'IN_PROGRESS->RESOLVED',
  'IN_PROGRESS->CANCELLED',
  'RESOLVED->CLOSED',
  'RESOLVED->OPEN',
  'REOPENED->TRIAGED',
  'REOPENED->CANCELLED',
]);

export function computeSlaDueAt(
  createdAt: Date,
  priority: MaintenancePriority,
): Date {
  return new Date(
    createdAt.getTime() + SLA_FIRST_RESPONSE_HOURS[priority] * 3_600_000,
  );
}

export interface PublicMaintenanceTicket {
  id: string;
  propertyId: string;
  reporterId: string;
  assigneeId: string | null;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  estimatedCost: string | null;
  requiresOwnerApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly approvals: MandateApprovalService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Spec 15 A1 — contrôle d'éligibilité à l'ouverture (09) : locataire du
   * bail ACTIVE/TERMINATING, voyageur CHECKED_IN, gestionnaire via
   * AgencyAccessService, propriétaire. Sinon 403 NOT_ALLOWED_ON_PROPERTY.
   */
  private async assertCanOpenTicket(
    propertyId: string,
    reporterId: string,
  ): Promise<void> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true },
    });
    if (property?.ownerId === reporterId) return;

    const canManage = await this.agencyAccess.canOperateOnProperty(
      reporterId,
      propertyId,
    );
    if (canManage) return;

    const lease = await this.prisma.lease.findFirst({
      where: {
        propertyId,
        status: { in: ['ACTIVE', 'TERMINATING'] },
        OR: [
          { tenantId: reporterId },
          { coTenants: { some: { userId: reporterId } } },
        ],
      },
      select: { id: true },
    });
    if (lease) return;

    const booking = await this.prisma.booking.findFirst({
      where: {
        propertyId,
        userId: reporterId,
        status: 'CHECKED_IN',
      },
      select: { id: true },
    });
    if (booking) return;

    throw new ForbiddenException({
      code: 'NOT_ALLOWED_ON_PROPERTY',
      message:
        'Seuls le locataire du bail, le voyageur en cours de séjour, le propriétaire ou le gestionnaire peuvent ouvrir un ticket sur ce bien.',
    });
  }

  private async recordTransition(
    ticketId: string,
    from: MaintenanceStatus | null,
    to: MaintenanceStatus,
    actorId: string | null,
    note?: string,
  ): Promise<void> {
    await this.prisma.maintenanceStatusChange.create({
      data: {
        ticketId,
        from: from ?? MaintenanceStatus.OPEN,
        to,
        actorId,
        ...(note ? { note } : {}),
      },
    });
  }

  /**
   * Spec 15 A1 — transition contrôlée par la table. Chaque transition
   * valide écrit un MaintenanceStatusChange dans la même transaction.
   */
  async transition(
    userId: string,
    ticketId: string,
    input: {
      to: MaintenanceStatus;
      note?: string;
      scheduledAt?: Date;
      actualCost?: number;
      cancelReason?: string;
    },
  ): Promise<PublicMaintenanceTicket> {
    const ticket = await this.prisma.maintenanceTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket does not exist',
      });
    }
    const from = ticket.status;
    const key = `${from}->${input.to}`;
    if (!ALLOWED_TRANSITIONS.has(key)) {
      throw new ConflictException({
        code: 'INVALID_TRANSITION',
        message: `Transition ${key} non permise`,
      });
    }

    // Qui a le droit ? Le côté vente/gestion pour tout, le déclarant pour
    // CANCELLED / reopen / CLOSED.
    const isReporter = ticket.reporterId === userId;
    const isManager = await this.agencyAccess.canOperateOnProperty(
      userId,
      ticket.propertyId,
    );
    if (!isManager && !isReporter) {
      throw new ForbiddenException({
        code: 'NOT_TICKET_PARTY',
        message: 'Ni déclarant ni gestionnaire de ce ticket',
      });
    }
    if (
      !isManager &&
      !(input.to === 'CANCELLED' || input.to === 'CLOSED' || from === 'RESOLVED')
    ) {
      throw new ForbiddenException({
        code: 'NOT_TICKET_PARTY',
        message:
          "Le déclarant ne peut qu'annuler, confirmer la résolution ou rouvrir",
      });
    }

    // Verrou approbation : une transition qui débloque le travail exige
    // l'APPROVED si requiresOwnerApproval (spec 09).
    if (
      (input.to === 'ASSIGNED' || input.to === 'SCHEDULED' || input.to === 'IN_PROGRESS') &&
      ticket.requiresOwnerApproval
    ) {
      await this.assertRepairApproved(ticketId);
    }

    if (input.to === 'SCHEDULED' && !input.scheduledAt) {
      throw new BadRequestException({
        code: 'SCHEDULED_AT_REQUIRED',
        message: 'La transition SCHEDULED exige scheduledAt',
      });
    }
    if (input.to === 'CANCELLED' && !input.cancelReason && !input.note) {
      throw new BadRequestException({
        code: 'CANCEL_REASON_REQUIRED',
        message: 'Un motif est requis pour annuler un ticket',
      });
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.maintenanceTicket.update({
        where: { id: ticketId },
        data: {
          status: input.to,
          ...(input.to === 'SCHEDULED' && input.scheduledAt
            ? { scheduledAt: input.scheduledAt }
            : {}),
          ...(input.to === 'IN_PROGRESS' ? { startedAt: now } : {}),
          ...(input.to === 'RESOLVED' ? { resolvedAt: now } : {}),
          ...(input.to === 'RESOLVED' && input.actualCost !== undefined
            ? { actualCost: new Prisma.Decimal(input.actualCost) }
            : {}),
          ...(input.to === 'CLOSED' ? { closedAt: now } : {}),
          ...(input.to === 'CANCELLED'
            ? { cancelReason: input.cancelReason ?? input.note ?? null }
            : {}),
        },
      });
      await tx.maintenanceStatusChange.create({
        data: {
          ticketId,
          from,
          to: input.to,
          actorId: userId,
          ...(input.note || input.cancelReason
            ? { note: input.note ?? input.cancelReason }
            : {}),
        },
      });
      return row;
    });

    await this.audit.record({
      actorId: userId,
      actorType: 'USER',
      action: 'maintenance.ticket.transition',
      targetType: 'MAINTENANCE_TICKET',
      targetId: ticketId,
      before: { status: from },
      after: { status: input.to },
      metadata: input.note ? { note: input.note } : undefined,
    });

    return this.toPublic(updated);
  }

  async createTicket(
    input: CreateMaintenanceTicketInput & {
      leaseId?: string;
      bookingId?: string;
      category?: import('@prisma/client').MaintenanceCategory;
      availability?: string;
      entryPermission?: boolean;
    },
  ): Promise<PublicMaintenanceTicket> {
    const property = await this.prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true, ownerId: true, organizationId: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }

    // Spec 15 A1 — contrôle d'éligibilité à l'ouverture : locataire du bail
    // ACTIVE/TERMINATING, voyageur CHECKED_IN, gestionnaire, propriétaire.
    await this.assertCanOpenTicket(input.propertyId, input.reporterId);

    // Spec 03: a per-mandate `repairApprovalThreshold` replaces the legacy
    // priority-only rule when present.
    const mandateThreshold = input.mandateId
      ? (
          await this.prisma.mandate.findUnique({
            where: { id: input.mandateId },
            select: { repairApprovalThreshold: true },
          })
        )?.repairApprovalThreshold ?? null
      : null;
    const requiresOwnerApproval = this.computeRequiresOwnerApproval(
      input,
      mandateThreshold,
    );

    if (requiresOwnerApproval && !input.mandateId) {
      throw new BadRequestException({
        code: 'MANDATE_ID_REQUIRED',
        message:
          'URGENT tickets above the cost threshold require an active mandateId',
      });
    }

    const priority = input.priority ?? MaintenancePriority.MEDIUM;
    const ticket = await this.prisma.maintenanceTicket.create({
      data: {
        propertyId: input.propertyId,
        reporterId: input.reporterId,
        title: input.title,
        description: input.description,
        priority,
        status: MaintenanceStatus.OPEN,
        slaDueAt: computeSlaDueAt(new Date(), priority),
        ...(input.estimatedCost !== undefined
          ? { estimatedCost: new Prisma.Decimal(input.estimatedCost) }
          : {}),
        ...(input.leaseId ? { leaseId: input.leaseId } : {}),
        ...(input.bookingId ? { bookingId: input.bookingId } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.availability ? { availability: input.availability } : {}),
        ...(input.entryPermission !== undefined
          ? { entryPermission: input.entryPermission }
          : {}),
        requiresOwnerApproval,
      },
    });
    await this.recordTransition(
      ticket.id,
      null,
      MaintenanceStatus.OPEN,
      input.reporterId,
      'Ouverture du ticket',
    );
    await this.audit.record({
      actorId: input.reporterId,
      actorType: 'USER',
      action: 'maintenance.ticket.open',
      targetType: 'MAINTENANCE_TICKET',
      targetId: ticket.id,
      metadata: { propertyId: ticket.propertyId, priority },
    });

    if (requiresOwnerApproval && input.mandateId) {
      await this.approvals.requireApproval({
        mandateId: input.mandateId,
        actionType: 'MAJOR_REPAIR',
        payload: {
          ticketId: ticket.id,
          estimatedCost: ticket.estimatedCost?.toString() ?? null,
          title: ticket.title,
        },
        // We don't have the requesting user's id in this input, but the
        // reporter is the tenant who raised the issue. We pass that
        // through for traceability; the approval flow keys off the
        // mandate, not the requester.
        requestedByUserId: input.reporterId,
      });
    }

    // Spec 15 A3 — l'ouverture du ticket est auditée.
    await this.audit.record({
      actorId: input.reporterId,
      actorType: 'USER',
      action: 'maintenance.ticket.open',
      targetType: 'MAINTENANCE_TICKET',
      targetId: ticket.id,
      metadata: { propertyId: ticket.propertyId, priority },
    });

    await this.events.emit(DOMAIN_EVENTS.MAINTENANCE_OPENED, {
      ticketId: ticket.id,
      propertyId: ticket.propertyId,
      priority: ticket.priority,
    });

    return this.toPublic(ticket);
  }

  async getOne(
    userId: string,
    ticketId: string,
  ): Promise<PublicMaintenanceTicket> {
    const ticket = await this.prisma.maintenanceTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket does not exist',
      });
    }
    await this.assertCanReadTicket(userId, ticket);
    return this.toPublic(ticket);
  }

  async updateTicket(
    userId: string,
    ticketId: string,
    input: UpdateMaintenanceTicketInput,
  ): Promise<PublicMaintenanceTicket> {
    const existing = await this.prisma.maintenanceTicket.findUnique({
      where: { id: ticketId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket does not exist',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(
      userId,
      existing.propertyId,
    );
    // Spec 15 A1 — le statut ne se change plus ici : passer par
    // `transition()` (POST …/transitions). Champs descriptifs uniquement.
    const updated = await this.prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        ...(input.estimatedCost !== undefined
          ? { estimatedCost: new Prisma.Decimal(input.estimatedCost) }
          : {}),
      },
    });
    return this.toPublic(updated);
  }

  async assignTicket(
    userId: string,
    ticketId: string,
    assigneeId: string,
  ): Promise<PublicMaintenanceTicket> {
    const existing = await this.prisma.maintenanceTicket.findUnique({
      where: { id: ticketId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket does not exist',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(
      userId,
      existing.propertyId,
    );
    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true },
    });
    if (!assignee) {
      throw new NotFoundException({
        code: 'ASSIGNEE_NOT_FOUND',
        message: 'Assignee does not exist',
      });
    }
    if (existing.requiresOwnerApproval) {
      await this.assertRepairApproved(ticketId);
    }
    const updated = await this.prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        assigneeId,
        status:
          existing.status === MaintenanceStatus.OPEN
            ? MaintenanceStatus.ASSIGNED
            : existing.status,
      },
    });
    return this.toPublic(updated);
  }

  async listForActor(actorUserId: string): Promise<PublicMaintenanceTicket[]> {
    // An actor sees tickets for properties they own, or for properties
    // managed by an org they belong to (any role — owners, agents,
    // managers — should see tickets on their org's portfolio).
    const accessible = await this.prisma.property.findMany({
      where: {
        OR: [
          { ownerId: actorUserId },
          {
            organization: {
              members: { some: { userId: actorUserId } },
            },
          },
        ],
      },
      select: { id: true },
    });
    const ids = accessible.map((p) => p.id);
    if (ids.length === 0) return [];
    const rows = await this.prisma.maintenanceTicket.findMany({
      where: { propertyId: { in: ids } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async listMine(reporterId: string): Promise<PublicMaintenanceTicket[]> {
    const rows = await this.prisma.maintenanceTicket.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  /**
   * URGENT tickets with an estimated cost above the threshold require
   * the owner's sign-off before work begins. Lower-priority tickets, or
   * URGENT ones within budget, can proceed immediately.
   */
  private computeRequiresOwnerApproval(
    input: CreateMaintenanceTicketInput,
    mandateThreshold: Prisma.Decimal | null,
  ): boolean {
    if (mandateThreshold !== null) {
      return (
        input.estimatedCost !== undefined &&
        input.estimatedCost > mandateThreshold.toNumber()
      );
    }
    if (input.priority !== MaintenancePriority.URGENT) return false;
    if (input.estimatedCost === undefined) return false;
    return input.estimatedCost > URGENT_APPROVAL_THRESHOLD_XAF;
  }

  /**
   * Spec 03 acceptance: while `requiresOwnerApproval` is set, transitioning
   * the ticket (assign / status change) answers 409 OWNER_APPROVAL_REQUIRED
   * until a MAJOR_REPAIR approval is APPROVED.
   */
  private async assertRepairApproved(ticketId: string): Promise<void> {
    const approved = await this.prisma.mandateApproval.findFirst({
      where: {
        actionType: 'MAJOR_REPAIR',
        status: 'APPROVED',
        payload: { path: ['ticketId'], equals: ticketId },
      },
      select: { id: true },
    });
    if (!approved) {
      throw new ConflictException({
        code: 'OWNER_APPROVAL_REQUIRED',
        message:
          'The owner must approve the MAJOR_REPAIR request before this ticket can move forward',
      });
    }
  }

  private async assertCanReadTicket(
    userId: string,
    ticket: Pick<MaintenanceTicket, 'propertyId' | 'reporterId'>,
  ): Promise<void> {
    if (ticket.reporterId === userId) return;
    await this.agencyAccess.assertCanOperateOnProperty(
      userId,
      ticket.propertyId,
    );
  }

  private toPublic(t: MaintenanceTicket): PublicMaintenanceTicket {
    return {
      id: t.id,
      propertyId: t.propertyId,
      reporterId: t.reporterId,
      assigneeId: t.assigneeId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      estimatedCost: t.estimatedCost?.toString() ?? null,
      requiresOwnerApproval: t.requiresOwnerApproval,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
