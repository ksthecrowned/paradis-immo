import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { LeaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { MandateApprovalService } from '../mandates/mandate-approval.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OtpStore, OTP_MAX_ATTEMPTS } from '../auth/otp.store';
import { InfobipOtpService } from '../auth/infobip-otp.service';
import { generateRentSchedule } from './rent-schedule.generator';
import type { CreateAmendmentDto } from './dto/create-amendment.dto';

export interface CoTenantsChanges {
  /** Phones of the co-tenants joining the lease (spec — no silent User creation). */
  add?: string[];
  /** User ids of the co-tenants leaving the lease. */
  remove?: string[];
}

export interface AmendmentChanges {
  monthlyRent?: string;
  chargesAmount?: string;
  endDate?: string;
  noticeMonthsTenant?: number;
  noticeMonthsLandlord?: number;
  /** Spec 04 US 7 — colocation. */
  coTenants?: CoTenantsChanges;
}

export interface PublicAmendment {
  id: string;
  leaseId: string;
  version: number;
  changes: AmendmentChanges;
  effectiveFrom: string;
  reason: string | null;
  tenantSignedAt: string | null;
  landlordSignedAt: string | null;
  /** Both signatures recorded — the changes are live on the lease. */
  applied: boolean;
  createdById: string;
  createdAt: string;
}

export interface AmendmentSignatureState {
  sent?: boolean;
  signed?: boolean;
  bothSigned: boolean;
  applied: boolean;
  party: 'TENANT' | 'LANDLORD';
}

export type SignedAmendment = PublicAmendment & {
  signature: AmendmentSignatureState;
};

/**
 * Spec 04 US 7 — avenants.
 *
 * Every amendment is versioned, only the tenant and the bailleur can sign it,
 * and it becomes effective when both have signed: the lease is updated and the
 * future rent lines are recomputed from `effectiveFrom`. Under a live mandate
 * the owner sign-off already required for the lease (`LEASE_SIGN`) also gates
 * the creation of an amendment.
 */
@Injectable()
export class AmendmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly agencyAccess: AgencyAccessService,
    private readonly approvals: MandateApprovalService,
    private readonly notifications: NotificationsService,
    private readonly otpStore: OtpStore,
    private readonly infobipOtp: InfobipOtpService,
  ) {}

  async list(userId: string, leaseId: string): Promise<PublicAmendment[]> {
    await this.requireReadableLease(userId, leaseId);
    const rows = await this.prisma.leaseAmendment.findMany({
      where: { leaseId },
      orderBy: { version: 'desc' },
    });
    return rows.map((row) => this.toPublic(row));
  }

  /** POST /leases/:id/amendments — the next version of the contract. */
  async create(
    managerId: string,
    leaseId: string,
    dto: CreateAmendmentDto,
  ): Promise<PublicAmendment> {
    const lease = await this.requireLease(leaseId);
    await this.agencyAccess.assertCanOperateOnProperty(
      managerId,
      lease.propertyId,
    );
    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'LEASE_NOT_ACTIVE',
        message: `Amendments only apply to an ACTIVE lease (status: ${lease.status})`,
      });
    }

    const mandate = await this.findActiveMandate(lease.propertyId);
    if (mandate && !(await this.hasApprovedLeaseSign(leaseId, mandate.id))) {
      throw new BadRequestException({
        code: 'AMENDMENT_APPROVAL_REQUIRED',
        message:
          'Owner must approve LEASE_SIGN before an amendment under an active mandate',
      });
    }

    const changes = await this.normalizeChanges(dto.changes, lease.endDate);
    const effectiveFrom = dto.effectiveFrom ?? new Date();
    if (effectiveFrom > lease.endDate) {
      throw new BadRequestException({
        code: 'INVALID_EFFECTIVE_FROM',
        message: 'effectiveFrom cannot be after the end of the lease',
      });
    }

    const last = await this.prisma.leaseAmendment.findFirst({
      where: { leaseId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const amendment = await this.prisma.leaseAmendment.create({
      data: {
        leaseId,
        version: (last?.version ?? 0) + 1,
        changes: changes as unknown as Prisma.InputJsonValue,
        effectiveFrom,
        reason: dto.reason ?? null,
        createdById: managerId,
      },
    });

    await this.events.emit(DOMAIN_EVENTS.AMENDMENT_CREATED, {
      leaseId,
      amendmentId: amendment.id,
      version: amendment.version,
      tenantId: lease.tenantId,
      propertyId: lease.propertyId,
      changes: changes as unknown as Record<string, unknown>,
      effectiveFrom: effectiveFrom.toISOString(),
    });

    if (lease.tenantId) {
      await this.notifications.send({
        userId: lease.tenantId,
        type: 'AMENDMENT_PROPOSED',
        payload: {
          leaseId,
          amendmentId: amendment.id,
          version: amendment.version,
          effectiveFrom: effectiveFrom.toISOString(),
        },
      });
    }

    return this.toPublic(amendment);
  }

  /**
   * POST /leases/:id/amendments/:version/sign — OTP signature. Omit `otpCode`
   * to receive one. Once both parties signed, the amendment is applied.
   */
  async sign(
    actorId: string,
    leaseId: string,
    version: number,
    input: { otpCode?: string },
  ): Promise<SignedAmendment> {
    const lease = await this.requireLease(leaseId);
    const amendment = await this.prisma.leaseAmendment.findUnique({
      where: { leaseId_version: { leaseId, version } },
    });
    if (!amendment) {
      throw new NotFoundException({
        code: 'AMENDMENT_NOT_FOUND',
        message: `No amendment v${version} on this lease`,
      });
    }

    const isTenant = lease.tenantId === actorId;
    if (!isTenant) {
      await this.agencyAccess.assertCanOperateOnProperty(
        actorId,
        lease.propertyId,
      );
    }
    const party = isTenant ? 'TENANT' : 'LANDLORD';
    const alreadySigned = isTenant
      ? amendment.tenantSignedAt !== null
      : amendment.landlordSignedAt !== null;
    if (alreadySigned) {
      throw new ConflictException({
        code: 'AMENDMENT_ALREADY_SIGNED',
        message: `The ${party.toLowerCase()} side already signed amendment v${version}`,
      });
    }

    const phone = await this.signingPhone(actorId, lease, isTenant);
    if (!phone) {
      throw new BadRequestException({
        code: 'SIGN_PHONE_MISSING',
        message: 'The signing account has no phone number',
      });
    }

    if (!input.otpCode) {
      const code = String(randomInt(100000, 999999));
      await this.otpStore.put(phone, code, 'AMENDMENT_SIGN');
      await this.infobipOtp.sendText({
        to: phone,
        text: `Paradis Immo — code de signature de l'avenant (v${version}) : ${code}`,
      });
      return {
        ...this.toPublic(amendment),
        signature: { sent: true, bothSigned: false, applied: false, party },
      };
    }

    const record = await this.otpStore.getWithAttempts(phone);
    const valid =
      record !== null &&
      record.purpose === 'AMENDMENT_SIGN' &&
      record.code === input.otpCode;
    if (!valid) {
      const after = await this.otpStore.incrementAttempts(phone);
      if (after && after.attempts >= OTP_MAX_ATTEMPTS) {
        await this.otpStore.del(phone);
      }
      throw new BadRequestException({
        code: 'SIGN_INVALID_CODE',
        message: 'Invalid or expired signature code',
      });
    }
    await this.otpStore.del(phone);

    const now = new Date();
    const signed = await this.prisma.leaseAmendment.update({
      where: { id: amendment.id },
      data:
        party === 'TENANT'
          ? { tenantSignedAt: now }
          : { landlordSignedAt: now },
    });
    const bothSigned =
      signed.tenantSignedAt !== null && signed.landlordSignedAt !== null;

    await this.events.emit(DOMAIN_EVENTS.AMENDMENT_SIGNED, {
      leaseId,
      amendmentId: signed.id,
      version: signed.version,
      tenantId: lease.tenantId,
      party,
      bothSigned,
    });

    if (!bothSigned) {
      return {
        ...this.toPublic(signed),
        signature: { signed: true, bothSigned: false, applied: false, party },
      };
    }

    await this.applyAmendment(lease, signed);
    const refreshed = await this.prisma.leaseAmendment.findUniqueOrThrow({
      where: { id: signed.id },
    });
    return {
      ...this.toPublic(refreshed),
      signature: { signed: true, bothSigned: true, applied: true, party },
    };
  }

  /** Writes the new terms on the lease and recomputes the future rent lines. */
  private async applyAmendment(
    lease: {
      id: string;
      propertyId: string;
      tenantId: string | null;
      currency: string;
      dueDay: number;
      monthlyRent: Prisma.Decimal;
      chargesAmount: Prisma.Decimal;
      deposit: Prisma.Decimal;
      noticeMonthsTenant: number;
      noticeMonthsLandlord: number;
      endDate: Date;
    },
    amendment: {
      id: string;
      version: number;
      changes: unknown;
      effectiveFrom: Date;
    },
  ): Promise<void> {
    const changes = (amendment.changes ?? {}) as AmendmentChanges;
    const monthlyRent = changes.monthlyRent
      ? new Prisma.Decimal(changes.monthlyRent)
      : lease.monthlyRent;
    const chargesAmount = changes.chargesAmount
      ? new Prisma.Decimal(changes.chargesAmount)
      : lease.chargesAmount;
    const endDate = changes.endDate ? new Date(changes.endDate) : lease.endDate;

    const updatedLease = await this.prisma.lease.update({
      where: { id: lease.id },
      data: {
        monthlyRent,
        chargesAmount,
        endDate,
        ...(changes.noticeMonthsTenant !== undefined
          ? { noticeMonthsTenant: changes.noticeMonthsTenant }
          : {}),
        ...(changes.noticeMonthsLandlord !== undefined
          ? { noticeMonthsLandlord: changes.noticeMonthsLandlord }
          : {}),
      },
    });

    await this.recomputeFutureSchedules(updatedLease, amendment.effectiveFrom);
    await this.applyCoTenants(lease.id, lease.tenantId, changes.coTenants);

    await this.events.emit(DOMAIN_EVENTS.AMENDMENT_APPLIED, {
      leaseId: lease.id,
      amendmentId: amendment.id,
      version: amendment.version,
      tenantId: lease.tenantId,
      propertyId: lease.propertyId,
      effectiveFrom: amendment.effectiveFrom.toISOString(),
      newMonthlyRent: monthlyRent.toString(),
      newEndDate: endDate.toISOString(),
    });

    const payload = {
      leaseId: lease.id,
      amendmentId: amendment.id,
      version: amendment.version,
      monthlyRent: monthlyRent.toString(),
      effectiveFrom: amendment.effectiveFrom.toISOString(),
    };
    if (lease.tenantId) {
      await this.notifications.send({
        userId: lease.tenantId,
        type: 'AMENDMENT_APPLIED',
        payload,
      });
    }
  }

  /**
   * Drops the unpaid lines after `effectiveFrom` and regenerates them from the
   * new terms. Lines due on or before that date are never touched (an
   * amendment cannot back-date a rent), and a month that already carries money
   * (PAID / PARTIAL) is never duplicated.
   */
  private async recomputeFutureSchedules(
    lease: {
      id: string;
      endDate: Date;
      monthlyRent: Prisma.Decimal;
      chargesAmount: Prisma.Decimal;
      dueDay: number;
      currency: string;
    },
    effectiveFrom: Date,
  ): Promise<void> {
    await this.prisma.rentSchedule.deleteMany({
      where: {
        leaseId: lease.id,
        dueDate: { gt: effectiveFrom },
        status: { in: ['PENDING', 'OVERDUE', 'CANCELLED'] },
      },
    });

    const kept = await this.prisma.rentSchedule.findMany({
      where: {
        leaseId: lease.id,
        dueDate: { gt: effectiveFrom },
        status: { in: ['PAID', 'PARTIAL'] },
      },
      select: { dueDate: true },
    });
    const keptDates = new Set(
      kept.map((k) => k.dueDate.toISOString().slice(0, 10)),
    );

    const planned = generateRentSchedule({
      startDate: effectiveFrom,
      endDate: lease.endDate,
      monthlyRent: lease.monthlyRent.toString(),
      chargesAmount: lease.chargesAmount.toString(),
      dueDay: lease.dueDay,
      currency: lease.currency,
    })
      .filter((entry) => entry.dueDate > effectiveFrom)
      .filter((entry) => !keptDates.has(entry.dueDate.toISOString().slice(0, 10)));

    if (planned.length === 0) return;
    await this.prisma.rentSchedule.createMany({
      data: planned.map((entry) => ({
        leaseId: lease.id,
        dueDate: entry.dueDate,
        kind: entry.kind,
        amount: entry.amount,
        currency: entry.currency,
        rentPart: entry.rentPart,
        chargesPart: entry.chargesPart,
        periodStart: entry.periodStart,
        periodEnd: entry.periodEnd,
      })),
      skipDuplicates: true,
    });
  }

  private async normalizeChanges(
    input: CreateAmendmentDto['changes'],
    leaseEndDate: Date,
  ): Promise<AmendmentChanges> {
    const out: AmendmentChanges = {};
    if (input.monthlyRent !== undefined) {
      if (!(input.monthlyRent >= 0)) {
        throw new BadRequestException({
          code: 'INVALID_AMENDMENT',
          message: 'monthlyRent must be positive',
        });
      }
      out.monthlyRent = new Prisma.Decimal(input.monthlyRent).toString();
    }
    if (input.chargesAmount !== undefined) {
      if (!(input.chargesAmount >= 0)) {
        throw new BadRequestException({
          code: 'INVALID_AMENDMENT',
          message: 'chargesAmount must be positive',
        });
      }
      out.chargesAmount = new Prisma.Decimal(input.chargesAmount).toString();
    }
    if (input.endDate !== undefined) {
      const endDate = new Date(input.endDate);
      if (Number.isNaN(endDate.getTime()) || endDate <= leaseEndDate) {
        throw new BadRequestException({
          code: 'INVALID_AMENDMENT',
          message: 'endDate must be a valid date after the current lease end',
        });
      }
      out.endDate = endDate.toISOString();
    }
    if (input.noticeMonthsTenant !== undefined) {
      out.noticeMonthsTenant = input.noticeMonthsTenant;
    }
    if (input.noticeMonthsLandlord !== undefined) {
      out.noticeMonthsLandlord = input.noticeMonthsLandlord;
    }
    if (input.coTenants !== undefined) {
      const add = input.coTenants.add ?? [];
      const remove = input.coTenants.remove ?? [];
      if (add.length === 0 && remove.length === 0) {
        throw new BadRequestException({
          code: 'INVALID_AMENDMENT',
          message:
            'coTenants needs at least one phone to add or one user id to remove',
        });
      }
      // Spec: no silent User creation — a joining co-tenant must already
      // have an account (candidates always do; new roommates must sign up).
      for (const phone of add) {
        const account = await this.prisma.user.findFirst({
          where: { phone },
          select: { id: true },
        });
        if (!account) {
          throw new BadRequestException({
            code: 'CO_TENANT_NOT_FOUND',
            message: `No account matches ${phone} — the co-tenant must sign up first`,
          });
        }
      }
      out.coTenants = {
        ...(add.length > 0 ? { add } : {}),
        ...(remove.length > 0 ? { remove } : {}),
      };
    }
    if (Object.keys(out).length === 0) {
      throw new BadRequestException({
        code: 'INVALID_AMENDMENT',
        message:
          'An amendment must change at least one of monthlyRent, chargesAmount, endDate, noticeMonthsTenant, noticeMonthsLandlord, coTenants',
      });
    }
    return out;
  }

  /**
   * Spec 04 US 7 — seats or unseats the co-tenants of a signed amendment.
   * `LeaseTenant.userId` must be a real account, so an added phone that lost
   * its account between proposal and signature is skipped rather than failing
   * the whole signature.
   */
  private async applyCoTenants(
    leaseId: string,
    tenantId: string | null,
    coTenants: CoTenantsChanges | undefined,
  ): Promise<void> {
    if (!coTenants) return;
    if (coTenants.remove?.length) {
      await this.prisma.leaseTenant.deleteMany({
        where: {
          leaseId,
          userId: { in: coTenants.remove },
          // The tenant of record is never a removable co-tenant.
          ...(tenantId ? { NOT: { userId: tenantId } } : {}),
        },
      });
    }
    for (const phone of coTenants.add ?? []) {
      const account = await this.prisma.user.findFirst({
        where: { phone },
        select: { id: true },
      });
      if (!account || account.id === tenantId) continue;
      await this.prisma.leaseTenant.upsert({
        where: { leaseId_userId: { leaseId, userId: account.id } },
        create: { leaseId, userId: account.id, isPrimary: false },
        update: {},
      });
      await this.notifications.send({
        userId: account.id,
        type: 'CO_TENANT_ADDED',
        payload: { leaseId },
      });
    }
  }

  private async signingPhone(
    actorId: string,
    lease: { invitedPhone: string | null; tenant: { phone: string | null } | null },
    isTenant: boolean,
  ): Promise<string | null> {
    if (isTenant) return lease.tenant?.phone ?? lease.invitedPhone ?? null;
    const user = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { phone: true },
    });
    return user?.phone ?? null;
  }

  private async requireReadableLease(
    userId: string,
    leaseId: string,
  ): Promise<{ id: string; propertyId: string; tenantId: string | null }> {
    const lease = await this.prisma.lease.findUnique({ where: { id: leaseId } });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    if (lease.tenantId !== userId) {
      await this.agencyAccess.assertCanOperateOnProperty(userId, lease.propertyId);
    }
    return lease;
  }

  private async requireLease(leaseId: string) {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        tenant: { select: { phone: true, name: true } },
        property: { select: { ownerId: true, title: true } },
      },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    return lease;
  }

  private async findActiveMandate(propertyId: string) {
    return this.prisma.mandate.findFirst({
      where: {
        propertyId,
        OR: [
          { status: 'ACTIVE' },
          { status: 'TERMINATING', terminationEffectiveAt: { gt: new Date() } },
        ],
      },
    });
  }

  private async hasApprovedLeaseSign(
    leaseId: string,
    mandateId: string,
  ): Promise<boolean> {
    const rows = await this.prisma.mandateApproval.findMany({
      where: { mandateId, actionType: 'LEASE_SIGN', status: 'APPROVED' },
    });
    return rows.some((row) => {
      const payload = row.payload as { leaseId?: string } | null;
      return payload?.leaseId === leaseId;
    });
  }

  private toPublic(amendment: {
    id: string;
    leaseId: string;
    version: number;
    changes: unknown;
    effectiveFrom: Date;
    reason: string | null;
    tenantSignedAt: Date | null;
    landlordSignedAt: Date | null;
    createdById: string;
    createdAt: Date;
  }): PublicAmendment {
    return {
      id: amendment.id,
      leaseId: amendment.leaseId,
      version: amendment.version,
      changes: (amendment.changes ?? {}) as AmendmentChanges,
      effectiveFrom: amendment.effectiveFrom.toISOString(),
      reason: amendment.reason,
      tenantSignedAt: amendment.tenantSignedAt?.toISOString() ?? null,
      landlordSignedAt: amendment.landlordSignedAt?.toISOString() ?? null,
      applied:
        amendment.tenantSignedAt !== null &&
        amendment.landlordSignedAt !== null,
      createdById: amendment.createdById,
      createdAt: amendment.createdAt.toISOString(),
    };
  }
}
