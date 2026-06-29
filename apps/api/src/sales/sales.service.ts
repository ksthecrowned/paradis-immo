import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SaleInquiry, SaleInquiryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateInquiryInput {
  propertyId: string;
  userId: string;
  message?: string;
}

export interface UpdateInquiryStatusInput {
  inquiryId: string;
  actorUserId: string;
  newStatus: SaleInquiryStatus;
}

export interface PublicSaleInquiry {
  id: string;
  propertyId: string;
  userId: string;
  message: string | null;
  status: SaleInquiryStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async createInquiry(input: CreateInquiryInput): Promise<PublicSaleInquiry> {
    const property = await this.prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true, mode: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    if (property.mode !== 'SALE') {
      throw new BadRequestException({
        code: 'PROPERTY_NOT_FOR_SALE',
        message: 'Inquiries are only allowed on properties in SALE mode',
      });
    }

    const created = await this.prisma.saleInquiry.create({
      data: {
        propertyId: input.propertyId,
        userId: input.userId,
        ...(input.message ? { message: input.message } : {}),
      },
    });
    return this.toPublic(created);
  }

  async updateInquiryStatus(
    input: UpdateInquiryStatusInput,
  ): Promise<PublicSaleInquiry> {
    const inquiry = await this.prisma.saleInquiry.findUnique({
      where: { id: input.inquiryId },
      include: {
        property: { select: { ownerId: true, organizationId: true } },
      },
    });
    if (!inquiry) {
      throw new NotFoundException({
        code: 'INQUIRY_NOT_FOUND',
        message: 'Inquiry does not exist',
      });
    }

    // Only the property owner or an agent in the property's organization
    // can mutate the inquiry status. To avoid leaking the existence of an
    // inquiry to unauthorized actors, treat "forbidden" as "not found".
    const allowed = await this.actorManagesProperty(
      input.actorUserId,
      inquiry.property,
    );
    if (!allowed) {
      throw new NotFoundException({
        code: 'INQUIRY_NOT_FOUND',
        message: 'Inquiry does not exist',
      });
    }

    const updated = await this.prisma.saleInquiry.update({
      where: { id: input.inquiryId },
      data: { status: input.newStatus },
    });
    return this.toPublic(updated);
  }

  async listInquiriesForManager(
    actorUserId: string,
  ): Promise<PublicSaleInquiry[]> {
    // The actor manages every property whose ownerId they are, or whose
    // organizationId they belong to with role AGENT.
    const managed = await this.prisma.property.findMany({
      where: {
        OR: [
          { ownerId: actorUserId },
          {
            organization: {
              members: {
                some: { userId: actorUserId, role: 'AGENT' },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    const managedIds = managed.map((p) => p.id);
    if (managedIds.length === 0) return [];

    const rows = await this.prisma.saleInquiry.findMany({
      where: { propertyId: { in: managedIds } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async listInquiriesForBuyer(userId: string): Promise<PublicSaleInquiry[]> {
    const rows = await this.prisma.saleInquiry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  /**
   * Returns true if the actor is the property owner, or an AGENT in the
   * property's organization. Returns false (and the caller treats the
   * inquiry as not found) for anyone else.
   */
  private async actorManagesProperty(
    actorUserId: string,
    property: { ownerId: string; organizationId: string },
  ): Promise<boolean> {
    if (property.ownerId === actorUserId) return true;
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId: actorUserId,
        organizationId: property.organizationId,
        role: 'AGENT',
      },
      select: { id: true },
    });
    return member !== null;
  }

  private toPublic(r: SaleInquiry): PublicSaleInquiry {
    return {
      id: r.id,
      propertyId: r.propertyId,
      userId: r.userId,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
