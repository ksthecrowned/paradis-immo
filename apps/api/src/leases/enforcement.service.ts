import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  LeaseDocumentType,
  LeaseStatus,
  Prisma,
  RentScheduleKind,
  RentScheduleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { R2Service } from '../media/r2.service';
import { ArrearsService } from './arrears.service';
import { renderFormalNoticePdf } from './formal-notice-pdf';

const DAY_MS = 86_400_000;

/** Spec 04 US 20 — a formal notice is due once rent is 15 days late. */
export const FORMAL_NOTICE_DAYS = 15;

export interface PublicLateFee {
  rentScheduleId: string;
  leaseId: string;
  scheduleId: string;
  amount: string;
  currency: string;
  dueDate: string;
  waived: boolean;
}

export interface PublicFormalNotice {
  id: string;
  leaseId: string;
  name: string;
  url: string;
  totalDue: string;
  currency: string;
  overdueCount: number;
  paymentDelayDays: number;
  issuedAt: string;
}

/**
 * Spec 04 P2 — recouvrement : pénalités de retard (fixes ou en %) appliquées
 * au-delà de `lateFeeAfterDays`, annulation par le gestionnaire, et mise en
 * demeure PDF au-delà de 15 jours d'ancienneté.
 */
@Injectable()
export class EnforcementService {
  private readonly logger = new Logger(EnforcementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly arrears: ArrearsService,
    private readonly notifications: NotificationsService,
    private readonly r2: R2Service,
    private readonly events: EventPublisher,
  ) {}

  /**
   * Daily pass: every rent schedule overdue by more than `lateFeeAfterDays`
   * gets one `LATE_FEE` line — a flat amount or a share of the monthly rent.
   * Idempotent: a schedule that already carries a late fee is skipped.
   */
  @Cron('0 7 * * *', { timeZone: 'Africa/Brazzaville' })
  async applyLateFeesScheduled(): Promise<void> {
    await this.applyLateFees(new Date());
  }

  /** Public for direct invocation from tests. */
  async applyLateFees(
    now = new Date(),
  ): Promise<{ scanned: number; applied: PublicLateFee[] }> {
    const leases = await this.prisma.lease.findMany({
      where: {
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.TERMINATING] },
        lateFeeAfterDays: { not: null },
        OR: [
          { lateFeeAmount: { not: null } },
          { lateFeeRate: { not: null } },
        ],
      },
      select: {
        id: true,
        tenantId: true,
        currency: true,
        monthlyRent: true,
        lateFeeAfterDays: true,
        lateFeeAmount: true,
        lateFeeRate: true,
      },
    });

    let scanned = 0;
    const applied: PublicLateFee[] = [];
    for (const lease of leases) {
      const threshold = (lease.lateFeeAfterDays ?? 0) * DAY_MS;
      if (threshold <= 0) continue;
      const cutoff = new Date(now.getTime() - threshold);

      const schedules = await this.prisma.rentSchedule.findMany({
        where: {
          leaseId: lease.id,
          kind: RentScheduleKind.RENT,
          dueDate: { lt: cutoff },
          status: {
            in: [
              RentScheduleStatus.PENDING,
              RentScheduleStatus.OVERDUE,
              RentScheduleStatus.PARTIAL,
            ],
          },
        },
        select: { id: true, dueDate: true, amount: true, currency: true },
      });
      scanned += schedules.length;

      for (const schedule of schedules) {
        const fee = this.computeFee(lease);
        if (fee.lte(0)) continue;
        if (await this.hasFeeFor(lease.id, schedule.dueDate)) {
          continue;
        }

        const line = await this.prisma.rentSchedule.create({
          data: {
            leaseId: lease.id,
            dueDate: now,
            kind: RentScheduleKind.LATE_FEE,
            amount: fee,
            lateFee: fee,
            currency: schedule.currency || lease.currency,
            status: RentScheduleStatus.PENDING,
            // `periodStart` ties the fee to the rent line it penalises.
            periodStart: schedule.dueDate,
            periodEnd: schedule.dueDate,
          },
        });
        applied.push({
          rentScheduleId: schedule.id,
          leaseId: lease.id,
          scheduleId: line.id,
          amount: fee.toString(),
          currency: line.currency,
          dueDate: line.dueDate.toISOString(),
          waived: false,
        });
        await this.events.emit(DOMAIN_EVENTS.LATE_FEE_APPLIED, {
          leaseId: lease.id,
          tenantId: lease.tenantId,
          rentScheduleId: schedule.id,
          lateFeeScheduleId: line.id,
          amount: fee.toString(),
          currency: line.currency,
        });
      }
    }

    this.logger.log(
      `Late fees: scanned=${scanned} applied=${applied.length}`,
    );
    return { scanned, applied };
  }

  /** Fixed amount wins over the rate, per the spec. */
  private computeFee(lease: {
    monthlyRent: Prisma.Decimal;
    lateFeeAmount: Prisma.Decimal | null;
    lateFeeRate: Prisma.Decimal | null;
  }): Prisma.Decimal {
    if (lease.lateFeeAmount !== null) {
      return lease.lateFeeAmount.toDecimalPlaces(2);
    }
    if (lease.lateFeeRate !== null) {
      return lease.monthlyRent
        .mul(lease.lateFeeRate)
        .toDecimalPlaces(2);
    }
    return new Prisma.Decimal(0);
  }

  /**
   * One fee per penalised rent line. `RentSchedule` has no foreign key back
   * to the penalised line, so the pairing is carried by `periodStart`, which
   * holds the due date of the rent line being penalised.
   */
  private async hasFeeFor(leaseId: string, dueDate: Date): Promise<boolean> {
    const existing = await this.prisma.rentSchedule.findFirst({
      where: {
        leaseId,
        kind: RentScheduleKind.LATE_FEE,
        periodStart: dueDate,
      },
      select: { id: true },
    });
    return existing !== null;
  }

  /**
   * POST /rent-schedules/:id/waive-fee — the manager cancels a late fee the
   * line is simply cancelled, so the tenant is not chased for it.
   */
  async waiveLateFee(
    managerId: string,
    lateFeeScheduleId: string,
  ): Promise<PublicLateFee> {
    const line = await this.prisma.rentSchedule.findUnique({
      where: { id: lateFeeScheduleId },
      include: { lease: { select: { propertyId: true, tenantId: true } } },
    });
    if (!line) {
      throw new NotFoundException({
        code: 'RENT_SCHEDULE_NOT_FOUND',
        message: 'Rent schedule does not exist',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(
      managerId,
      line.lease.propertyId,
    );
    if (line.kind !== RentScheduleKind.LATE_FEE) {
      throw new BadRequestException({
        code: 'NOT_A_LATE_FEE',
        message: `Only a LATE_FEE line can be waived (kind: ${line.kind})`,
      });
    }
    if (line.status === RentScheduleStatus.CANCELLED) {
      throw new ConflictException({
        code: 'LATE_FEE_ALREADY_WAIVED',
        message: 'This late fee has already been waived',
      });
    }

    const cancelled = await this.prisma.rentSchedule.update({
      where: { id: line.id },
      data: { status: RentScheduleStatus.CANCELLED },
    });
    await this.events.emit(DOMAIN_EVENTS.LATE_FEE_WAIVED, {
      leaseId: cancelled.leaseId,
      tenantId: line.lease.tenantId,
      lateFeeScheduleId: cancelled.id,
      rentScheduleId: line.periodStart?.toISOString() ?? null,
      amount: cancelled.amount.toString(),
      currency: cancelled.currency,
    });

    return {
      rentScheduleId: line.periodStart?.toISOString() ?? line.id,
      leaseId: cancelled.leaseId,
      scheduleId: cancelled.id,
      amount: cancelled.amount.toString(),
      currency: cancelled.currency,
      dueDate: cancelled.dueDate.toISOString(),
      waived: true,
    };
  }

  /**
   * POST /leases/:id/formal-notice — PDF formal notice once a rent is
   * {@link FORMAL_NOTICE_DAYS} days late. One notice per arrears episode: a
   * new one is only allowed once every overdue line has been settled.
   */
  async sendFormalNotice(
    managerId: string,
    leaseId: string,
    input: { paymentDelayDays?: number } = {},
  ): Promise<PublicFormalNotice> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        property: {
          select: {
            title: true,
            address: true,
            ownerId: true,
            organization: { select: { name: true } },
          },
        },
        tenant: { select: { name: true, phone: true } },
      },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(
      managerId,
      lease.propertyId,
    );
    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'LEASE_NOT_ACTIVE',
        message: `Formal notices only apply to an ACTIVE lease (status: ${lease.status})`,
      });
    }

    const balance = await this.arrears.getBalance(managerId, leaseId);
    if (balance.overdueCount === 0) {
      throw new BadRequestException({
        code: 'NO_OVERDUE_AMOUNT',
        message: 'This lease has no overdue rent — no formal notice to send',
      });
    }
    const oldest = Math.max(...balance.lines.map((l) => l.daysOverdue));
    if (oldest < FORMAL_NOTICE_DAYS) {
      throw new BadRequestException({
        code: 'FORMAL_NOTICE_NOT_DUE',
        message: `A formal notice is due after ${FORMAL_NOTICE_DAYS} days of arrears (oldest: ${oldest} j)`,
        details: { daysOverdue: oldest },
      });
    }

    const previous = await this.prisma.leaseDocument.findFirst({
      where: { leaseId, type: LeaseDocumentType.FORMAL_NOTICE },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const oldestDue = balance.oldestDueDate
      ? new Date(balance.oldestDueDate)
      : null;
    if (previous && oldestDue && previous.createdAt >= oldestDue) {
      throw new ConflictException({
        code: 'FORMAL_NOTICE_ALREADY_SENT',
        message:
          'A formal notice has already been issued for this arrears period',
        details: { issuedAt: previous.createdAt.toISOString() },
      });
    }

    const overdueLines = balance.lines.filter(
      (l) => l.kind !== RentScheduleKind.DEPOSIT && l.daysOverdue > 0,
    );
    const reference = `MED-${lease.id.slice(0, 8)}-${Date.now()}`;
    const pdf = await renderFormalNoticePdf({
      reference,
      issuedAt: new Date(),
      agencyName: lease.property.organization.name,
      landlordName: lease.property.title,
      tenantName: lease.tenant?.name ?? 'Locataire',
      tenantPhone: lease.tenant?.phone ?? lease.invitedPhone ?? '—',
      propertyAddress: lease.property.address,
      currency: balance.currency,
      overdueLines: overdueLines.map((l) => ({
        dueDate: new Date(l.dueDate),
        amount: l.amount,
        balance: l.balance,
        daysOverdue: l.daysOverdue,
      })),
      totalDue: balance.overdueAmount,
      paymentDelayDays: input.paymentDelayDays ?? FORMAL_NOTICE_DAYS,
    });
    const { url } = await this.r2.uploadLeaseFile({
      leaseId,
      filename: `mise-en-demeure-${reference}.pdf`,
      contentType: 'application/pdf',
      body: pdf,
    });

    const document = await this.prisma.leaseDocument.create({
      data: {
        leaseId,
        type: LeaseDocumentType.FORMAL_NOTICE,
        url,
        name: `Mise en demeure ${reference}`,
        uploadedBy: managerId,
      },
    });

    const payload = {
      leaseId,
      propertyTitle: lease.property.title,
      totalDue: balance.overdueAmount,
      currency: balance.currency,
      overdueCount: balance.overdueCount,
      documentId: document.id,
    };
    if (lease.tenantId) {
      await this.notifications.send({
        userId: lease.tenantId,
        type: 'FORMAL_NOTICE_SENT',
        payload,
      });
    }
    await this.notifications.send({
      userId: lease.property.ownerId,
      type: 'FORMAL_NOTICE_SENT',
      payload,
    });

    await this.events.emit(DOMAIN_EVENTS.FORMAL_NOTICE_SENT, {
      leaseId,
      tenantId: lease.tenantId,
      propertyId: lease.propertyId,
      ownerId: lease.property.ownerId,
      documentId: document.id,
      totalDue: balance.overdueAmount,
      currency: balance.currency,
    });

    return {
      id: document.id,
      leaseId,
      name: document.name,
      url: document.url,
      totalDue: balance.overdueAmount,
      currency: balance.currency,
      overdueCount: balance.overdueCount,
      paymentDelayDays: input.paymentDelayDays ?? FORMAL_NOTICE_DAYS,
      issuedAt: document.createdAt.toISOString(),
    };
  }
}
