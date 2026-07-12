import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MandateStatus, OrgMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
      where: { propertyId, status: MandateStatus.ACTIVE },
      select: {
        organizationId: true,
        assignedAgentId: true,
      },
    });
    if (!mandate) return false;

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
}
