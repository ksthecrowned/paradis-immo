import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { AllocatableType, Payment, PaymentAllocation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { R2Service } from '../../media/r2.service';
import { DocumentSequenceService } from '../../documents/document-sequence.service';
import { renderReceiptPdf } from './receipt-pdf';

const R2_RECEIPT_PREFIX = 'receipts';

export interface GenerateForPaymentResult {
  receiptId: string;
  url: string;
  number: string;
}

export interface PublicReceipt {
  id: string;
  paymentId: string;
  number: string;
  url: string;
  createdAt: string;
}

/**
 * Owns the Receipt lifecycle: render PDF, upload to R2, persist Receipt row.
 *
 * Idempotent on `paymentId` — the Receipt model has a `@@unique` constraint
 * on `paymentId`, so re-running for the same payment returns the existing
 * receipt instead of creating a duplicate.
 */
@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly sequences: DocumentSequenceService,
  ) {}

  async generateForPayment(
    paymentId: string,
  ): Promise<GenerateForPaymentResult> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true, allocations: true },
    });
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    const existing = await this.prisma.receipt.findUnique({
      where: { paymentId },
    });
    if (existing) {
      this.logger.log(`Receipt already exists for payment ${paymentId}`);
      return {
        receiptId: existing.id,
        url: existing.url,
        number: existing.number,
      };
    }

    const propertyTitle = await this.resolvePropertyTitle(payment);

    // Spec 04 — sequential per-org payment receipt `R-{ORG}-{AAAA}-{000001}`.
    // When the payment cannot be traced to a property (no allocation yet) we
    // fall back to a dedicated platform sequence so numbers stay unique.
    const issuerOrgId = await this.resolveIssuerOrgId(payment);
    const { number } = await this.prisma.$transaction(async (tx) => {
      const reserved = await this.sequences.nextNumber(tx, {
        organizationId: issuerOrgId,
        kind: 'RECEIPT',
        prefix: 'R',
        at: payment.validatedAt ?? payment.createdAt,
      });
      const row = await tx.receipt.create({
        data: {
          paymentId,
          url: '',
          number: reserved,
          issuerOrgId,
        },
      });
      return { number: row.number };
    });

    const buffer = await renderReceiptPdf({
      number,
      issuedAt: payment.validatedAt ?? payment.createdAt,
      tenantName: payment.user.name ?? payment.user.phone ?? '—',
      amount: payment.amount.toString(),
      currency: payment.currency,
      method: payment.method,
      propertyTitle,
      paymentReference: payment.reference,
    });

    const key = `${R2_RECEIPT_PREFIX}/${paymentId}/${number}.pdf`;
    const { url } = await this.uploadToR2(key, buffer);

    const created = await this.prisma.receipt.update({
      where: { paymentId },
      data: { url },
    });

    this.logger.log(
      `Generated receipt ${created.number} (${buffer.length} bytes) → ${url}`,
    );
    return {
      receiptId: created.id,
      url: created.url,
      number: created.number,
    };
  }

  async findById(receiptId: string) {
    return this.prisma.receipt.findUnique({
      where: { id: receiptId },
      include: { payment: true },
    });
  }

  async findByIdForUser(
    receiptId: string,
    userId: string,
  ): Promise<PublicReceipt | null> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        payment: {
          include: {
            user: { select: { id: true } },
            allocations: {
              take: 1,
              where: { type: 'RENT_SCHEDULE' },
              include: {
                rentSchedule: {
                  include: {
                    lease: {
                      select: {
                        property: {
                          select: { ownerId: true, organizationId: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!receipt) return null;

    const payment = receipt.payment;
    // 1. Payer can always read their own receipt
    if (payment.userId === userId) return this.toPublic(receipt);

    // 2. Property owner or org member of any lease-allocation can read
    for (const alloc of payment.allocations) {
      const property = alloc.rentSchedule?.lease?.property;
      if (!property) continue;
      if (property.ownerId === userId) return this.toPublic(receipt);
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: property.organizationId,
          },
        },
      });
      if (membership) return this.toPublic(receipt);
    }

    throw new ForbiddenException({
      code: 'NOT_RECEIPT_OWNER',
      message: 'You are not authorized to read this receipt',
    });
  }

  async findByPaymentIdForUser(
    paymentId: string,
    userId: string,
  ): Promise<PublicReceipt | null> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { paymentId },
      include: {
        payment: {
          include: {
            user: { select: { id: true } },
            allocations: {
              take: 1,
              where: { type: 'RENT_SCHEDULE' },
              include: {
                rentSchedule: {
                  include: {
                    lease: {
                      select: {
                        property: {
                          select: { ownerId: true, organizationId: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!receipt) return null;
    return this.findByIdForUser(receipt.id, userId);
  }

  private toPublic(receipt: {
    id: string;
    paymentId: string;
    number: string;
    url: string;
    createdAt: Date;
  }): PublicReceipt {
    return {
      id: receipt.id,
      paymentId: receipt.paymentId,
      number: receipt.number,
      url: receipt.url,
      createdAt: receipt.createdAt.toISOString(),
    };
  }

  /**
   * Org issuing the receipt: the property's managing organization when the
   * payment is allocated to a rent schedule, otherwise a stable platform
   * sequence keyed by the payer.
   */
  private async resolveIssuerOrgId(
    payment: Payment & { allocations: PaymentAllocation[] },
  ): Promise<string> {
    const rentAllocation = payment.allocations.find(
      (a) => a.type === AllocatableType.RENT_SCHEDULE && a.rentScheduleId,
    );
    if (rentAllocation?.rentScheduleId) {
      const schedule = await this.prisma.rentSchedule.findUnique({
        where: { id: rentAllocation.rentScheduleId },
        select: { lease: { select: { property: { select: { organizationId: true } } } } },
      });
      const orgId = schedule?.lease.property.organizationId;
      if (orgId) return orgId;
    }
    // No property yet: number under a per-payer pseudo-org so the sequence is
    // still strictly consecutive and unique.
    return `payer-${payment.userId}`;
  }

  private async resolvePropertyTitle(payment: {
    allocations: { rentScheduleId?: string | null }[];
  }): Promise<string> {
    const scheduleId = payment.allocations.find(
      (a) => a.rentScheduleId,
    )?.rentScheduleId;
    if (!scheduleId) return '—';
    const schedule = await this.prisma.rentSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        lease: { include: { property: { select: { title: true } } } },
      },
    });
    return schedule?.lease.property.title ?? '—';
  }

  private async uploadToR2(
    key: string,
    body: Buffer,
  ): Promise<{ url: string }> {
    const result = await this.r2.uploadBuffer(key, body, 'application/pdf');
    return { url: result.url };
  }
}
