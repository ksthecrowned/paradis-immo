import {
  BadRequestException,
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
  ) {}

  async createTicket(
    input: CreateMaintenanceTicketInput,
  ): Promise<PublicMaintenanceTicket> {
    const property = await this.prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }

    const requiresOwnerApproval = this.computeRequiresOwnerApproval(input);

    if (requiresOwnerApproval && !input.mandateId) {
      throw new BadRequestException({
        code: 'MANDATE_ID_REQUIRED',
        message:
          'URGENT tickets above the cost threshold require an active mandateId',
      });
    }

    const ticket = await this.prisma.maintenanceTicket.create({
      data: {
        propertyId: input.propertyId,
        reporterId: input.reporterId,
        title: input.title,
        description: input.description,
        priority: input.priority ?? MaintenancePriority.MEDIUM,
        status: MaintenanceStatus.OPEN,
        ...(input.estimatedCost !== undefined
          ? { estimatedCost: new Prisma.Decimal(input.estimatedCost) }
          : {}),
        requiresOwnerApproval,
      },
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
    const updated = await this.prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
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
  ): boolean {
    if (input.priority !== MaintenancePriority.URGENT) return false;
    if (input.estimatedCost === undefined) return false;
    return input.estimatedCost > URGENT_APPROVAL_THRESHOLD_XAF;
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
