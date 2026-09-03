import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BuyerPaymentProofStatus, PaymentStatus, Prisma } from '@prisma/client';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';

export type BuyerPaymentProofSnapshotItem = {
  kind: 'RENT' | 'SALE_INSTALLMENT';
  dueDate: string;
  paidAt: string;
  amount: string;
  currency: string;
  daysLate: number;
};

export type PublicBuyerPaymentProof = {
  id: string;
  saleAgreementId: string;
  buyerUserId: string;
  requesterOrgId: string;
  organizationName: string;
  status: BuyerPaymentProofStatus;
  snapshot: BuyerPaymentProofSnapshotItem[] | null;
  respondedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

const ACCESS_DAYS = 7;
const MS_PER_DAY = 86_400_000;

@Injectable()
export class BuyerPaymentProofsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly events: EventPublisher,
  ) {}

  async create(managerUserId: string, saleAgreementId: string): Promise<PublicBuyerPaymentProof> {
    const agreement = await this.loadOperableAgreement(managerUserId, saleAgreementId);
    if (agreement.status === 'CANCELLED') {
      throw new BadRequestException({ code: 'AGREEMENT_CANCELLED', message: 'Ce dossier est annulé' });
    }
    if ((await this.countPaidPayments(agreement.buyerId)) < 1) {
      throw new BadRequestException({
        code: 'NO_PAID_PAYMENTS',
        message: 'Cet acheteur n’a aucun paiement payé sur la plateforme',
      });
    }
    const pending = await this.prisma.buyerPaymentProof.findFirst({
      where: { saleAgreementId, status: BuyerPaymentProofStatus.PENDING },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException({
        code: 'PENDING_EXISTS',
        message: 'Une demande de preuve de paiements est déjà en attente',
      });
    }
    let row;
    try {
      row = await this.prisma.buyerPaymentProof.create({
        data: {
          saleAgreementId,
          buyerUserId: agreement.buyerId,
          requesterUserId: managerUserId,
          requesterOrgId: agreement.organizationId,
          status: BuyerPaymentProofStatus.PENDING,
        },
        include: { organization: { select: { name: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'PENDING_EXISTS',
          message: 'Une demande de preuve de paiements est déjà en attente',
        });
      }
      throw error;
    }
    await this.events.emit(DOMAIN_EVENTS.BUYER_PAYMENT_PROOF_REQUESTED, {
      proofId: row.id,
      buyerUserId: row.buyerUserId,
      saleAgreementId: row.saleAgreementId,
      requesterOrgId: row.requesterOrgId,
      organizationName: agreement.organization.name,
    });
    return this.serialize(row, { includeSnapshot: false });
  }

  async respond(buyerUserId: string, proofId: string, accept: boolean): Promise<PublicBuyerPaymentProof> {
    const row = await this.prisma.buyerPaymentProof.findUnique({
      where: { id: proofId },
      include: { organization: { select: { name: true } } },
    });
    if (!row || row.buyerUserId !== buyerUserId) {
      throw new NotFoundException({ code: 'BUYER_PAYMENT_PROOF_NOT_FOUND', message: 'Demande introuvable' });
    }
    if (row.status !== BuyerPaymentProofStatus.PENDING) {
      throw new BadRequestException({
        code: 'PROOF_NOT_PENDING',
        message: 'Cette demande a déjà été traitée',
      });
    }
    const now = new Date();
    const status = accept ? BuyerPaymentProofStatus.GRANTED : BuyerPaymentProofStatus.DENIED;
    const snapshot = accept ? await this.buildSnapshot(buyerUserId) : undefined;
    const transition = await this.prisma.buyerPaymentProof.updateMany({
      where: { id: proofId, status: BuyerPaymentProofStatus.PENDING },
      data: {
        status,
        snapshot: accept ? (snapshot as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        respondedAt: now,
        expiresAt: accept ? new Date(now.getTime() + ACCESS_DAYS * MS_PER_DAY) : null,
      },
    });
    if (transition.count === 0) {
      throw new BadRequestException({
        code: 'PROOF_NOT_PENDING',
        message: 'Cette demande a déjà été traitée',
      });
    }
    const updated = await this.prisma.buyerPaymentProof.findUnique({
      where: { id: proofId },
      include: { organization: { select: { name: true } } },
    });
    if (!updated) {
      throw new NotFoundException({ code: 'BUYER_PAYMENT_PROOF_NOT_FOUND', message: 'Demande introuvable' });
    }
    return this.serialize(updated, { includeSnapshot: accept });
  }

  async latestForAgreement(managerUserId: string, saleAgreementId: string): Promise<PublicBuyerPaymentProof | null> {
    await this.loadOperableAgreement(managerUserId, saleAgreementId);
    let row = await this.prisma.buyerPaymentProof.findFirst({
      where: { saleAgreementId },
      orderBy: { createdAt: 'desc' },
      include: { organization: { select: { name: true } } },
    });
    if (!row) return null;
    row = await this.expireIfNeeded(row);
    return this.serialize(row, {
      includeSnapshot:
        row.status === BuyerPaymentProofStatus.GRANTED &&
        !!row.expiresAt &&
        row.expiresAt.getTime() >= Date.now(),
    });
  }

  async listForBuyer(buyerUserId: string): Promise<PublicBuyerPaymentProof[]> {
    const rows = await this.prisma.buyerPaymentProof.findMany({
      where: { buyerUserId },
      orderBy: { createdAt: 'desc' },
      include: { organization: { select: { name: true } } },
    });
    return [
      ...rows.filter((row) => row.status === BuyerPaymentProofStatus.PENDING),
      ...rows.filter((row) => row.status !== BuyerPaymentProofStatus.PENDING),
    ].map((row) => this.serialize(row, { includeSnapshot: false }));
  }

  private async loadOperableAgreement(managerUserId: string, saleAgreementId: string) {
    const agreement = await this.prisma.saleAgreement.findUnique({
      where: { id: saleAgreementId },
      include: { organization: { select: { id: true, name: true } } },
    });
    if (!agreement) {
      throw new NotFoundException({ code: 'SALE_AGREEMENT_NOT_FOUND', message: 'Dossier introuvable' });
    }
    await this.agencyAccess.assertCanOperateOnProperty(managerUserId, agreement.propertyId);
    return agreement;
  }

  private async countPaidPayments(buyerUserId: string): Promise<number> {
    const [rents, installments] = await Promise.all([
      this.prisma.rentSchedule.count({ where: { status: 'PAID', lease: { tenantId: buyerUserId } } }),
      this.prisma.saleInstallment.count({ where: { status: 'PAID', agreement: { buyerId: buyerUserId } } }),
    ]);
    return rents + installments;
  }

  async buildSnapshot(buyerUserId: string): Promise<BuyerPaymentProofSnapshotItem[]> {
    const [rents, installments] = await Promise.all([
      this.prisma.rentSchedule.findMany({
        where: { status: 'PAID', lease: { tenantId: buyerUserId } },
        orderBy: { dueDate: 'desc' },
        take: 10,
        include: { payments: { include: { payment: { select: { status: true, validatedAt: true } } } } },
      }),
      this.prisma.saleInstallment.findMany({
        where: { status: 'PAID', agreement: { buyerId: buyerUserId } },
        orderBy: { dueDate: 'desc' },
        take: 10,
      }),
    ]);
    const rentItems = rents.map((item) => {
      const validated = item.payments.find((a) => a.payment.status === PaymentStatus.VALIDATED);
      return this.snapshotItem('RENT', item.dueDate, item.amount, item.currency, validated?.payment.validatedAt ?? item.createdAt);
    });
    const installmentItems = await Promise.all(installments.map(async (item) => {
      const allocation = await this.prisma.paymentAllocation.findFirst({
        where: { type: 'SALE_INSTALLMENT', refId: item.id, payment: { status: PaymentStatus.VALIDATED } },
        orderBy: { createdAt: 'desc' },
        include: { payment: { select: { validatedAt: true } } },
      });
      return this.snapshotItem('SALE_INSTALLMENT', item.dueDate, item.amount, item.currency, allocation?.payment.validatedAt ?? item.createdAt);
    }));
    return [...rentItems, ...installmentItems].sort((a, b) => b.dueDate.localeCompare(a.dueDate)).slice(0, 3);
  }

  private snapshotItem(
    kind: 'RENT' | 'SALE_INSTALLMENT',
    dueDate: Date,
    amount: Prisma.Decimal,
    currency: string,
    paidAt: Date,
  ): BuyerPaymentProofSnapshotItem {
    const due = startOfUtcDay(dueDate);
    const paid = startOfUtcDay(paidAt);
    return {
      kind,
      dueDate: dueDate.toISOString().slice(0, 10),
      paidAt: paidAt.toISOString(),
      amount: amount.toString(),
      currency,
      daysLate: Math.max(0, Math.floor((paid.getTime() - due.getTime()) / MS_PER_DAY)),
    };
  }

  private async expireIfNeeded<T extends { id: string; status: BuyerPaymentProofStatus; expiresAt: Date | null }>(row: T): Promise<T> {
    if (row.status === BuyerPaymentProofStatus.GRANTED && row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      return await this.prisma.buyerPaymentProof.update({
        where: { id: row.id },
        data: { status: BuyerPaymentProofStatus.EXPIRED },
        include: { organization: { select: { name: true } } },
      }) as unknown as T;
    }
    return row;
  }

  private serialize(row: any, opts: { includeSnapshot: boolean }): PublicBuyerPaymentProof {
    return {
      id: row.id,
      saleAgreementId: row.saleAgreementId,
      buyerUserId: row.buyerUserId,
      requesterOrgId: row.requesterOrgId,
      organizationName: row.organization.name,
      status: row.status,
      snapshot: opts.includeSnapshot && row.snapshot ? row.snapshot as BuyerPaymentProofSnapshotItem[] : null,
      respondedAt: row.respondedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
