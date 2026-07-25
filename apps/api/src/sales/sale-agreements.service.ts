import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingStatus,
  Prisma,
  SaleAgreementStatus,
  SaleInstallmentStatus,
} from '@prisma/client';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type {
  CreateSaleAgreementDto,
  SaleInstallmentInputDto,
  UpdateSaleAgreementDto,
} from './dto/create-sale-agreement.dto';

export type PublicSaleInstallment = {
  id: string;
  label: string | null;
  dueDate: string;
  amount: string;
  currency: string;
  status: SaleInstallmentStatus;
  position: number;
};

export type PublicSaleAgreement = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  buyerId: string;
  buyerName: string | null;
  buyerPhone: string | null;
  organizationId: string;
  saleInquiryId: string | null;
  agreedPrice: string;
  currency: string;
  status: SaleAgreementStatus;
  installments: PublicSaleInstallment[];
  activatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class SaleAgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly users: UsersService,
  ) {}

  async create(
    managerUserId: string,
    dto: CreateSaleAgreementDto,
  ): Promise<PublicSaleAgreement> {
    const property = await this.loadOperableSaleProperty(
      managerUserId,
      dto.propertyId,
    );
    this.assertInstallmentsSum(dto.agreedPrice, dto.installments);

    let buyerId: string;
    if (dto.saleInquiryId) {
      const inquiry = await this.prisma.saleInquiry.findUnique({
        where: { id: dto.saleInquiryId },
      });
      if (!inquiry || inquiry.propertyId !== dto.propertyId) {
        throw new BadRequestException({
          code: 'SALE_INQUIRY_INVALID',
          message: 'Demande d’achat introuvable pour ce bien',
        });
      }
      const existing = await this.prisma.saleAgreement.findUnique({
        where: { saleInquiryId: dto.saleInquiryId },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException({
          code: 'SALE_INQUIRY_ALREADY_LINKED',
          message: 'Un dossier existe déjà pour cette demande',
        });
      }
      buyerId = inquiry.userId;
    } else {
      if (!dto.buyerPhone) {
        throw new BadRequestException({
          code: 'BUYER_PHONE_REQUIRED',
          message: 'Le téléphone de l’acheteur est requis',
        });
      }
      const buyer = await this.users.resolveOrCreateByPhone(
        dto.buyerPhone,
        dto.buyerName,
      );
      buyerId = buyer.id;
    }

    const created = await this.prisma.saleAgreement.create({
      data: {
        propertyId: property.id,
        buyerId,
        organizationId: property.organizationId,
        saleInquiryId: dto.saleInquiryId ?? null,
        agreedPrice: new Prisma.Decimal(dto.agreedPrice),
        currency: dto.currency,
        status: SaleAgreementStatus.DRAFT,
        installments: {
          create: dto.installments.map((row, index) => ({
            label: row.label?.trim() || null,
            dueDate: row.dueDate,
            amount: new Prisma.Decimal(row.amount),
            currency: dto.currency,
            position: index,
          })),
        },
      },
      include: this.detailInclude(),
    });

    return this.serialize(created);
  }

  async listManaged(managerUserId: string): Promise<PublicSaleAgreement[]> {
    const propertyIds =
      await this.agencyAccess.listOperablePropertyIds(managerUserId);
    if (propertyIds.length === 0) return [];
    const rows = await this.prisma.saleAgreement.findMany({
      where: { propertyId: { in: propertyIds } },
      orderBy: { createdAt: 'desc' },
      include: this.detailInclude(),
    });
    return rows.map((r) => this.serialize(r));
  }

  async getOne(
    managerUserId: string,
    id: string,
  ): Promise<PublicSaleAgreement> {
    const row = await this.findManagedOrThrow(managerUserId, id);
    return this.serialize(row);
  }

  async updateDraft(
    managerUserId: string,
    id: string,
    dto: UpdateSaleAgreementDto,
  ): Promise<PublicSaleAgreement> {
    const existing = await this.findManagedOrThrow(managerUserId, id);
    if (existing.status !== SaleAgreementStatus.DRAFT) {
      throw new BadRequestException({
        code: 'SALE_AGREEMENT_NOT_DRAFT',
        message: 'Seuls les dossiers brouillon sont modifiables',
      });
    }

    const agreedPrice = dto.agreedPrice ?? Number(existing.agreedPrice);
    const currency = dto.currency ?? existing.currency;
    const installments =
      dto.installments ??
      existing.installments.map((i) => ({
        label: i.label ?? undefined,
        dueDate: i.dueDate,
        amount: Number(i.amount),
      }));
    this.assertInstallmentsSum(agreedPrice, installments);

    await this.prisma.$transaction(async (tx) => {
      await tx.saleInstallment.deleteMany({ where: { agreementId: id } });
      await tx.saleAgreement.update({
        where: { id },
        data: {
          agreedPrice: new Prisma.Decimal(agreedPrice),
          currency,
          installments: {
            create: installments.map((row, index) => ({
              label: row.label?.trim() || null,
              dueDate: row.dueDate,
              amount: new Prisma.Decimal(row.amount),
              currency,
              position: index,
            })),
          },
        },
      });
    });

    return this.getOne(managerUserId, id);
  }

  async activate(
    managerUserId: string,
    id: string,
  ): Promise<PublicSaleAgreement> {
    const existing = await this.findManagedOrThrow(managerUserId, id);
    if (existing.status !== SaleAgreementStatus.DRAFT) {
      throw new BadRequestException({
        code: 'SALE_AGREEMENT_NOT_DRAFT',
        message: 'Seul un brouillon peut être activé',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.saleAgreement.update({
        where: { id },
        data: {
          status: SaleAgreementStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });
      const property = await tx.property.findUniqueOrThrow({
        where: { id: existing.propertyId },
        select: { listingStatus: true },
      });
      if (property.listingStatus !== ListingStatus.SOLD) {
        await tx.property.update({
          where: { id: existing.propertyId },
          data: { listingStatus: ListingStatus.UNDER_OFFER },
        });
      }
      if (existing.saleInquiryId) {
        await tx.saleInquiry.update({
          where: { id: existing.saleInquiryId },
          data: { status: 'CLOSED' },
        });
      }
    });

    return this.getOne(managerUserId, id);
  }

  async complete(
    managerUserId: string,
    id: string,
  ): Promise<PublicSaleAgreement> {
    const existing = await this.findManagedOrThrow(managerUserId, id);
    if (existing.status !== SaleAgreementStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'SALE_AGREEMENT_NOT_ACTIVE',
        message: 'Seul un dossier actif peut être complété',
      });
    }
    await this.prisma.saleAgreement.update({
      where: { id },
      data: {
        status: SaleAgreementStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    return this.getOne(managerUserId, id);
  }

  async cancel(
    managerUserId: string,
    id: string,
  ): Promise<PublicSaleAgreement> {
    const existing = await this.findManagedOrThrow(managerUserId, id);
    if (
      existing.status !== SaleAgreementStatus.DRAFT &&
      existing.status !== SaleAgreementStatus.ACTIVE
    ) {
      throw new BadRequestException({
        code: 'SALE_AGREEMENT_NOT_CANCELLABLE',
        message: 'Ce dossier ne peut plus être annulé',
      });
    }
    await this.prisma.saleAgreement.update({
      where: { id },
      data: { status: SaleAgreementStatus.CANCELLED },
    });
    return this.getOne(managerUserId, id);
  }

  async listMine(buyerUserId: string): Promise<PublicSaleAgreement[]> {
    const rows = await this.prisma.saleAgreement.findMany({
      where: {
        buyerId: buyerUserId,
        status: { in: [SaleAgreementStatus.ACTIVE, SaleAgreementStatus.COMPLETED] },
      },
      orderBy: { createdAt: 'desc' },
      include: this.detailInclude(),
    });
    return rows.map((r) => this.serialize(r));
  }

  async getMine(
    buyerUserId: string,
    id: string,
  ): Promise<PublicSaleAgreement> {
    const row = await this.prisma.saleAgreement.findFirst({
      where: { id, buyerId: buyerUserId },
      include: this.detailInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'SALE_AGREEMENT_NOT_FOUND',
        message: 'Dossier introuvable',
      });
    }
    return this.serialize(row);
  }

  private async loadOperableSaleProperty(
    managerUserId: string,
    propertyId: string,
  ) {
    await this.agencyAccess.assertCanOperateOnProperty(
      managerUserId,
      propertyId,
    );
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, mode: true, organizationId: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Bien introuvable',
      });
    }
    if (property.mode !== 'SALE') {
      throw new BadRequestException({
        code: 'PROPERTY_NOT_FOR_SALE',
        message: 'Les dossiers vente concernent uniquement les biens en vente',
      });
    }
    return property;
  }

  private async findManagedOrThrow(managerUserId: string, id: string) {
    const row = await this.prisma.saleAgreement.findUnique({
      where: { id },
      include: this.detailInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'SALE_AGREEMENT_NOT_FOUND',
        message: 'Dossier introuvable',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(
      managerUserId,
      row.propertyId,
    );
    return row;
  }

  private assertInstallmentsSum(
    agreedPrice: number,
    installments: SaleInstallmentInputDto[],
  ): void {
    const sum = installments.reduce((acc, row) => acc + Number(row.amount), 0);
    if (Math.round(sum) !== Math.round(agreedPrice)) {
      throw new BadRequestException({
        code: 'INSTALLMENTS_SUM_MISMATCH',
        message: 'La somme des paliers doit égaler le prix convenu',
      });
    }
  }

  private detailInclude() {
    return {
      property: { select: { id: true, title: true } },
      buyer: { select: { id: true, name: true, phone: true } },
      installments: { orderBy: { position: 'asc' as const } },
    };
  }

  private serialize(
    row: {
      id: string;
      propertyId: string;
      organizationId: string;
      saleInquiryId: string | null;
      agreedPrice: Prisma.Decimal;
      currency: string;
      status: SaleAgreementStatus;
      activatedAt: Date | null;
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      property: { title: string };
      buyer: { id: string; name: string | null; phone: string | null };
      installments: Array<{
        id: string;
        label: string | null;
        dueDate: Date;
        amount: Prisma.Decimal;
        currency: string;
        status: SaleInstallmentStatus;
        position: number;
      }>;
    },
  ): PublicSaleAgreement {
    const now = Date.now();
    return {
      id: row.id,
      propertyId: row.propertyId,
      propertyTitle: row.property.title,
      buyerId: row.buyer.id,
      buyerName: row.buyer.name,
      buyerPhone: row.buyer.phone,
      organizationId: row.organizationId,
      saleInquiryId: row.saleInquiryId,
      agreedPrice: row.agreedPrice.toString(),
      currency: row.currency,
      status: row.status,
      installments: row.installments.map((i) => {
        let status = i.status;
        if (
          status === SaleInstallmentStatus.PENDING &&
          i.dueDate.getTime() < now
        ) {
          status = SaleInstallmentStatus.OVERDUE;
        }
        return {
          id: i.id,
          label: i.label,
          dueDate: i.dueDate.toISOString(),
          amount: i.amount.toString(),
          currency: i.currency,
          status,
          position: i.position,
        };
      }),
      activatedAt: row.activatedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
