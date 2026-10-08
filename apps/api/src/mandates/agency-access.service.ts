import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MandateStatus, OrgMemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Mandates through which the agency may still operate on a property:
 * ACTIVE, or TERMINATING while the notice period has not elapsed yet
 * (the agent keeps access up to `terminationEffectiveAt`).
 */
function liveMandateFilter(): Prisma.MandateWhereInput {
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

@Injectable()
export class AgencyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async canOperateOnProperty(
    userId: string,
    propertyId: string,
  ): Promise<boolean> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true },
    });
    if (!property) return false;
    if (property.ownerId === userId) return true;

    const mandate = await this.prisma.mandate.findFirst({
      where: { propertyId, ...liveMandateFilter() },
      select: {
        organizationId: true,
        assignedAgentId: true,
      },
    });
    if (!mandate) {
      // No live mandate: the org gérant/owner may still operate on their own
      // org's listing. Mirrors listOperablePropertyIds ("unmanaged org props
      // are gérant-only, not field AGENT") so portfolio and mutate paths
      // agree (spec 03 expenses on an unmandated org property).
      const orgAdmin = await this.prisma.property.findFirst({
        where: {
          id: propertyId,
          organization: {
            members: {
              some: {
                userId,
                role: { in: [OrgMemberRole.ADMIN, OrgMemberRole.OWNER] },
              },
            },
          },
        },
        select: { id: true },
      });
      return Boolean(orgAdmin);
    }

    const member = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: mandate.organizationId,
        },
      },
    });
    if (!member) return false;
    if (member.role === OrgMemberRole.ADMIN) return true;
    if (
      member.role === OrgMemberRole.AGENT &&
      mandate.assignedAgentId === userId
    ) {
      return true;
    }
    return false;
  }

  async assertCanOperateOnProperty(
    userId: string,
    propertyId: string,
  ): Promise<void> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    const ok = await this.canOperateOnProperty(userId, propertyId);
    if (!ok) {
      throw new ForbiddenException({
        code: 'NOT_ASSIGNED_AGENT',
        message:
          'Only the owner, agency gérant, or assigned agent can manage this property',
      });
    }
  }

  async assertIsAgencyGerant(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });
    if (!member || member.role !== OrgMemberRole.ADMIN) {
      throw new ForbiddenException({
        code: 'NOT_AGENCY_GERANT',
        message: 'Only the agency gérant can perform this action',
      });
    }
  }

  /**
   * Property IDs the user may operate on: owned, assigned/gérant under
   * active mandate, or gérant/owner on org properties without an active
   * mandate. Field agents (AGENT) only see properties they are assigned to.
   */
  async listOperablePropertyIds(userId: string): Promise<string[]> {
    const [owned, mandated, orgUnmanaged] = await Promise.all([
      this.prisma.property.findMany({
        where: { ownerId: userId },
        select: { id: true },
        take: 500,
      }),
      this.prisma.mandate.findMany({
        where: {
          ...liveMandateFilter(),
          OR: [
            {
              organization: {
                members: {
                  some: { userId, role: OrgMemberRole.ADMIN },
                },
              },
            },
            { assignedAgentId: userId },
          ],
        },
        select: { propertyId: true },
      }),
      this.prisma.property.findMany({
        where: {
          organization: {
            members: {
              some: {
                userId,
                role: {
                  in: [OrgMemberRole.ADMIN, OrgMemberRole.OWNER],
                },
              },
            },
          },
          NOT: { mandates: { some: liveMandateFilter() } },
        },
        select: { id: true },
        take: 500,
      }),
    ]);

    return [
      ...new Set([
        ...owned.map((p) => p.id),
        ...mandated.map((m) => m.propertyId),
        ...orgUnmanaged.map((p) => p.id),
      ]),
    ];
  }
}
