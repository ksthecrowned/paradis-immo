import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, SaleInquiry, SaleInquiryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AgencyAccessService } from '../mandates/agency-access.service';

export interface CreateInquiryInput {
  propertyId: string;
  userId: string;
  message?: string;
  /** Spec 08 — budget déclaré (XAF) + téléphone de contact E.164. */
  budget?: number | string;
  phone?: string;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

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

    // Spec 08 — anti-doublon : au plus une demande ouverte par (property, user).
    const openStatuses: SaleInquiryStatus[] = [
      SaleInquiryStatus.NEW,
      SaleInquiryStatus.CONTACTED,
      SaleInquiryStatus.VISIT_SCHEDULED,
    ];
    const existing = await this.prisma.saleInquiry.findFirst({
      where: {
        propertyId: input.propertyId,
        userId: input.userId,
        status: { in: openStatuses },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'INQUIRY_ALREADY_OPEN',
        message:
          'Une demande est déjà ouverte pour ce bien — suivez-la depuis « Mes demandes ».',
      });
    }

    const created = await this.prisma.saleInquiry.create({
      data: {
        propertyId: input.propertyId,
        userId: input.userId,
        ...(input.message ? { message: input.message } : {}),
        ...(input.budget !== undefined && input.budget !== null
          ? { budget: new Prisma.Decimal(input.budget) }
          : {}),
        ...(input.phone ? { phone: input.phone } : {}),
      },
    });
    // Spec 08 — le propriétaire est notifié de la nouvelle demande.
    await this.events.emit(DOMAIN_EVENTS.SALE_INQUIRY_CREATED, {
      inquiryId: created.id,
      propertyId: input.propertyId,
      buyerUserId: input.userId,
    });
    return this.toPublic(created);
  }

  async updateInquiryStatus(
    input: UpdateInquiryStatusInput,
  ): Promise<PublicSaleInquiry> {
    const inquiry = await this.prisma.saleInquiry.findUnique({
      where: { id: input.inquiryId },
      select: { propertyId: true },
    });
    if (!inquiry) {      throw new NotFoundException({
        code: 'INQUIRY_NOT_FOUND',
        message: 'Inquiry does not exist',
      });
    }

    // Only the property owner or an agent in the property's organization

    // can mutate the inquiry status. To avoid leaking the existence of an
    // inquiry to unauthorized actors, treat "forbidden" as "not found".
    const allowed = await this.actorManagesProperty(
      input.actorUserId,
      inquiry.propertyId,
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
    // Spec 08 P0 — le périmètre gestionnaire passe par AgencyAccessService
    // (propriétaire, gérant de l'agence mandatée, agent assigné, gérant/owner
    // de l'org d'un bien sans mandat) et non plus la seule appartenance à
    // l'org du bien en tant que AGENT.
    const managedIds = await this.agencyAccess.listOperablePropertyIds(
      actorUserId,
    );
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
   * Same manager perimeter as listInquiriesForManager, through
   * AgencyAccessService: owner, mandated agency (gérant or assigned agent),
   * or org gérant on unmandated properties. Unauthorized actors get a
   * "not found" so the existence of the inquiry never leaks.
   */
  private async actorManagesProperty(
    actorUserId: string,
    propertyId: string,
  ): Promise<boolean> {
    const operable = await this.agencyAccess.listOperablePropertyIds(
      actorUserId,
    );
    return operable.includes(propertyId);
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
