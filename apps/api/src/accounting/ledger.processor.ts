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
      const ownerId = mandate.property.ownerId;
      if (!ownerId) continue;
      try {
        const statement = await this.accounting.generateStatement(ownerId, {
          mandateId: mandate.id,
          periodStart,
          periodEnd,
        });
        await this.notifications.send({
          userId: ownerId,
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

  /**
   * Living mandate covering a property (ACTIVE, or TERMINATING during its
   * notice period) — only those produce agency fees.
   */
  private async liveMandateForProperty(
    tx: Prisma.TransactionClient,
    propertyId: string,
  ) {
    return tx.mandate.findFirst({
      where: {
        propertyId,
        OR: [
          { status: 'ACTIVE' },
          { status: 'TERMINATING', terminationEffectiveAt: { gt: new Date() } },
        ],
      },
      select: {
        id: true,
        organizationId: true,
        managementFeeRate: true,
      },
    });
  }

  /**
   * Public for direct invocation from tests.
   *
   * Spec 03 — one immutable line per property and per source event: the
   * allocations of a single payment that target the same property (e.g. two
   * rents paid at once) are summed into a single `RENT_IN`/`DEPOSIT_IN` and a
   * single `FEE`, which keeps `(sourceType, sourceId, type, propertyId)`
   * unique. The payment row is locked for the whole transaction, so a
   * concurrent delivery of the same event (double webhook, replay) cannot
   * interleave its `findFirst` with our `create`.
   */
  async recordPayment(paymentId: string): Promise<{ entries: number }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;

      const payment = await tx.payment.findUnique({
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

      // A deposit (caution) is its own ledger line; only rents bear the fee.
      const groups = new Map<
        string,
        {
          incomeType: 'RENT_IN' | 'DEPOSIT_IN';
          propertyId: string;
          organizationId: string;
          title: string;
          amount: Prisma.Decimal;
        }
      >();
      for (const allocation of payment.allocations) {
        const property = allocation.rentSchedule?.lease?.property;
        if (!property) continue;
        const incomeType =
          allocation.rentSchedule?.kind === 'DEPOSIT'
            ? 'DEPOSIT_IN'
            : 'RENT_IN';
        const key = `${property.id}:${incomeType}`;
        const group = groups.get(key);
        if (group) {
          group.amount = group.amount.add(allocation.amount);
        } else {
          groups.set(key, {
            incomeType,
            propertyId: property.id,
            organizationId: property.organizationId,
            title: property.title,
            amount: new Prisma.Decimal(allocation.amount),
          });
        }
      }

      const source = { sourceType: 'PAYMENT', sourceId: paymentId };
      const occurredAt = new Date();
      let written = 0;
      for (const group of groups.values()) {
        const mandate = await this.liveMandateForProperty(tx, group.propertyId);
        const existingIncome = await tx.ledgerEntry.findFirst({
          where: {
            ...source,
            type: group.incomeType,
            propertyId: group.propertyId,
          },
          select: { id: true },
        });
        if (!existingIncome) {
          await tx.ledgerEntry.create({
            data: {
              propertyId: group.propertyId,
              mandateId: mandate?.id ?? null,
              ownerOrgId: group.organizationId,
              agencyOrgId: mandate?.organizationId ?? null,
              type: group.incomeType,
              amount: group.amount,
              currency: payment.currency,
              sourceType: 'PAYMENT',
              sourceId: paymentId,
              label:
                group.incomeType === 'DEPOSIT_IN'
                  ? `Caution encaissée — ${group.title}`
                  : `Loyer encaissé — ${group.title}`,
              occurredAt,
            },
          });
          written += 1;
        }

        if (group.incomeType === 'RENT_IN' && mandate?.managementFeeRate) {
          const rate = new Prisma.Decimal(mandate.managementFeeRate);
          const fee = group.amount.mul(rate).toDecimalPlaces(2);
          if (fee.gt(0)) {
            const existingFee = await tx.ledgerEntry.findFirst({
              where: { ...source, type: 'FEE', propertyId: group.propertyId },
              select: { id: true },
            });
            if (!existingFee) {
              await tx.ledgerEntry.create({
                data: {
                  propertyId: group.propertyId,
                  mandateId: mandate.id,
                  ownerOrgId: group.organizationId,
                  agencyOrgId: mandate.organizationId,
                  type: 'FEE',
                  amount: fee.neg(),
                  currency: payment.currency,
                  sourceType: 'PAYMENT',
                  sourceId: paymentId,
                  label: `Honoraires de gestion (${rate.mul(100).toNumber()} %)`,
                  occurredAt,
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
    });
  }

  /**
   * Public for direct invocation from tests. Same locking strategy as
   * `recordPayment`: the expense row serialises concurrent deliveries of
   * `EXPENSE_APPROVED`.
   */
  async recordExpense(expenseId: string): Promise<{ entries: number }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Expense" WHERE id = ${expenseId} FOR UPDATE`;

      const expense = await tx.expense.findUnique({
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

      const existing = await tx.ledgerEntry.findFirst({
        where: {
          sourceType: 'EXPENSE',
          sourceId: expenseId,
          type: 'EXPENSE',
        },
        select: { id: true },
      });
      if (existing) return { entries: 0 };

      const mandate = expense.mandateId
        ? await tx.mandate.findUnique({
            where: { id: expense.mandateId },
            select: { organizationId: true },
          })
        : null;

      await tx.ledgerEntry.create({
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
    });
  }
}
