import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Mandate,
  MandateScope,
  MandateStatus,
  OrgMemberRole,
  Prisma,
} from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from './agency-access.service';
import { PublicMandate } from './mandate-approval.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { OtpStore } from '../auth/otp.store';
import { InfobipOtpService } from '../auth/infobip-otp.service';
import { R2Service } from '../media/r2.service';
import { renderMandatePdf } from './mandate-pdf';

export interface CreateMandateInput {
  propertyId: string;
  organizationId: string;
  endDate?: Date;
  scopes?: MandateScope[];
  exclusive?: boolean;
  managementFeeRate?: number;
  lettingFee?: number;
  lettingFeeMonths?: number;
  saleCommissionRate?: number;
  stayCommissionRate?: number;
  repairApprovalThreshold?: number;
  rentChangeRequiresApproval?: boolean;
  leaseSignRequiresApproval?: boolean;
  minSalePrice?: number;
  approvalTtlDays?: number;
  noticeDays?: number;
  tacitRenewal?: boolean;
}

export interface TerminateMandateInput {
  reason: string;
  immediate?: boolean;
}

export interface CounterMandateInput {
  scopes?: MandateScope[];
  exclusive?: boolean;
  managementFeeRate?: number;
  lettingFee?: number;
  lettingFeeMonths?: number;
  saleCommissionRate?: number;
  stayCommissionRate?: number;
  approvalTtlDays?: number;
  noticeDays?: number;
  endDate?: Date;
  reason?: string;
}

export interface ListManagedMandatesFilter {
  status?: MandateStatus;
  scope?: MandateScope;
  page?: number;
  pageSize?: number;
}

/** Mandats still occupying a property+scope (ACTIVE, or under notice). */
function livingMandateWhere(): Prisma.MandateWhereInput {
  return {
    OR: [
      { status: MandateStatus.ACTIVE },
      {
        status: MandateStatus.TERMINATING,
        terminationEffectiveAt: { gt: new Date() },
      },
    ],
  };
}

function scopesOverlap(a: MandateScope[], b: MandateScope[]): boolean {
  // An empty scope list (legacy mandates) covers every scope.
  if (a.length === 0 || b.length === 0) return true;
  return a.some((s) => b.includes(s));
}

@Injectable()
export class MandatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly events: EventPublisher,
    private readonly otpStore: OtpStore,
    private readonly infobip: InfobipOtpService,
    private readonly r2: R2Service,
  ) {}

  /**
   * Owner proposes a mandate to an agency org (spec 03 — US 1). The mandate
   * starts PROPOSED and grants the agency **no access** until `accept`.
   */
  async createMandate(
    userId: string,
    input: CreateMandateInput,
  ): Promise<PublicMandate> {
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
    if (property.ownerId !== userId) {
      throw new ForbiddenException({
        code: 'NOT_PROPERTY_OWNER',
        message: 'Only the property owner can create a mandate',
      });
    }
    if (input.organizationId === property.organizationId) {
      throw new ForbiddenException({
        code: 'MANDATE_SAME_ORG',
        message: 'Mandate target organization must differ from the owner org',
      });
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Target organization does not exist',
      });
    }

    const scopes = input.scopes?.length
      ? input.scopes
      : [MandateScope.LONG_TERM_RENTAL];
    await this.assertNoConflict(input.propertyId, scopes);

    const data: Prisma.MandateUncheckedCreateInput = {
      propertyId: input.propertyId,
      organizationId: input.organizationId,
      status: MandateStatus.PROPOSED,
      proposedById: userId,
      scopes,
      exclusive: input.exclusive ?? false,
      ...(input.endDate ? { endDate: input.endDate } : {}),
      ...(input.managementFeeRate !== undefined
        ? { managementFeeRate: input.managementFeeRate }
        : {}),
      ...(input.lettingFee !== undefined ? { lettingFee: input.lettingFee } : {}),
      ...(input.lettingFeeMonths !== undefined
        ? { lettingFeeMonths: input.lettingFeeMonths }
        : {}),
      ...(input.saleCommissionRate !== undefined
        ? { saleCommissionRate: input.saleCommissionRate }
        : {}),
      ...(input.stayCommissionRate !== undefined
        ? { stayCommissionRate: input.stayCommissionRate }
        : {}),
      ...(input.repairApprovalThreshold !== undefined
        ? { repairApprovalThreshold: input.repairApprovalThreshold }
        : {}),
      ...(input.rentChangeRequiresApproval !== undefined
        ? { rentChangeRequiresApproval: input.rentChangeRequiresApproval }
        : {}),
      ...(input.leaseSignRequiresApproval !== undefined
        ? { leaseSignRequiresApproval: input.leaseSignRequiresApproval }
        : {}),
      ...(input.minSalePrice !== undefined
        ? { minSalePrice: input.minSalePrice }
        : {}),
      ...(input.approvalTtlDays !== undefined
        ? { approvalTtlDays: input.approvalTtlDays }
        : {}),
      ...(input.noticeDays !== undefined ? { noticeDays: input.noticeDays } : {}),
      ...(input.tacitRenewal !== undefined
        ? { tacitRenewal: input.tacitRenewal }
        : {}),
    };

    const mandate = await this.prisma.mandate.create({
      data: {
        ...data,
        versions: {
          create: {
            terms: this.snapshotTerms(data as Record<string, unknown>),
            proposedBy: userId,
          },
        },
      },
    });

    await this.events.emit(DOMAIN_EVENTS.MANDATE_PROPOSED, {
      mandateId: mandate.id,
      propertyId: mandate.propertyId,
      organizationId: mandate.organizationId,
    });
    return this.toPublic(mandate);
  }

  /**
   * Accept the latest version (spec 03 — endpoint MANAGER; both parties may
   * accept, since a counter-proposal from either side awaits the other).
   */
  async acceptMandate(userId: string, mandateId: string): Promise<PublicMandate> {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: mandateId },
      include: { property: { select: { ownerId: true } } },
    });
    if (!mandate) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_FOUND',
        message: 'Mandate does not exist',
      });
    }
    this.assertProposedState(mandate, 'accept');
    const isOwner = mandate.property.ownerId === userId;
    const isGerant = await this.isAgencyGerant(userId, mandate.organizationId);
    if (!isOwner && !isGerant) {
      throw new ForbiddenException({
        code: 'NOT_MANDATE_PARTY',
        message: 'Only a mandate party can accept the proposal',
      });
    }

    await this.assertNoConflict(mandate.propertyId, mandate.scopes, mandate.id);

    const updated = await this.prisma.mandate.update({
      where: { id: mandateId },
      data: {
        status: MandateStatus.ACTIVE,
        acceptedById: userId,
        acceptedAt: new Date(),
      },
    });
    await this.events.emit(DOMAIN_EVENTS.MANDATE_ACCEPTED, {
      mandateId: updated.id,
      propertyId: updated.propertyId,
      organizationId: updated.organizationId,
    });
    return this.toPublic(updated);
  }

  /** Agency gérant declines the proposal with a reason (US 2). */
  async declineMandate(
    userId: string,
    mandateId: string,
    reason: string,
  ): Promise<PublicMandate> {
    const mandate = await this.requireMandate(mandateId);
    this.assertProposedState(mandate, 'decline');
    await this.agencyAccess.assertIsAgencyGerant(userId, mandate.organizationId);

    const updated = await this.prisma.mandate.update({
      where: { id: mandateId },
      data: {
        status: MandateStatus.DECLINED,
        terminationReason: reason,
        terminatedById: userId,
      },
    });
    await this.events.emit(DOMAIN_EVENTS.MANDATE_DECLINED, {
      mandateId: updated.id,
      propertyId: updated.propertyId,
      organizationId: updated.organizationId,
    });
    return this.toPublic(updated);
  }

  /**
   * Counter-proposal (spec 03 P2): either party revises the conditions — a
   * new MandateVersion snapshot is recorded and the mandate becomes
   * COUNTERED, waiting for the other side to accept or counter again.
   */
  async counterMandate(
    userId: string,
    mandateId: string,
    input: CounterMandateInput,
  ): Promise<PublicMandate> {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: mandateId },
      include: { property: { select: { ownerId: true } } },
    });
    if (!mandate) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_FOUND',
        message: 'Mandate does not exist',
      });
    }
    if (
      mandate.status !== MandateStatus.PROPOSED &&
      mandate.status !== MandateStatus.COUNTERED
    ) {
      throw new BadRequestException({
        code: 'MANDATE_NOT_PENDING',
        message: 'Only a proposed or countered mandate can be countered',
      });
    }
    const isOwner = mandate.property.ownerId === userId;
    const isGerant = await this.isAgencyGerant(userId, mandate.organizationId);
    if (!isOwner && !isGerant) {
      throw new ForbiddenException({
        code: 'NOT_MANDATE_PARTY',
        message: 'Only a mandate party can counter-propose',
      });
    }
    if (input.reason && input.reason.trim().length < 3) {
      throw new BadRequestException({
        code: 'COUNTER_REASON_REQUIRED',
        message: 'A counter-proposal reason must be at least 3 characters',
      });
    }

    const scopes = input.scopes?.length ? input.scopes : mandate.scopes;
    await this.assertNoConflict(mandate.propertyId, scopes, mandate.id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mandate.update({
        where: { id: mandateId },
        data: {
          status: MandateStatus.COUNTERED,
          scopes,
          ...(input.exclusive !== undefined
            ? { exclusive: input.exclusive }
            : {}),
          ...(input.managementFeeRate !== undefined
            ? { managementFeeRate: input.managementFeeRate }
            : {}),
          ...(input.lettingFee !== undefined
            ? { lettingFee: input.lettingFee }
            : {}),
          ...(input.lettingFeeMonths !== undefined
            ? { lettingFeeMonths: input.lettingFeeMonths }
            : {}),
          ...(input.saleCommissionRate !== undefined
            ? { saleCommissionRate: input.saleCommissionRate }
            : {}),
          ...(input.stayCommissionRate !== undefined
            ? { stayCommissionRate: input.stayCommissionRate }
            : {}),
          ...(input.approvalTtlDays !== undefined
            ? { approvalTtlDays: input.approvalTtlDays }
            : {}),
          ...(input.noticeDays !== undefined
            ? { noticeDays: input.noticeDays }
            : {}),
          ...(input.endDate ? { endDate: input.endDate } : {}),
        },
      });
      await tx.mandateVersion.create({
        data: {
          mandateId,
          terms: {
            scopes,
            ...(input.exclusive !== undefined
              ? { exclusive: input.exclusive }
              : {}),
            ...(input.managementFeeRate !== undefined
              ? { managementFeeRate: input.managementFeeRate }
              : {}),
            ...(input.lettingFee !== undefined
              ? { lettingFee: input.lettingFee }
              : {}),
            ...(input.lettingFeeMonths !== undefined
              ? { lettingFeeMonths: input.lettingFeeMonths }
              : {}),
            ...(input.saleCommissionRate !== undefined
              ? { saleCommissionRate: input.saleCommissionRate }
              : {}),
            ...(input.stayCommissionRate !== undefined
              ? { stayCommissionRate: input.stayCommissionRate }
              : {}),
            ...(input.approvalTtlDays !== undefined
              ? { approvalTtlDays: input.approvalTtlDays }
              : {}),
            ...(input.noticeDays !== undefined
              ? { noticeDays: input.noticeDays }
              : {}),
            ...(input.endDate ? { endDate: input.endDate } : {}),
            ...(input.reason ? { reason: input.reason } : {}),
          } as Prisma.InputJsonValue,
          proposedBy: userId,
        },
      });
      return row;
    });
    return this.toPublic(updated);
  }

  /**
   * Electronic signature (spec 03 P2): both parties sign with an OTP sent by
   * SMS. Without `code`, the OTP is sent; with `code`, it is verified. Once
   * both sides signed, the mandate PDF is generated and stored.
   */
  async signMandate(
    userId: string,
    mandateId: string,
    input: { code?: string },
  ): Promise<PublicMandate & { signature?: { sent?: boolean; signed?: boolean; bothSigned: boolean } }> {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: mandateId },
      include: { property: { select: { ownerId: true, title: true } } },
    });
    if (!mandate) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_FOUND',
        message: 'Mandate does not exist',
      });
    }
    if (mandate.status !== MandateStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'MANDATE_NOT_ACTIVE',
        message: 'Only an accepted mandate can be signed',
      });
    }
    const isOwner = mandate.property.ownerId === userId;
    const isGerant = await this.isAgencyGerant(userId, mandate.organizationId);
    if (!isOwner && !isGerant) {
      throw new ForbiddenException({
        code: 'NOT_MANDATE_PARTY',
        message: 'Only a mandate party can sign',
      });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    if (!user?.phone) {
      throw new BadRequestException({
        code: 'SIGN_PHONE_MISSING',
        message: 'The signing account has no phone number',
      });
    }

    const alreadySigned = isOwner
      ? mandate.ownerSignedAt !== null
      : mandate.agencySignedAt !== null;
    if (alreadySigned) {
      throw new BadRequestException({
        code: 'ALREADY_SIGNED',
        message: 'This party has already signed the mandate',
      });
    }

    // No code → dispatch a fresh OTP by SMS.
    if (!input.code) {
      const code = String(randomInt(100000, 999999));
      await this.otpStore.put(user.phone, code, 'MANDATE_SIGN');
      await this.infobip.sendText({
        to: user.phone,
        text: `Paradis Immo — code de signature de mandat : ${code}`,
      });
      return {
        ...this.toPublic(mandate),
        signature: { sent: true, bothSigned: false },
      };
    }

    const record = await this.otpStore.getWithAttempts(user.phone);
    const valid =
      record !== null &&
      record.purpose === 'MANDATE_SIGN' &&
      record.code === input.code;
    if (!valid) {
      const after = await this.otpStore.incrementAttempts(user.phone);
      if (after && after.attempts >= 5) {
        await this.otpStore.del(user.phone);
      }
      throw new BadRequestException({
        code: 'SIGN_INVALID_CODE',
        message: 'Invalid or expired signature code',
      });
    }
    await this.otpStore.del(user.phone);

    const now = new Date();
    const updated = await this.prisma.mandate.update({
      where: { id: mandateId },
      data: isOwner ? { ownerSignedAt: now } : { agencySignedAt: now },
    });

    const bothSigned =
      updated.ownerSignedAt !== null && updated.agencySignedAt !== null;
    let signedDocumentKey = updated.signedDocumentKey;
    if (bothSigned && !signedDocumentKey) {
      const pdf = await renderMandatePdf({
        propertyTitle: mandate.property.title,
        scopes: mandate.scopes,
        managementFeeRate: mandate.managementFeeRate?.toString() ?? null,
        startDate: mandate.startDate,
        endDate: mandate.endDate,
        ownerSignedAt: updated.ownerSignedAt,
        agencySignedAt: updated.agencySignedAt,
      });
      const uploaded = await this.r2.uploadPrivateFile({
        folder: 'mandates',
        ownerId: mandate.id,
        filename: `mandat-${mandate.id}.pdf`,
        contentType: 'application/pdf',
        body: pdf,
      });
      await this.prisma.mandate.update({
        where: { id: mandateId },
        data: { signedDocumentKey: uploaded.key },
      });
      signedDocumentKey = uploaded.key;
    }

    return {
      ...this.toPublic({ ...updated, signedDocumentKey }),
      signature: { signed: true, bothSigned },
    };
  }

  /**
   * Termination (spec 03 — P0 route de résiliation, US 5/6):
   * - OWNER (property owner) or MANAGER (agency gérant);
   * - `immediate` (faute) → TERMINATED right away;
   * - otherwise → TERMINATING with `terminationEffectiveAt = now + noticeDays`
   *   (agency keeps access until that date).
   */
  async terminateMandate(
    userId: string,
    mandateId: string,
    input: TerminateMandateInput,
  ): Promise<PublicMandate> {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: mandateId },
      include: { property: { select: { ownerId: true } } },
    });
    if (!mandate) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_FOUND',
        message: 'Mandate does not exist',
      });
    }
    if (mandate.status !== MandateStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'MANDATE_NOT_ACTIVE',
        message: 'Only an active mandate can be terminated',
      });
    }
    const isOwner = mandate.property.ownerId === userId;
    const isGerant = await this.isAgencyGerant(userId, mandate.organizationId);
    if (!isOwner && !isGerant) {
      throw new ForbiddenException({
        code: 'NOT_MANDATE_PARTY',
        message: 'Only the property owner or the agency gérant can terminate',
      });
    }
    const reason = input.reason?.trim();
    if (!reason) {
      throw new BadRequestException({
        code: 'TERMINATION_REASON_REQUIRED',
        message: 'A termination reason is required',
      });
    }

    const now = new Date();
    const immediate = input.immediate === true;
    const effectiveAt = immediate
      ? now
      : new Date(now.getTime() + mandate.noticeDays * 86_400_000);

    const updated = await this.prisma.mandate.update({
      where: { id: mandateId },
      data: {
        status: immediate ? MandateStatus.TERMINATED : MandateStatus.TERMINATING,
        terminationRequestedAt: now,
        terminationEffectiveAt: effectiveAt,
        terminationReason: reason,
        terminatedById: userId,
      },
    });

    await this.events.emit(DOMAIN_EVENTS.MANDATE_TERMINATED, {
      mandateId: updated.id,
      propertyId: updated.propertyId,
      organizationId: updated.organizationId,
      effectiveAt: effectiveAt.toISOString(),
      reason,
    });
    return this.toPublic(updated);
  }

  /** Owner: mandates over my properties. Optional status filter (US 4). */
  async listMandatesForOwner(
    ownerUserId: string,
    status?: MandateStatus,
  ): Promise<PublicMandate[]> {
    const rows = await this.prisma.mandate.findMany({
      where: {
        property: { ownerId: ownerUserId },
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((m) => this.toPublic(m));
  }

  /**
   * Mandates for agencies the user belongs to.
   * Gérant (ADMIN): all org mandates. Field AGENT: only assigned to self.
   * Filters: `status`, `scope`; pagination via page/pageSize.
   */
  async listManagedMandates(
    userId: string,
    filter: ListManagedMandatesFilter = {},
  ): Promise<PublicMandate[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true, role: true },
    });
    if (memberships.length === 0) return [];

    const gerantOrgIds = memberships
      .filter((m) => m.role === OrgMemberRole.ADMIN)
      .map((m) => m.organizationId);
    const agentOrgIds = memberships
      .filter((m) => m.role === OrgMemberRole.AGENT)
      .map((m) => m.organizationId);

    if (gerantOrgIds.length === 0 && agentOrgIds.length === 0) return [];

    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 50));

    const rows = await this.prisma.mandate.findMany({
      where: {
        // Proposals are visible to the agency too (they need to accept them),
        // so only pin the status when an explicit filter is requested.
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.scope ? { scopes: { has: filter.scope } } : {}),
        OR: [
          ...(gerantOrgIds.length
            ? [{ organizationId: { in: gerantOrgIds } }]
            : []),
          ...(agentOrgIds.length
            ? [
                {
                  organizationId: { in: agentOrgIds },
                  assignedAgentId: userId,
                },
              ]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return rows.map((m) => this.toPublic(m));
  }

  /** Detail view for either party: mandate + versions + approvals (US 4). */
  async getMandateDetail(
    userId: string,
    mandateId: string,
  ): Promise<
    PublicMandate & {
      versions: Array<{ id: string; terms: unknown; proposedBy: string; createdAt: string }>;
      approvals: unknown[];
    }
  > {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: mandateId },
      include: {
        property: { select: { ownerId: true } },
        versions: { orderBy: { createdAt: 'desc' } },
        approvals: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!mandate) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_FOUND',
        message: 'Mandate does not exist',
      });
    }
    const isOwner = mandate.property.ownerId === userId;
    const isAgency = await this.isAgencyMember(userId, mandate.organizationId);
    const isAssigned = mandate.assignedAgentId === userId;
    if (!isOwner && !isAgency && !isAssigned) {
      throw new ForbiddenException({
        code: 'NOT_MANDATE_PARTY',
        message: 'Only a mandate party can view this mandate',
      });
    }
    return {
      ...this.toPublic(mandate),
      versions: mandate.versions.map((v) => ({
        id: v.id,
        terms: v.terms,
        proposedBy: v.proposedBy,
        createdAt: v.createdAt.toISOString(),
      })),        approvals: mandate.approvals,
    };
  }

  /**
   * Parties only: presigned download URL for the signed mandate PDF
   * (spec 03 — écran détail, « PDF »).
   */
  async getSignedDocumentUrl(
    userId: string,
    mandateId: string,
  ): Promise<{ url: string }> {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: mandateId },
      select: {
        signedDocumentKey: true,
        organizationId: true,
        assignedAgentId: true,
        property: { select: { ownerId: true } },
      },
    });
    if (!mandate) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_FOUND',
        message: 'Mandate does not exist',
      });
    }
    const isOwner = mandate.property.ownerId === userId;
    const isAgency = await this.isAgencyMember(userId, mandate.organizationId);
    const isAssigned = mandate.assignedAgentId === userId;
    if (!isOwner && !isAgency && !isAssigned) {
      throw new ForbiddenException({
        code: 'NOT_MANDATE_PARTY',
        message: 'Only a mandate party can view this document',
      });
    }
    if (!mandate.signedDocumentKey) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_SIGNED',
        message: 'The mandate document has not been signed yet',
      });
    }
    return { url: await this.r2.createPresignedDownload(mandate.signedDocumentKey) };
  }

  async assignAgent(
    userId: string,
    mandateId: string,
    agentUserId: string | null,
  ): Promise<PublicMandate> {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: mandateId },
    });
    if (!mandate) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_FOUND',
        message: 'Mandate does not exist',
      });
    }
    if (mandate.status !== MandateStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'MANDATE_NOT_ACTIVE',
        message: 'Only active mandates can be assigned',
      });
    }

    await this.agencyAccess.assertIsAgencyGerant(
      userId,
      mandate.organizationId,
    );

    if (agentUserId !== null) {
      const member = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: agentUserId,
            organizationId: mandate.organizationId,
          },
        },
      });
      if (
        !member ||
        (member.role !== OrgMemberRole.AGENT &&
          member.role !== OrgMemberRole.ADMIN)
      ) {
        throw new BadRequestException({
          code: 'INVALID_ASSIGNEE',
          message:
            'Assignee must be an AGENT or ADMIN (gérant) of the mandate agency',
        });
      }
    }

    const updated = await this.prisma.mandate.update({
      where: { id: mandateId },
      data: { assignedAgentId: agentUserId },
    });
    if (agentUserId !== null) {
      // Spec 03 US 8: the agent is notified of the assignment.
      await this.events.emit(DOMAIN_EVENTS.MANDATE_AGENT_ASSIGNED, {
        mandateId,
        agentUserId,
        assignedBy: userId,
      });
    }
    return this.toPublic(updated);
  }

  /** Legacy route kept for compatibility — P0 termination is `terminateMandate`. */
  async revokeMandate(
    userId: string,
    mandateId: string,
  ): Promise<PublicMandate> {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: mandateId },
      include: { property: { select: { ownerId: true } } },
    });
    if (!mandate) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_FOUND',
        message: 'Mandate does not exist',
      });
    }
    if (mandate.property.ownerId !== userId) {
      throw new ForbiddenException({
        code: 'NOT_PROPERTY_OWNER',
        message: 'Only the property owner can revoke the mandate',
      });
    }
    const updated = await this.prisma.mandate.update({
      where: { id: mandateId },
      data: {
        status: MandateStatus.TERMINATED,
        terminationReason: 'OWNER_REVOKED',
        terminationRequestedAt: new Date(),
        terminationEffectiveAt: new Date(),
        terminatedById: userId,
      },
    });
    return this.toPublic(updated);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async requireMandate(mandateId: string): Promise<Mandate> {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: mandateId },
    });
    if (!mandate) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_FOUND',
        message: 'Mandate does not exist',
      });
    }
    return mandate;
  }

  private assertProposedState(
    mandate: Mandate,
    action: string,
  ): void {
    if (
      mandate.status !== MandateStatus.PROPOSED &&
      mandate.status !== MandateStatus.COUNTERED
    ) {
      throw new BadRequestException({
        code: 'MANDATE_NOT_PENDING',
        message: `Only a proposed or countered mandate can be ${action}ed`,
      });
    }
  }

  /**
   * Uniqueness: one living mandate per property + scope. Any overlap with a
   * living mandate → 409 MANDATE_CONFLICT (spec 03 règles métier).
   */
  private async assertNoConflict(
    propertyId: string,
    scopes: MandateScope[],
    excludeMandateId?: string,
  ): Promise<void> {
    const living = await this.prisma.mandate.findMany({
      where: {
        propertyId,
        ...(excludeMandateId ? { id: { not: excludeMandateId } } : {}),
        ...livingMandateWhere(),
      },
      select: { id: true, scopes: true, organizationId: true },
    });
    const clash = living.find((m) => scopesOverlap(m.scopes, scopes));
    if (clash) {
      throw new ConflictException({
        code: 'MANDATE_CONFLICT',
        message:
          'Another mandate already covers this property and scope (exclusive uniqueness)',
        details: { conflictingMandateId: clash.id },
      });
    }
  }

  private async isAgencyGerant(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    return member?.role === OrgMemberRole.ADMIN;
  }

  private async isAgencyMember(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    return member !== null;
  }

  private snapshotTerms(data: Record<string, unknown>): Prisma.InputJsonValue {
    const pick = (
      keys: string[],
    ): Record<string, unknown> =>
      Object.fromEntries(
        keys
          .filter((k) => data[k] !== undefined)
          .map((k) => [k, data[k] as unknown]),
      );
    return {
      ...pick([
        'scopes',
        'exclusive',
        'managementFeeRate',
        'lettingFee',
        'lettingFeeMonths',
        'saleCommissionRate',
        'stayCommissionRate',
        'repairApprovalThreshold',
        'rentChangeRequiresApproval',
        'leaseSignRequiresApproval',
        'minSalePrice',
        'approvalTtlDays',
        'noticeDays',
        'tacitRenewal',
        'endDate',
      ]),
    } as Prisma.InputJsonValue;
  }

  toPublic(m: Mandate): PublicMandate {
    return {
      id: m.id,
      propertyId: m.propertyId,
      organizationId: m.organizationId,
      assignedAgentId: m.assignedAgentId,
      status: m.status,
      startDate: m.startDate.toISOString(),
      endDate: m.endDate?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      scopes: m.scopes,
      exclusive: m.exclusive,
      managementFeeRate: m.managementFeeRate?.toString() ?? null,
      lettingFee: m.lettingFee?.toString() ?? null,
      lettingFeeMonths: m.lettingFeeMonths?.toString() ?? null,
      saleCommissionRate: m.saleCommissionRate?.toString() ?? null,
      stayCommissionRate: m.stayCommissionRate?.toString() ?? null,
      repairApprovalThreshold: m.repairApprovalThreshold?.toString() ?? null,
      rentChangeRequiresApproval: m.rentChangeRequiresApproval,
      leaseSignRequiresApproval: m.leaseSignRequiresApproval,
      minSalePrice: m.minSalePrice?.toString() ?? null,
      approvalTtlDays: m.approvalTtlDays,
      noticeDays: m.noticeDays,
      tacitRenewal: m.tacitRenewal,
      proposedById: m.proposedById,
      acceptedById: m.acceptedById,
      acceptedAt: m.acceptedAt?.toISOString() ?? null,
      terminationRequestedAt: m.terminationRequestedAt?.toISOString() ?? null,
      terminationEffectiveAt: m.terminationEffectiveAt?.toISOString() ?? null,
      terminationReason: m.terminationReason,
      terminatedById: m.terminatedById,
      signedDocumentKey: m.signedDocumentKey,
      ownerSignedAt: m.ownerSignedAt?.toISOString() ?? null,
      agencySignedAt: m.agencySignedAt?.toISOString() ?? null,
    };
  }
}
