import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  MandateActionType,
  MandateApproval,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';

export interface PublicMandate {
  id: string;
  propertyId: string;
  organizationId: string;
  assignedAgentId: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

export interface PublicMandateApproval {
  id: string;
  mandateId: string;
  actionType: string;
  payload: Record<string, unknown>;
  status: string;
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
}

@Injectable()
export class MandateApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
  ) {}

  /**
   * Create a pending approval for an action that requires the owner's sign-off.
   * Emits `MANDATE_ACTION_PENDING` so notifications fire.
   */
  async requireApproval(input: {
    mandateId: string;
    actionType: MandateActionType;
    payload: Record<string, unknown>;
    requestedByUserId: string;
  }): Promise<PublicMandateApproval> {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: input.mandateId },
    });
    if (!mandate || mandate.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'MANDATE_NOT_ACTIVE',
        message: 'Mandate does not exist or is not active',
      });
    }

    const approval = await this.prisma.mandateApproval.create({
      data: {
        mandateId: mandate.id,
        actionType: input.actionType,
        payload: input.payload as Prisma.InputJsonValue,
        status: ApprovalStatus.PENDING,
      },
    });

    await this.events.emit(DOMAIN_EVENTS.MANDATE_ACTION_PENDING, {
      approvalId: approval.id,
      mandateId: approval.mandateId,
      actionType: approval.actionType,
    });

    return this.toPublic(approval);
  }

  /**
   * Owner of the underlying property approves or rejects a pending approval.
   */
  async decideApproval(
    userId: string,
    approvalId: string,
    decision: { approve: boolean; note?: string },
  ): Promise<PublicMandateApproval> {
    const approval = await this.prisma.mandateApproval.findUnique({
      where: { id: approvalId },
      include: {
        mandate: {
          include: { property: { select: { ownerId: true } } },
        },
      },
    });
    if (!approval) {
      throw new NotFoundException({
        code: 'APPROVAL_NOT_FOUND',
        message: 'Approval does not exist',
      });
    }
    if (approval.mandate.property.ownerId !== userId) {
      throw new ForbiddenException({
        code: 'NOT_PROPERTY_OWNER',
        message: 'Only the property owner can decide approvals',
      });
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException({
        code: 'APPROVAL_ALREADY_DECIDED',
        message: `This approval has already been ${approval.status.toLowerCase()}`,
      });
    }

    const updated = await this.prisma.mandateApproval.update({
      where: { id: approvalId },
      data: {
        status: decision.approve
          ? ApprovalStatus.APPROVED
          : ApprovalStatus.REJECTED,
        decidedAt: new Date(),
        decidedBy: userId,
      },
    });
    return this.toPublic(updated);
  }

  async listForMandate(mandateId: string): Promise<PublicMandateApproval[]> {
    const rows = await this.prisma.mandateApproval.findMany({
      where: { mandateId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async listPendingForOwner(
    ownerUserId: string,
  ): Promise<PublicMandateApproval[]> {
    const rows = await this.prisma.mandateApproval.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        mandate: { property: { ownerId: ownerUserId } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  private toPublic(a: MandateApproval): PublicMandateApproval {
    return {
      id: a.id,
      mandateId: a.mandateId,
      actionType: a.actionType,
      payload: a.payload as Record<string, unknown>,
      status: a.status,
      decidedAt: a.decidedAt?.toISOString() ?? null,
      decidedBy: a.decidedBy,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
