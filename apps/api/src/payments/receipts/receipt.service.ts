import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { R2Service } from '../../media/r2.service';
import { renderReceiptPdf } from './receipt-pdf';

const R2_RECEIPT_PREFIX = 'receipts';

export interface GenerateForPaymentResult {
  receiptId: string;
  url: string;
  number: string;
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

    const number = `REC-${payment.reference.slice(-8).toUpperCase()}-${Date.now().toString(36)}`;

    const buffer = await renderReceiptPdf({
      number,
      issuedAt: payment.validatedAt ?? payment.createdAt,
      tenantName: payment.user.name ?? payment.user.phone,
      amount: payment.amount.toString(),
      currency: payment.currency,
      method: payment.method,
      propertyTitle,
      paymentReference: payment.reference,
    });

    const key = `${R2_RECEIPT_PREFIX}/${paymentId}/${number}.pdf`;
    const { url } = await this.uploadToR2(key, buffer);

    const created = await this.prisma.receipt.create({
      data: {
        paymentId,
        url,
        number,
      },
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
