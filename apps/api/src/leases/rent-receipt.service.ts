import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RentScheduleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../media/r2.service';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { renderRentReceiptPdf } from './rent-receipt-pdf';

const R2_QUITTANCE_PREFIX = 'quittances';

export interface PublicRentReceipt {
  id: string;
  number: string;
  rentScheduleId: string;
  issuerOrgId: string;
  fileKey: string;
  issuedAt: string;
}

/**
 * Spec 04 — quittances de loyer.
 *
 * A quittance is issued **only** once the rent schedule line is fully paid
 * (never on a PARTIAL line) and carries a strictly sequential, per-organization
 * yearly number: `Q-{ORG}-{AAAA}-{000001}`.
 */
@Injectable()
export class RentReceiptService {
  private readonly logger = new Logger(RentReceiptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly sequences: DocumentSequenceService,
  ) {}

  /**
   * Issue the quittance for a fully-paid schedule. Idempotent on
   * `rentScheduleId` (unique constraint).
   */
  async issueForRentSchedule(rentScheduleId: string): Promise<PublicRentReceipt> {
    const schedule = await this.prisma.rentSchedule.findUnique({
      where: { id: rentScheduleId },
      include: {
        receipt: true,
        lease: {
          include: {
            tenant: { select: { name: true, phone: true } },
            property: {
              select: {
                address: true,
                ownerId: true,
                organizationId: true,
                organization: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!schedule) {
      throw new NotFoundException({
        code: 'RENT_SCHEDULE_NOT_FOUND',
        message: 'Rent schedule does not exist',
      });
    }
    if (schedule.receipt) return this.toPublic(schedule.receipt);

    const paid = await this.paidAmount(schedule.id);
    if (schedule.status !== RentScheduleStatus.PAID) {
      throw new BadRequestException({
        code: 'RENT_SCHEDULE_NOT_PAID',
        message: `A quittance is only issued for a settled schedule (status: ${schedule.status})`,
      });
    }
    if (paid.lt(schedule.amount)) {
      throw new BadRequestException({
        code: 'RENT_SCHEDULE_NOT_PAID',
        message: `Allocated ${paid.toString()} of ${schedule.amount.toString()}`,
      });
    }

    const issuerOrgId = schedule.lease.property.organizationId;
    const issuedAt = new Date();
    const landlord = await this.prisma.user.findUnique({
      where: { id: schedule.lease.property.ownerId },
      select: { name: true, phone: true },
    });

    // Reserve the number and persist the row in one transaction so concurrent
    // issuances can never share a number, and the PDF key is stable.
    const created = await this.prisma.$transaction(async (tx) => {
      const number = await this.sequences.nextNumber(tx, {
        organizationId: issuerOrgId,
        kind: 'QUITTANCE',
        prefix: 'Q',
        at: issuedAt,
      });
      return tx.rentReceipt.create({
        data: {
          number,
          rentScheduleId: schedule.id,
          issuerOrgId,
          fileKey: `${R2_QUITTANCE_PREFIX}/${schedule.leaseId}/${schedule.id}/${number}.pdf`,
          issuedAt,
        },
      });
    });

    try {
      const buffer = await renderRentReceiptPdf({
        number: created.number,
        issuedAt,
        periodStart: schedule.periodStart ?? schedule.dueDate,
        periodEnd: schedule.periodEnd ?? schedule.dueDate,
        rentAmount: schedule.rentPart.toString(),
        chargesAmount: schedule.chargesPart.toString(),
        totalAmount: schedule.amount.toString(),
        currency: schedule.currency,
        tenantName:
          schedule.lease.tenant?.name ??
          schedule.lease.tenant?.phone ??
          schedule.lease.invitedPhone ??
          '—',
        landlordName: landlord?.name ?? landlord?.phone ?? '—',
        agencyName: schedule.lease.property.organization.name,
        propertyAddress: schedule.lease.property.address,
      });
      await this.r2.uploadBuffer(
        created.fileKey,
        buffer,
        'application/pdf',
      );
    } catch (err) {
      // The document row stays: a retry re-uses the same number and re-renders
      // the PDF instead of burning a sequence value.
      this.logger.error(
        `Quittance ${created.number} rendered but upload failed: ${String(err)}`,
      );
    }

    this.logger.log(`Issued quittance ${created.number}`);
    return this.toPublic(created);
  }

  async listForLease(leaseId: string): Promise<PublicRentReceipt[]> {
    const rows = await this.prisma.rentReceipt.findMany({
      where: { rentSchedule: { leaseId } },
      orderBy: { issuedAt: 'asc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  /** URL of the quittance for a schedule; 404 when not issued yet. */
  async getUrlForSchedule(rentScheduleId: string): Promise<string> {
    const receipt = await this.prisma.rentReceipt.findUnique({
      where: { rentScheduleId },
    });
    if (!receipt) {
      throw new NotFoundException({
        code: 'QUITTANCE_NOT_FOUND',
        message:
          'No quittance yet — it is issued once the schedule is fully paid',
      });
    }
    return this.r2.createPresignedDownload(receipt.fileKey);
  }

  /** Assert the caller may read this schedule's quittance. */
  async assertCanReadSchedule(
    userId: string,
    rentScheduleId: string,
    canOperate: (userId: string, propertyId: string) => Promise<void>,
  ): Promise<{ leaseId: string; tenantId: string | null; propertyId: string }> {
    const schedule = await this.prisma.rentSchedule.findUnique({
      where: { id: rentScheduleId },
      include: {
        lease: {
          select: { id: true, tenantId: true, propertyId: true },
        },
      },
    });
    if (!schedule) {
      throw new NotFoundException({
        code: 'RENT_SCHEDULE_NOT_FOUND',
        message: 'Rent schedule does not exist',
      });
    }
    if (schedule.lease.tenantId !== userId) {
      await canOperate(userId, schedule.lease.propertyId);
    }
    return {
      leaseId: schedule.lease.id,
      tenantId: schedule.lease.tenantId,
      propertyId: schedule.lease.propertyId,
    };
  }

  async listForUser(userId: string): Promise<PublicRentReceipt[]> {
    const rows = await this.prisma.rentReceipt.findMany({
      where: { rentSchedule: { lease: { tenantId: userId } } },
      orderBy: { issuedAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  private async paidAmount(rentScheduleId: string): Promise<Prisma.Decimal> {
    const agg = await this.prisma.paymentAllocation.aggregate({
      where: { rentScheduleId },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? new Prisma.Decimal(0);
  }

  private toPublic(receipt: {
    id: string;
    number: string;
    rentScheduleId: string;
    issuerOrgId: string;
    fileKey: string;
    issuedAt: Date;
  }): PublicRentReceipt {
    return {
      id: receipt.id,
      number: receipt.number,
      rentScheduleId: receipt.rentScheduleId,
      issuerOrgId: receipt.issuerOrgId,
      fileKey: receipt.fileKey,
      issuedAt: receipt.issuedAt.toISOString(),
    };
  }
}