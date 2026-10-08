import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  Mandate,
  MandateActionType,
  MandateApproval,
  MandateStatus,
  OrgMemberRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { RentScheduleGenerator } from '../leases/rent-schedule.generator.service';
import { R2Service } from '../media/r2.service';
import { renderAmendmentPdf } from './amendment-pdf';

export interface PublicMandate {
  id: string;
  propertyId: string;
  organizationId: string;
  assignedAgentId: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  // Spec 03
  scopes: string[];
  exclusive: boolean;
  managementFeeRate: string | null;
  lettingFee: string | null;
  lettingFeeMonths: string | null;
  saleCommissionRate: string | null;
  stayCommissionRate: string | null;
  repairApprovalThreshold: string | null;
  rentChangeRequiresApproval: boolean;
  leaseSignRequiresApproval: boolean;
  minSalePrice: string | null;
  approvalTtlDays: number;
  noticeDays: number;
  tacitRenewal: boolean;
  proposedById: string;
  acceptedById: string | null;
  acceptedAt: string | null;
  terminationRequestedAt: string | null;
  terminationEffectiveAt: string | null;
  terminationReason: string | null;
  terminatedById: string | null;
  signedDocumentKey: string | null;
  ownerSignedAt: string | null;
  agencySignedAt: string | null;
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
  // Spec 03
  requestedById: string;
  sourceType: string | null;
  sourceId: string | null;
  comment: string | null;
  expiresAt: string;
  appliedAt: string | null;
}

@Injectable()
export class MandateApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly scheduleGen: RentScheduleGenerator,
    private readonly r2: R2Service,
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
    sourceType?: string;
    sourceId?: string;
  }): Promise<PublicMandateApproval> {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: input.mandateId },
    });
    const livingStatuses: MandateStatus[] = [
      MandateStatus.ACTIVE,
      MandateStatus.TERMINATING,
    ];
    if (
      !mandate ||
      !livingStatuses.includes(mandate.status) ||
      (mandate.status === MandateStatus.TERMINATING &&
        (mandate.terminationEffectiveAt?.getTime() ?? 0) <= Date.now())
    ) {
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
        requestedById: input.requestedByUserId,
        expiresAt: new Date(
          Date.now() + mandate.approvalTtlDays * 86_400_000,
        ),
        ...(input.sourceType ? { sourceType: input.sourceType } : {}),
        ...(input.sourceId ? { sourceId: input.sourceId } : {}),
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
   * Spec 03: an APPROVED decision **applies its effect in the same
   * transaction** (lease activated, rent reduced, ticket unblocked, price
   * updated, expense validated…); a REJECTED decision leaves the source
   * object in its previous state and records the reason for the agent.
   */
  async decideApproval(
    userId: string,
    approvalId: string,
    decision: {
      approve?: boolean;
      decision?: 'APPROVE' | 'REJECT';
      note?: string;
      comment?: string;
    },
  ): Promise<PublicMandateApproval> {
    await this.expireOverdue();

    const approval = await this.prisma.mandateApproval.findUnique({
      where: { id: approvalId },
      include: {
        mandate: {
          include: { property: { select: { ownerId: true, title: true } } },
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
    if (approval.status === ApprovalStatus.EXPIRED) {
      throw new BadRequestException({
        code: 'APPROVAL_EXPIRED',
        message: 'This approval has expired and can no longer be decided',
      });
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException({
        code: 'APPROVAL_ALREADY_DECIDED',
        message: `This approval has already been ${approval.status.toLowerCase()}`,
      });
    }

    if (decision.decision === undefined && decision.approve === undefined) {
      throw new BadRequestException({
        code: 'MISSING_DECISION',
        message: 'Provide decision (APPROVE|REJECT) or approve (boolean)',
      });
    }
    const approve =
      decision.decision !== undefined
        ? decision.decision === 'APPROVE'
        : decision.approve === true;
    const comment = decision.comment ?? decision.note;

    // RENT_REDUCTION: build the avenant PDF first so its URL lands inside
    // the same transaction as the rent changes.
    let avenant:
      | { url: string; key: string; name: string }
      | undefined;
    if (approve && approval.actionType === 'RENT_REDUCTION') {
      avenant = await this.buildAvenant(approval);
    }

    const postActions: Array<() => Promise<void>> = [];

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mandateApproval.update({
        where: { id: approvalId },
        data: {
          status: approve
            ? ApprovalStatus.APPROVED
            : ApprovalStatus.REJECTED,
          decidedAt: new Date(),
          decidedBy: userId,
          ...(comment ? { comment } : {}),
          ...(approve ? { appliedAt: new Date() } : {}),
        },
      });
      if (approve) {
        await this.applyApprovedEffect(
          tx,
          approval,
          avenant,
          userId,
          postActions,
        );
      }
      return row;
    });

    for (const action of postActions) await action();

    await this.events.emit(DOMAIN_EVENTS.MANDATE_ACTION_DECIDED, {
      approvalId: approval.id,
      mandateId: approval.mandateId,
      actionType: approval.actionType,
      decision: approve ? 'APPROVED' : 'REJECTED',
      decidedBy: userId,
    });
    if (approve && approval.actionType === 'EXPENSE') {
      const expenseId = String(
        (approval.payload as { expenseId?: string } | null)?.expenseId ??
          approval.sourceId ??
          '',
      );
      if (expenseId) {
        await this.events.emit(DOMAIN_EVENTS.EXPENSE_APPROVED, { expenseId });
      }
    }
    return this.toPublic(updated);
  }

  /**
   * Applies the real effect of an APPROVED decision, inside the caller's
   * transaction. `postActions` collects work that must run after commit
   * (rent-schedule generation, domain events).
   */
  private async applyApprovedEffect(
    tx: Prisma.TransactionClient,
    approval: MandateApproval & {
      mandate: Mandate & { property: { ownerId: string; title: string } };
    },
    avenant: { url: string; key: string; name: string } | undefined,
    decidedBy: string,
    postActions: Array<() => Promise<void>>,
  ): Promise<void> {
    const payload = (approval.payload ?? {}) as Record<string, unknown>;

    switch (approval.actionType) {
      case 'LEASE_SIGN': {
        const leaseId = String(payload.leaseId ?? '');
        if (!leaseId) return; // legacy/demo payload — nothing to activate
        const lease = await tx.lease.findUnique({ where: { id: leaseId } });
        if (!lease) {
          throw new NotFoundException({
            code: 'APPROVAL_SOURCE_NOT_FOUND',
            message: 'Lease to activate no longer exists',
          });
        }
        if (lease.status === 'TERMINATED') {
          throw new BadRequestException({
            code: 'LEASE_TERMINATED',
            message: 'A terminated lease cannot be activated',
          });
        }
        if (lease.status !== 'ACTIVE') {
          await tx.lease.update({
            where: { id: leaseId },
            data: { status: 'ACTIVE' },
          });
        }
        postActions.push(async () => {
          await this.scheduleGen.generateForLease(leaseId, {
            startDate: lease.startDate,
            endDate: lease.endDate,
            monthlyRent: lease.monthlyRent.toString(),
            currency: lease.currency,
          });
          await this.events.emit(DOMAIN_EVENTS.LEASE_CREATED, {
            leaseId,
            propertyId: lease.propertyId,
            tenantId: lease.tenantId,
          });
        });
        return;
      }

      case 'RENT_REDUCTION':
      case 'RENT_INCREASE': {
        const leaseId = String(payload.leaseId ?? '');
        const newRent = Number(payload.newMonthlyRent ?? 0);
        const effectiveFrom = new Date(String(payload.effectiveFrom ?? ''));
        if (!leaseId || !(newRent > 0) || Number.isNaN(effectiveFrom.getTime())) {
          throw new BadRequestException({
            code: 'INVALID_APPROVAL_PAYLOAD',
            message: `${approval.actionType} requires leaseId, newMonthlyRent and effectiveFrom`,
          });
        }
        const lease = await tx.lease.findUnique({ where: { id: leaseId } });
        if (!lease) {
          throw new NotFoundException({
            code: 'APPROVAL_SOURCE_NOT_FOUND',
            message: 'Lease no longer exists',
          });
        }
        // Spec 04 US 11 — a renewal approval also extends the term and
        // generates the schedule of the new term (the proposal carried
        // `newEndDate` alongside the new rent).
        const rawNewEndDate = payload.newEndDate
          ? new Date(String(payload.newEndDate))
          : null;
        const extendTo =
          rawNewEndDate &&
          !Number.isNaN(rawNewEndDate.getTime()) &&
          rawNewEndDate.getTime() > lease.endDate.getTime()
            ? rawNewEndDate
            : null;
        await tx.lease.update({
          where: { id: leaseId },
          data: {
            monthlyRent: newRent,
            ...(extendTo ? { endDate: extendTo } : {}),
          },
        });
        await tx.rentSchedule.updateMany({
          where: {
            leaseId,
            status: 'PENDING',
            dueDate: { gte: effectiveFrom },
            kind: 'RENT',
          },
          // `amount = rentPart + chargesPart`: both parts move so the schedule
          // stays consistent with the new rent (spec 04).
          data: { amount: newRent, rentPart: newRent },
        });
        if (avenant) {
          await tx.leaseDocument.create({
            data: {
              leaseId,
              type: 'AMENDMENT',
              url: avenant.url,
              name: avenant.name,
              uploadedBy: decidedBy,
            },
          });
        }
        if (extendTo) {
          postActions.push(async () => {
            // Only the new term's lines are missing: existing ones are kept
            // by the (leaseId, dueDate, kind) unique index.
            await this.scheduleGen.generateForLease(leaseId, {
              startDate: lease.startDate,
              endDate: extendTo,
              monthlyRent: String(newRent),
              chargesAmount: lease.chargesAmount.toString(),
              dueDay: lease.dueDay,
              currency: lease.currency,
            });
            await this.events.emit(DOMAIN_EVENTS.LEASE_RENEWED, {
              leaseId,
              propertyId: lease.propertyId,
              tenantId: lease.tenantId,
              previousEndDate: lease.endDate.toISOString(),
              newEndDate: extendTo.toISOString(),
              newMonthlyRent: String(newRent),
              approvalId: approval.id,
            });
          });
        }
        return;
      }

      case 'MAJOR_REPAIR': {
        const ticketId = String(payload.ticketId ?? '');
        if (!ticketId) return;
        const ticket = await tx.maintenanceTicket.findUnique({
          where: { id: ticketId },
        });
        if (!ticket) {
          throw new NotFoundException({
            code: 'APPROVAL_SOURCE_NOT_FOUND',
            message: 'Maintenance ticket no longer exists',
          });
        }
        await tx.maintenanceTicket.update({
          where: { id: ticketId },
          data: { requiresOwnerApproval: false },
        });
        return;
      }

      case 'SALE_PRICE': {
        const price = Number(payload.price ?? 0);
        if (!(price > 0)) {
          throw new BadRequestException({
            code: 'INVALID_APPROVAL_PAYLOAD',
            message: 'SALE_PRICE requires a positive price',
          });
        }
        await tx.property.update({
          where: { id: approval.mandate.propertyId },
          data: { price },
        });
        return;
      }

      case 'SALE_OFFER_ACCEPT': {
        const agreementId =
          String(payload.agreementId ?? approval.sourceId ?? '');
        if (!agreementId) return;
        const agreement = await tx.saleAgreement.findUnique({
          where: { id: agreementId },
        });
        if (!agreement) {
          throw new NotFoundException({
            code: 'APPROVAL_SOURCE_NOT_FOUND',
            message: 'Sale agreement no longer exists',
          });
        }
        if (agreement.status === 'DRAFT') {
          await tx.saleAgreement.update({
            where: { id: agreementId },
            data: { status: 'ACTIVE' },
          });
        }
        return;
      }

      case 'EXPENSE': {
        const expenseId = String(
          payload.expenseId ?? approval.sourceId ?? '',
        );
        if (!expenseId) return;
        const expense = await tx.expense.findUnique({
          where: { id: expenseId },
        });
        if (!expense) {
          throw new NotFoundException({
            code: 'APPROVAL_SOURCE_NOT_FOUND',
            message: 'Expense no longer exists',
          });
        }
        await tx.expense.update({
          where: { id: expenseId },
          data: { status: 'APPROVED' },
        });
        return;
      }

      default:
        return;
    }
  }

  /** Renders + uploads the rent-reduction amendment PDF (spec 03 US 10). */
  private async buildAvenant(
    approval: MandateApproval & {
      mandate: Mandate & { property: { ownerId: string; title: string } };
    },
  ): Promise<{ url: string; key: string; name: string } | undefined> {
    const payload = (approval.payload ?? {}) as Record<string, unknown>;
    const leaseId = String(payload.leaseId ?? '');
    if (!leaseId) return undefined;
    try {
      const pdf = await renderAmendmentPdf({
        propertyTitle: approval.mandate.property.title,
        previousRent: String(payload.previousMonthlyRent ?? ''),
        newRent: String(payload.newMonthlyRent ?? ''),
        currency: String(payload.currency ?? 'XAF'),
        effectiveFrom: new Date(String(payload.effectiveFrom ?? '')),
        decidedAt: new Date(),
      });
      const name = `Avenant de bail — ${approval.mandate.property.title}.pdf`;
      const uploaded = await this.r2.uploadLeaseFile({
        leaseId,
        filename: name,
        contentType: 'application/pdf',
        body: pdf,
      });
      return { url: uploaded.url, key: uploaded.key, name };
    } catch {
      // Storage is not configured in some test environments: the approval
      // still applies, only the generated document is skipped.
      return undefined;
    }
  }

  /**
   * Agency side (assigned agent or gérant) submits an action for the owner's
   * sign-off (spec 03 US 9). Payload is validated per action type.
   */
  async createApproval(
    userId: string,
    mandateId: string,
    input: {
      actionType: MandateActionType;
      sourceType?: string;
      sourceId?: string;
      payload?: Record<string, unknown>;
    },
  ): Promise<PublicMandateApproval> {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: mandateId },
    });
    if (!mandate) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_FOUND',
        message: 'Mandate does not exist',
      });
    }
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: mandate.organizationId,
        },
      },
    });
    const isGerant = member?.role === OrgMemberRole.ADMIN;
    const isAssignedAgent =
      member?.role === OrgMemberRole.AGENT &&
      mandate.assignedAgentId === userId;
    if (!isGerant && !isAssignedAgent) {
      throw new ForbiddenException({
        code: 'NOT_MANDATE_ACTOR',
        message:
          'Only the mandate gérant or the assigned agent can request approvals',
      });
    }

    const payload = { ...(input.payload ?? {}) };
    this.validateApprovalPayload(input.actionType, payload, input.sourceId);

    return this.requireApproval({
      mandateId,
      actionType: input.actionType,
      payload,
      requestedByUserId: userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
  }

  /** The requester cancels their own PENDING approval (spec 03 endpoints). */
  async cancelApproval(
    userId: string,
    approvalId: string,
  ): Promise<PublicMandateApproval> {
    await this.expireOverdue();
    const approval = await this.prisma.mandateApproval.findUnique({
      where: { id: approvalId },
    });
    if (!approval) {
      throw new NotFoundException({
        code: 'APPROVAL_NOT_FOUND',
        message: 'Approval does not exist',
      });
    }
    if (approval.requestedById !== userId) {
      throw new ForbiddenException({
        code: 'NOT_REQUESTER',
        message: 'Only the requester can cancel an approval',
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
      data: { status: ApprovalStatus.CANCELLED },
    });
    return this.toPublic(updated);
  }

  /**
   * Approvals past their TTL turn EXPIRED (spec 03 US 11). The source object
   * is left untouched: effects only ever applied on APPROVED.
   */
  async expireOverdue(): Promise<number> {
    const res = await this.prisma.mandateApproval.updateMany({
      where: {
        status: ApprovalStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: ApprovalStatus.EXPIRED },
    });
    return res.count;
  }

  private validateApprovalPayload(
    actionType: MandateActionType,
    payload: Record<string, unknown>,
    sourceId?: string,
  ): void {
    const fail = (message: string): never => {
      throw new BadRequestException({
        code: 'INVALID_APPROVAL_PAYLOAD',
        message,
      });
    };
    switch (actionType) {
      case 'LEASE_SIGN':
        if (!payload.leaseId) fail('LEASE_SIGN requires payload.leaseId');
        return;
      case 'RENT_REDUCTION':
      case 'RENT_INCREASE': {
        if (!payload.leaseId)
          fail(`${actionType} requires payload.leaseId`);
        if (!(Number(payload.newMonthlyRent) > 0))
          fail(`${actionType} requires payload.newMonthlyRent > 0`);
        const eff = new Date(String(payload.effectiveFrom ?? ''));
        if (Number.isNaN(eff.getTime()))
          fail(`${actionType} requires payload.effectiveFrom (ISO date)`);
        return;
      }
      case 'MAJOR_REPAIR':
        if (!payload.ticketId)
          fail('MAJOR_REPAIR requires payload.ticketId');
        return;
      case 'SALE_PRICE':
        if (!(Number(payload.price) > 0))
          fail('SALE_PRICE requires payload.price > 0');
        return;
      case 'SALE_OFFER_ACCEPT':
        if (!payload.agreementId && !sourceId)
          fail('SALE_OFFER_ACCEPT requires payload.agreementId or sourceId');
        return;
      case 'EXPENSE':
        if (!payload.expenseId && !sourceId)
          fail('EXPENSE requires payload.expenseId or sourceId');
        return;
      default:
        return;
    }
  }

  async listForMandate(mandateId: string): Promise<PublicMandateApproval[]> {
    await this.expireOverdue();
    const rows = await this.prisma.mandateApproval.findMany({
      where: { mandateId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async listPendingForOwner(
    ownerUserId: string,
    page = 1,
    pageSize = 50,
  ): Promise<PublicMandateApproval[]> {
    await this.expireOverdue();
    const rows = await this.prisma.mandateApproval.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        mandate: { property: { ownerId: ownerUserId } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (Math.max(1, page) - 1) * Math.min(100, Math.max(1, pageSize)),
      take: Math.min(100, Math.max(1, pageSize)),
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
      requestedById: a.requestedById,
      sourceType: a.sourceType,
      sourceId: a.sourceId,
      comment: a.comment,
      expiresAt: a.expiresAt.toISOString(),
      appliedAt: a.appliedAt?.toISOString() ?? null,
    };
  }
}
