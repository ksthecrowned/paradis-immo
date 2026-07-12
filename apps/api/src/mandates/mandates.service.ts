import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Mandate, MandateStatus, OrgMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from './agency-access.service';
import { PublicMandate } from './mandate-approval.service';

export interface CreateMandateInput {
  propertyId: string;
  organizationId: string;
  endDate?: Date;
}

@Injectable()
export class MandatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

  /**
   * Owner delegates the management of a property to an agency org. Only
   * the property owner can create a mandate — agency-side management
   * happens via membership inside `organizationId`.
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

    const mandate = await this.prisma.mandate.create({
      data: {
        propertyId: input.propertyId,
        organizationId: input.organizationId,
        status: MandateStatus.ACTIVE,
        ...(input.endDate ? { endDate: input.endDate } : {}),
      },
    });
    return this.toPublic(mandate);
  }

  async listMandatesForOwner(ownerUserId: string): Promise<PublicMandate[]> {
    const rows = await this.prisma.mandate.findMany({
      where: { property: { ownerId: ownerUserId } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((m) => this.toPublic(m));
  }

  /**
   * Mandates for agencies the user belongs to.
   * Gérant (ADMIN): all org mandates. Field AGENT: only assigned to self.
   */
  async listManagedMandates(userId: string): Promise<PublicMandate[]> {
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

    const rows = await this.prisma.mandate.findMany({
      where: {
        status: MandateStatus.ACTIVE,
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
    });
    return rows.map((m) => this.toPublic(m));
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
    return this.toPublic(updated);
  }

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
      data: { status: MandateStatus.REVOKED },
    });
    return this.toPublic(updated);
  }

  private toPublic(m: Mandate): PublicMandate {
    return {
      id: m.id,
      propertyId: m.propertyId,
      organizationId: m.organizationId,
      assignedAgentId: m.assignedAgentId,
      status: m.status,
      startDate: m.startDate.toISOString(),
      endDate: m.endDate?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
