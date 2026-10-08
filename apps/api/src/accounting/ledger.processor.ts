import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../events/event.types';
import type { DomainEvent } from '../events/event.types';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountingService } from './accounting.service';

/**
 * Spec 03 — grand livre (LedgerEntry) :
 * - un loyer validé sous mandat écrit `RENT_IN` (+100 %) et, si le mandat
 *   définit un taux de gestion, `FEE` (−rate %) ;
 * - la caution (échéance `DEPOSIT`) écrit `DEPOSIT_IN`, sans honoraires ;
 * - une dépense approuvée écrit `EXPENSE` (−montant).
 * Écritures idempotentes par (sourceType, sourceId, type).
 */
@Injectable()
export class LedgerProcessor {
  private readonly logger = new Logger(LedgerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.PAYMENT_VALIDATED)
  async handlePaymentValidated(
    event: DomainEvent<{ paymentId: string }>,
  ): Promise<{ entries: number }> {
    if (!event.payload.paymentId) return { entries: 0 };
    return this.recordPayment(event.payload.paymentId);
  }

  @OnEvent(DOMAIN_EVENTS.EXPENSE_APPROVED)
  async handleExpenseApproved(
    event: DomainEvent<{ expenseId: string }>,
  ): Promise<{ entries: number }> {
    if (!event.payload.expenseId) return { entries: 0 };
    return this.recordExpense(event.payload.expenseId);
  }

  /**
   * Spec 03 US 13 — on the 5th of each month, a statement PDF is generated
   * for every active mandate covering the previous month and pushed to the
   * owner.
   */
  @Cron('0 8 5 * *', { timeZone: 'Africa/Brazzaville' })
  async generateMonthlyStatements(): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    const mandates = await this.prisma.mandate.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, property: { select: { ownerId: true } } },
    });
    for (const mandate of mandates) {
      const entries = await this.prisma.ledgerEntry.count({
        where: {
          mandateId: mandate.id,
          occurredAt: { gte: periodStart, lt: periodEnd },
        },
      });
      if (entries === 0) continue;
      try {
        const statement = await this.accounting.generateStatement(
          mandate.property.ownerId,
          { mandateId: mandate.id, periodStart, periodEnd },
        );
        await this.notifications.send({
          userId: mandate.property.ownerId,
          type: 'STATEMENT_READY',
          payload: {
            statementId: statement.id,
            mandateId: mandate.id,
            url: statement.url,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Relevé mensuel impossible pour le mandat ${mandate.id}: ${String(error)}`,
        );
      }
    }
  }

  /** Public for direct invocation from tests. */
  async recordPayment(paymentId: string): Promise<{ entries: number }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        currency: true,
        allocations: {
          where: { type: 'RENT_SCHEDULE' },
          select: {
            amount: true,
            rentSchedule: {
              select: {
                kind: true,
                lease: {
                  select: {
                    property: {
                      select: { id: true, organizationId: true, title: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!payment) return { entries: 0 };

    let written = 0;
    for (const allocation of payment.allocations) {
      const property = allocation.rentSchedule?.lease?.property;
      if (!property) continue;

      // Only properties under a living mandate produce agency fees.
      const mandate = await this.prisma.mandate.findFirst({
        where: {
          propertyId: property.id,
          OR: [
            { status: 'ACTIVE' },
            { status: 'TERMINATING', terminationEffectiveAt: { gt: new Date() } },
          ],
        },
      });

      const amount = new Prisma.Decimal(allocation.amount);
      // Spec 04 — the deposit (caution) is its own ledger line; only rents
      // bear the management fee.
      const isDeposit = allocation.rentSchedule?.kind === 'DEPOSIT';
      const incomeType = isDeposit ? 'DEPOSIT_IN' : 'RENT_IN';
      const incomeKey = { sourceType: 'PAYMENT', sourceId: paymentId };
      const existingRent = await this.prisma.ledgerEntry.findFirst({
        where: { ...incomeKey, type: incomeType, propertyId: property.id },
        select: { id: true },
      });
      if (!existingRent) {
        await this.prisma.ledgerEntry.create({
          data: {
            propertyId: property.id,
            mandateId: mandate?.id ?? null,
            ownerOrgId: property.organizationId,
            agencyOrgId: mandate?.organizationId ?? null,
            type: incomeType,
            amount,
            currency: payment.currency,
            sourceType: 'PAYMENT',
            sourceId: paymentId,
            label: isDeposit
              ? `Caution encaissée — ${property.title}`
              : `Loyer encaissé — ${property.title}`,
            occurredAt: new Date(),
          },
        });
        written += 1;
      }

      if (mandate?.managementFeeRate && !isDeposit) {
        const rate = new Prisma.Decimal(mandate.managementFeeRate);
        const fee = amount.mul(rate).toDecimalPlaces(2);
        if (fee.gt(0)) {
          const existingFee = await this.prisma.ledgerEntry.findFirst({
            where: { ...incomeKey, type: 'FEE', propertyId: property.id },
            select: { id: true },
          });
          if (!existingFee) {
            await this.prisma.ledgerEntry.create({
              data: {
                propertyId: property.id,
                mandateId: mandate.id,
                ownerOrgId: property.organizationId,
                agencyOrgId: mandate.organizationId,
                type: 'FEE',
                amount: fee.neg(),
                currency: payment.currency,
                sourceType: 'PAYMENT',
                sourceId: paymentId,
                label: `Honoraires de gestion (${rate.mul(100).toNumber()} %)`,
                occurredAt: new Date(),
              },
            });
            written += 1;
          }
        }
      }
    }
    this.logger.log(
      `Ledger: ${written} entrée(s) pour le paiement ${paymentId}`,
    );
    return { entries: written };
  }

  /** Public for direct invocation from tests. */
  async recordExpense(expenseId: string): Promise<{ entries: number }> {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      select: {
        id: true,
        propertyId: true,
        mandateId: true,
        amount: true,
        currency: true,
        label: true,
        incurredAt: true,
        property: { select: { organizationId: true, title: true } },
      },
    });
    if (!expense) return { entries: 0 };

    const existing = await this.prisma.ledgerEntry.findFirst({
      where: { sourceType: 'EXPENSE', sourceId: expenseId, type: 'EXPENSE' },
      select: { id: true },
    });
    if (existing) return { entries: 0 };

    const mandate = expense.mandateId
      ? await this.prisma.mandate.findUnique({
          where: { id: expense.mandateId },
          select: { organizationId: true },
        })
      : null;

    await this.prisma.ledgerEntry.create({
      data: {
        propertyId: expense.propertyId,
        mandateId: expense.mandateId,
        ownerOrgId: expense.property.organizationId,
        agencyOrgId: mandate?.organizationId ?? null,
        type: 'EXPENSE',
        amount: new Prisma.Decimal(expense.amount).neg(),
        currency: expense.currency,
        sourceType: 'EXPENSE',
        sourceId: expenseId,
        label: `Dépense validée — ${expense.label}`,
        occurredAt: expense.incurredAt,
      },
    });
    return { entries: 1 };
  }
}
