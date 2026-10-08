import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  BookingStatus,
  Lease,
  LeaseStatus,
  ListingStatus,
  Prisma,
  RentScheduleStatus,
  TerminationInitiator,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { RentScheduleGenerator } from './rent-schedule.generator.service';
import { ListLeasesDto } from './dto/list-leases.dto';
import { MandateApprovalService } from '../mandates/mandate-approval.service';
import type { PublicMandateApproval } from '../mandates/mandate-approval.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OtpStore, OTP_MAX_ATTEMPTS } from '../auth/otp.store';
import { InfobipOtpService } from '../auth/infobip-otp.service';

export interface PublicLease {
  id: string;
  propertyId: string;
  /** Null while the lease only holds an invited phone (no account yet). */
  tenantId: string | null;
  /** Phone of the invited tenant when no account is linked yet. */
  invitedPhone: string | null;
  tenantPhone?: string | null;
  tenantName?: string | null;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
  currency: string;
  status: string;
  dueDay: number;
  chargesAmount: string;
  chargesMode: string;
  noticeMonthsTenant: number;
  noticeMonthsLandlord: number;
  indexationRate: string | null;
  lateFeeAfterDays: number | null;
  lateFeeAmount: string | null;
  lateFeeRate: string | null;
  autoRenew: boolean;
  tenantSignedAt: string | null;
  landlordSignedAt: string | null;
  activatedAt: string | null;
  terminationInitiator: string | null;
  terminationNoticeAt: string | null;
  terminationEffectiveAt: string | null;
  terminationReason: string | null;
  terminatedAt: string | null;
  createdAt: string;
}

export interface PublicRentScheduleEntry {
  id: string;
  leaseId: string;
  dueDate: string;
  amount: string;
  rentPart: string;
  chargesPart: string;
  lateFee: string;
  amountPaid: string;
  currency: string;
  kind: string;
  status: string;
}

export interface PaginatedLeases {
  data: PublicLease[];
  meta: { total: number; page: number; pageSize: number };
}

/** Which side of the contract a signature comes from. */
export type LeaseSignatureParty = 'TENANT' | 'LANDLORD';

export interface LeaseSignatureState {
  /** True when the call only requested a code. */
  sent?: boolean;
  /** True when the call actually recorded a signature. */
  signed?: boolean;
  /** Both parties signed — the lease moved to ACTIVE. */
  bothSigned: boolean;
  /** Side that owns the signature in this response. */
  party: LeaseSignatureParty;
}

export type SignedLease = PublicLease & { signature: LeaseSignatureState };

/** Spec 04 US 7 — a seated co-tenant of a colocated lease. */
export interface PublicCoTenant {
  userId: string;
  name: string | null;
  phone: string | null;
  isPrimary: boolean;
}

/** Spec 04 US 11 — result of `POST /leases/:id/renew`. */
export interface LeaseRenewalResult {
  /** False while the renewal waits for the owner's approval (live mandate). */
  applied: boolean;
  approvalId: string | null;
  /** Current lease state (not yet extended when `applied` is false). */
  lease: PublicLease;
}

/** Contractual terms (spec 04). */
export interface LeaseTermsInput {
  dueDay?: number;
  chargesAmount?: string | number;
  chargesMode?: string;
  noticeMonthsTenant?: number;
  noticeMonthsLandlord?: number;
  indexationRate?: string | number;
  lateFeeAfterDays?: number | null;
  lateFeeAmount?: string | number | null;
  lateFeeRate?: string | number | null;
  autoRenew?: boolean;
  templateId?: string;
}

export interface CreateLeaseInput extends LeaseTermsInput {
  propertyId: string;
  tenantId?: string;
  /** Phone of the tenant, known account or not. No silent User creation. */
  invitedPhone?: string;
  /** Legacy alias of `invitedPhone`. */
  tenantPhone?: string;
  tenantName?: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: string | number;
  deposit: string | number;
  currency: string;
}

export interface UpdateLeaseInput extends LeaseTermsInput {
  tenantId?: string;
  invitedPhone?: string;
  tenantPhone?: string;
  tenantName?: string;
  startDate?: Date;
  endDate?: Date;
  monthlyRent?: string | number;
  deposit?: string | number;
  currency?: string;
}

/**
 * Spec 04 — the deposit is capped by country setting, three months of rent by
 * default. The per-country override comes with the settings spec (12).
 */
export const DEPOSIT_MAX_MONTHS = 3;

@Injectable()
export class LeasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly scheduleGen: RentScheduleGenerator,
    private readonly approvals: MandateApprovalService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly otpStore: OtpStore,
    private readonly infobipOtp: InfobipOtpService,
  ) {}

  async createLease(
    userId: string,
    input: CreateLeaseInput,
  ): Promise<PublicLease> {
    if (input.endDate <= input.startDate) {
      throw new BadRequestException({
        code: 'INVALID_LEASE_DATES',
        message: 'endDate must be after startDate',
      });
    }
    this.assertDepositWithinCap(input.monthlyRent, input.deposit);
    const property = await this.prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true, ownerId: true, organizationId: true, currency: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    if (property.ownerId !== userId) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: property.organizationId,
          },
        },
      });
      if (!membership) {
        throw new ForbiddenException({
          code: 'NOT_PROPERTY_OWNER',
          message:
            'Only the owner or a member of the managing org can create leases',
        });
      }
    }

    const phone = input.invitedPhone ?? input.tenantPhone;
    const tenant = await this.resolveTenant(
      input.tenantId,
      phone,
      input.tenantName,
    );

    const lease = await this.prisma.lease.create({
      data: {
        propertyId: input.propertyId,
        tenantId: tenant.tenantId,
        invitedPhone: tenant.invitedPhone,
        startDate: input.startDate,
        endDate: input.endDate,
        monthlyRent: new Prisma.Decimal(input.monthlyRent),
        deposit: new Prisma.Decimal(input.deposit),
        currency: input.currency || property.currency,
        status: LeaseStatus.DRAFT,
        ...this.termsData(input),
      },
    });

    // The tenant is invited as soon as the draft exists so they can review
    // the contract before signing (spec 04 — no silent User creation).
    await this.inviteTenant(lease.id, tenant.invitedPhone ?? null);

    return this.toPublic(lease);
  }

  /** Spec 04 — deposit ceiling, in months of rent (country setting, spec 12). */
  private assertDepositWithinCap(
    monthlyRent: string | number | Prisma.Decimal,
    deposit: string | number | Prisma.Decimal,
  ): void {
    const cap = new Prisma.Decimal(monthlyRent).mul(DEPOSIT_MAX_MONTHS);
    if (new Prisma.Decimal(deposit).gt(cap)) {
      throw new BadRequestException({
        code: 'DEPOSIT_EXCEEDS_CAP',
        message: `Deposit cannot exceed ${DEPOSIT_MAX_MONTHS} months of rent (${cap.toString()})`,
      });
    }
  }

  /**
   * Update a DRAFT lease. ACTIVE / TERMINATED / CANCELLED leases are
   * immutable (activate already generated the rent schedule).
   */
  async updateLease(
    userId: string,
    leaseId: string,
    input: UpdateLeaseInput,
  ): Promise<PublicLease> {
    const existing = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        property: {
          select: { ownerId: true, organizationId: true },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    await this.assertCanManage(
      userId,
      existing.property.ownerId,
      existing.property.organizationId,
    );
    if (existing.status !== LeaseStatus.DRAFT) {
      throw new BadRequestException({
        code: 'LEASE_NOT_EDITABLE',
        message: 'Only DRAFT leases can be edited',
      });
    }

    const startDate = input.startDate ?? existing.startDate;
    const endDate = input.endDate ?? existing.endDate;
    if (endDate <= startDate) {
      throw new BadRequestException({
        code: 'INVALID_LEASE_DATES',
        message: 'endDate must be after startDate',
      });
    }
    this.assertDepositWithinCap(
      input.monthlyRent ?? existing.monthlyRent,
      input.deposit ?? existing.deposit,
    );

    const phone = input.invitedPhone ?? input.tenantPhone;
    let tenantId = existing.tenantId;
    let invitedPhone = existing.invitedPhone;
    if (input.tenantId !== undefined || phone !== undefined) {
      const tenant = await this.resolveTenant(
        input.tenantId ?? undefined,
        phone,
        input.tenantName,
      );
      tenantId = tenant.tenantId;
      invitedPhone = tenant.invitedPhone;
    }

    const updated = await this.prisma.lease.update({
      where: { id: leaseId },
      data: {
        tenantId,
        invitedPhone,
        startDate,
        endDate,
        ...(input.monthlyRent !== undefined
          ? { monthlyRent: new Prisma.Decimal(input.monthlyRent) }
          : {}),
        ...(input.deposit !== undefined
          ? { deposit: new Prisma.Decimal(input.deposit) }
          : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...this.termsData(input),
      },
    });
    return this.toPublic(updated);
  }

  /**
   * Spec 04 — no silent `User` creation. A known account is linked by phone
   * when one exists; otherwise the phone is stored as `invitedPhone` and the
   * account is only created when the tenant accepts the invitation.
   */
  private async resolveTenant(
    tenantId: string | undefined,
    phone: string | undefined,
    tenantName?: string,
  ): Promise<{ tenantId: string | null; invitedPhone: string | null }> {
    if (phone) {
      const existing = await this.prisma.user.findFirst({
        where: { phone },
        select: { id: true },
      });
      return {
        tenantId: existing?.id ?? null,
        invitedPhone: existing ? null : phone,
      };
    }
    if (!tenantId) {
      throw new BadRequestException({
        code: 'TENANT_REQUIRED',
        message: 'invitedPhone (or tenantId) is required',
      });
    }
    const tenant = await this.prisma.user.findUnique({
      where: { id: tenantId },
      select: { id: true, phone: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant user does not exist',
      });
    }
    return { tenantId: tenant.id, invitedPhone: tenant.phone ?? null };
  }

  /**
   * Contractual terms shared by create and update. Scalar fields only, so the
   * same shape fits both `LeaseUncheckedCreateInput` and
   * `LeaseUncheckedUpdateInput` (no `Prisma` operator wrappers here).
   */
  private termsData(input: LeaseTermsInput) {
    const data: {
      dueDay?: number;
      chargesAmount?: Prisma.Decimal;
      chargesMode?: string;
      noticeMonthsTenant?: number;
      noticeMonthsLandlord?: number;
      indexationRate?: Prisma.Decimal;
      lateFeeAfterDays?: number | null;
      lateFeeAmount?: Prisma.Decimal | null;
      lateFeeRate?: Prisma.Decimal | null;
      autoRenew?: boolean;
      templateId?: string;
    } = {};
    return {
      ...(input.dueDay !== undefined ? { dueDay: input.dueDay } : {}),
      ...(input.chargesAmount !== undefined
        ? { chargesAmount: new Prisma.Decimal(input.chargesAmount) }
        : {}),
      ...(input.chargesMode !== undefined
        ? { chargesMode: input.chargesMode }
        : {}),
      ...(input.noticeMonthsTenant !== undefined
        ? { noticeMonthsTenant: input.noticeMonthsTenant }
        : {}),
      ...(input.noticeMonthsLandlord !== undefined
        ? { noticeMonthsLandlord: input.noticeMonthsLandlord }
        : {}),
      ...(input.indexationRate !== undefined
        ? { indexationRate: new Prisma.Decimal(input.indexationRate) }
        : {}),
      ...(input.lateFeeAfterDays !== undefined
        ? { lateFeeAfterDays: input.lateFeeAfterDays }
        : {}),
      ...(input.lateFeeAmount !== undefined
        ? {
            lateFeeAmount:
              input.lateFeeAmount === null
                ? null
                : new Prisma.Decimal(input.lateFeeAmount),
          }
        : {}),
      ...(input.lateFeeRate !== undefined
        ? {
            lateFeeRate:
              input.lateFeeRate === null
                ? null
                : new Prisma.Decimal(input.lateFeeRate),
          }
        : {}),
      ...(input.autoRenew !== undefined ? { autoRenew: input.autoRenew } : {}),
      ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
    };
    return data;
  }

  /**
   * Invite the tenant to review and sign the lease. WhatsApp is the default
   * channel (spec); a linked account also gets an in-app notification.
   */
  private async inviteTenant(
    leaseId: string,
    phone: string | null,
  ): Promise<void> {
    if (phone) {
      await this.notifications.sendToPhone(
        phone,
        'LEASE_INVITATION',
        { leaseId },
        `Paradis Immo — un bail vous attend. Beraterezvous en ligne depuis l'application.`,
      );
    }
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: { tenantId: true, property: { select: { title: true } } },
    });
    if (!lease?.tenantId) return;
    await this.notifications.send({
      userId: lease.tenantId,
      type: 'LEASE_INVITATION',
      payload: { leaseId, propertyTitle: lease.property.title },
    });
  }

  private async assertCanManage(
    userId: string,
    ownerId: string,
    organizationId: string,
  ): Promise<void> {
    if (ownerId === userId) return;
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'NOT_PROPERTY_OWNER',
        message:
          'Only the owner or a member of the managing org can manage this lease',
      });
    }
  }

  async listManaged(
    userId: string,
    filter: ListLeasesDto,
  ): Promise<PaginatedLeases> {
    const propertyIds = await this.agencyAccess.listOperablePropertyIds(userId);
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const where: Prisma.LeaseWhereInput = {
      ...(propertyIds.length === 0
        ? { id: '__none__' }
        : { propertyId: { in: propertyIds } }),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
      ...(filter.overdue
        ? { schedule: { some: { status: RentScheduleStatus.OVERDUE } } }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.lease.count({ where }),
      this.prisma.lease.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { tenant: { select: { phone: true, name: true } } },
      }),
    ]);
    return {
      data: rows.map((l) => this.toPublic(l, l.tenant)),
      meta: { total, page, pageSize },
    };
  }

  async listMyLeases(userId: string): Promise<PublicLease[]> {
    const rows = await this.prisma.lease.findMany({
      where: { tenantId: userId },
      orderBy: { createdAt: 'desc' },
      include: { tenant: { select: { phone: true, name: true } } },
    });
    return rows.map((l) => this.toPublic(l, l.tenant));
  }

  /**
   * Under an active mandate, agents must request owner sign-off before activation.
   */
  async requestLeaseSign(
    userId: string,
    leaseId: string,
  ): Promise<PublicMandateApproval> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        property: { select: { id: true, ownerId: true, organizationId: true } },
      },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    await this.assertCanManageLease(userId, lease.propertyId);

    const mandate = await this.findActiveMandate(lease.propertyId);
    if (!mandate) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_MANDATE',
        message: 'No active mandate on this property',
      });
    }

    return this.approvals.requireApproval({
      mandateId: mandate.id,
      actionType: 'LEASE_SIGN',
      payload: { leaseId },
      requestedByUserId: userId,
    });
  }

  /**
   * DRAFT → PENDING_SIGNATURE. Re-sends the tenant invitation.
   */
  async sendForSignature(
    userId: string,
    leaseId: string,
  ): Promise<PublicLease> {
    const lease = await this.requireLease(leaseId);
    await this.assertCanManageLease(userId, lease.propertyId);
    if (lease.status !== LeaseStatus.DRAFT) {
      throw new BadRequestException({
        code: 'LEASE_NOT_SENDABLE',
        message: `Only DRAFT leases can be sent for signature (status: ${lease.status})`,
      });
    }
    const updated = await this.prisma.lease.update({
      where: { id: leaseId },
      data: { status: LeaseStatus.PENDING_SIGNATURE },
    });
    const phone = lease.tenant?.phone ?? lease.invitedPhone ?? null;
    await this.inviteTenant(leaseId, phone);
    return this.toPublic(updated);
  }

  /**
   * Electronic signature by OTP (spec 04, US 5).
   *
   * - omit `otpCode` to receive a fresh code over WhatsApp;
   * - send it back to record the signature.
   *
   * The tenant signs first, then the landlord side (owner or agent). An agent
   * signing under a live mandate needs an approved `LEASE_SIGN` request first.
   * When both sides have signed the lease is activated like any other lease:
   * property `OCCUPIED`, rent schedule generated, `LEASE_CREATED` emitted.
   */
  async signLease(
    userId: string,
    leaseId: string,
    input: { otpCode?: string },
  ): Promise<SignedLease> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        tenant: { select: { phone: true, name: true } },
        property: {
          select: { id: true, ownerId: true, organizationId: true, title: true },
        },
      },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    if (lease.status !== LeaseStatus.PENDING_SIGNATURE) {
      throw new BadRequestException({
        code: 'LEASE_NOT_SIGNABLE',
        message: `Only PENDING_SIGNATURE leases can be signed (status: ${lease.status})`,
      });
    }

    const party = await this.resolveSigningParty(userId, lease);
    if (this.alreadySigned(lease, party)) {
      throw new BadRequestException({
        code: 'ALREADY_SIGNED',
        message: `The ${party.toLowerCase()} side already signed this lease`,
      });
    }

    const phone = await this.resolveSigningPhone(userId, lease, party);
    if (!phone) {
      throw new BadRequestException({
        code: 'SIGN_PHONE_MISSING',
        message: 'The signing account has no phone number',
      });
    }

    if (!input.otpCode) {
      const code = String(randomInt(100000, 999999));
      await this.otpStore.put(phone, code, 'LEASE_SIGN');
      await this.infobipOtp.sendText({
        to: phone,
        text: `Paradis Immo — code de signature du bail : ${code}`,
      });
      return {
        ...this.toPublic(lease, lease.tenant),
        signature: {
          sent: true,
          bothSigned: this.hasBothSignatures(lease),
          party,
        },
      };
    }

    const record = await this.otpStore.getWithAttempts(phone);
    const valid =
      record !== null &&
      record.purpose === 'LEASE_SIGN' &&
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
    const signed = await this.prisma.lease.update({
      where: { id: leaseId },
      data:
        party === 'TENANT'
          ? { tenantSignedAt: now }
          : { landlordSignedAt: now, landlordSignedById: userId },
    });
    const bothSigned = this.hasBothSignatures(signed);

    await this.events.emit(DOMAIN_EVENTS.LEASE_SIGNED, {
      leaseId,
      propertyId: lease.propertyId,
      tenantId: signed.tenantId,
      party,
      bothSigned,
    });

    if (!bothSigned) {
      return {
        ...this.toPublic(signed),
        signature: { signed: true, bothSigned: false, party },
      };
    }

    const activated = await this.performActivation(signed);
    return {
      ...this.toPublic(activated, lease.tenant),
      signature: { signed: true, bothSigned: true, party },
    };
  }

  /**
   * A lease is signed by the tenant of record, or by the landlord side: the
   * property owner, or an agent allowed to operate on the property.
   */
  private async resolveSigningParty(
    userId: string,
    lease: Pick<Lease, 'id' | 'tenantId' | 'propertyId'> & {
      property: { ownerId: string; organizationId: string };
    },
  ): Promise<LeaseSignatureParty> {
    if (lease.tenantId === userId) return 'TENANT';
    // Delegated signature — same authorisation as any other lease action, plus
    // the owner sign-off the mandate requires before an agency signs (spec 03).
    await this.assertCanManageLease(userId, lease.propertyId);
    const mandate = await this.findActiveMandate(lease.propertyId);
    if (mandate && !(await this.hasApprovedLeaseSign(lease.id, mandate.id))) {
      throw new BadRequestException({
        code: 'LEASE_SIGN_APPROVAL_REQUIRED',
        message:
          'Owner must approve LEASE_SIGN before an agent signs the lease under an active mandate',
      });
    }
    return 'LANDLORD';
  }

  private alreadySigned(
    lease: Pick<Lease, 'tenantSignedAt' | 'landlordSignedAt'>,
    party: LeaseSignatureParty,
  ): boolean {
    return party === 'TENANT'
      ? lease.tenantSignedAt !== null
      : lease.landlordSignedAt !== null;
  }

  private hasBothSignatures(
    lease: Pick<Lease, 'tenantSignedAt' | 'landlordSignedAt'>,
  ): boolean {
    return lease.tenantSignedAt !== null && lease.landlordSignedAt !== null;
  }

  /** Tenant side uses the lease phone; landlord side its own account phone. */
  private async resolveSigningPhone(
    userId: string,
    lease: Pick<Lease, 'invitedPhone'> & {
      tenant: { phone: string | null } | null;
    },
    party: LeaseSignatureParty,
  ): Promise<string | null> {
    if (party === 'TENANT') {
      return lease.tenant?.phone ?? lease.invitedPhone ?? null;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    return user?.phone ?? null;
  }

  /** Cancel a lease that never started (DRAFT / PENDING_SIGNATURE). */
  async cancelLease(userId: string, leaseId: string): Promise<PublicLease> {
    const lease = await this.requireLease(leaseId);
    await this.assertCanManageLease(userId, lease.propertyId);
    if (
      lease.status !== LeaseStatus.DRAFT &&
      lease.status !== LeaseStatus.PENDING_SIGNATURE
    ) {
      throw new BadRequestException({
        code: 'LEASE_NOT_CANCELLABLE',
        message: `Only DRAFT or PENDING_SIGNATURE leases can be cancelled (status: ${lease.status})`,
      });
    }
    const updated = await this.prisma.lease.update({
      where: { id: leaseId },
      data: { status: LeaseStatus.CANCELLED },
    });
    await this.prisma.rentSchedule.deleteMany({
      where: { leaseId, status: { in: [RentScheduleStatus.PENDING, RentScheduleStatus.OVERDUE] } },
    });
    return this.toPublic(updated);
  }

  /**
   * Activate a `DRAFT` / `PENDING_SIGNATURE` lease.
   *
   * - rejects overlaps with another ACTIVE / TERMINATING lease or a CONFIRMED
   *   booking on the same property (409 `LEASE_OVERLAP`), inside a
   *   transaction;
   * - flips the property to `OCCUPIED` so the listing leaves the marketplace;
   * - generates the rent schedule (idempotent on re-run).
   */
  async activateLease(userId: string, leaseId: string): Promise<PublicLease> {
    const lease = await this.requireLease(leaseId);
    await this.assertCanManageLease(userId, lease.propertyId);
    if (lease.status === LeaseStatus.ACTIVE) {
      return this.toPublic(lease);
    }
    if (
      lease.status === LeaseStatus.TERMINATED ||
      lease.status === LeaseStatus.CANCELLED
    ) {
      throw new BadRequestException({
        code: 'LEASE_TERMINATED',
        message: `A ${lease.status} lease cannot be activated`,
      });
    }

    const mandate = await this.findActiveMandate(lease.propertyId);
    if (mandate && !(await this.hasApprovedLeaseSign(leaseId, mandate.id))) {
      throw new BadRequestException({
        code: 'LEASE_SIGN_APPROVAL_REQUIRED',
        message:
          'Owner must approve LEASE_SIGN before activation under an active mandate',
      });
    }

    const updated = await this.performActivation(lease);
    return this.toPublic(updated);
  }

  /**
   * Activation itself, without any authorisation: overlap guard + `ACTIVE` +
   * property `OCCUPIED` + rent schedule + `LEASE_CREATED`. Shared by the
   * manager endpoint and by the signature flow (both parties signed).
   */
  private async performActivation(lease: Lease): Promise<Lease> {
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.assertNoOverlap(tx, lease);
      const u = await tx.lease.update({
        where: { id: lease.id },
        data: { status: LeaseStatus.ACTIVE, activatedAt: new Date() },
      });
      await tx.property.update({
        where: { id: lease.propertyId },
        data: {
          listingStatus: ListingStatus.OCCUPIED,
          availableFrom: null,
        },
      });
      return u;
    });

    // Generation is delegated to the schedule service to keep the lease
    // service free of date math.
    await this.scheduleGen.generateForLease(lease.id, {
      startDate: lease.startDate,
      endDate: lease.endDate,
      monthlyRent: lease.monthlyRent.toString(),
      chargesAmount: lease.chargesAmount.toString(),
      dueDay: lease.dueDay,
      currency: lease.currency,
      deposit: lease.deposit.toString(),
    });

    await this.events.emit(DOMAIN_EVENTS.LEASE_CREATED, {
      leaseId: updated.id,
      propertyId: updated.propertyId,
      tenantId: updated.tenantId,
    });

    return updated;
  }

  /**
   * Overlap guard (spec 04). Two periods overlap when each starts before the
   * other ends. Runs inside the activation transaction so concurrent
   * activations cannot both pass.
   */
  private async assertNoOverlap(
    tx: Prisma.TransactionClient,
    lease: Pick<Lease, 'id' | 'propertyId' | 'startDate' | 'endDate'>,
  ): Promise<void> {
    const period = {
      startDate: { lt: lease.endDate },
      endDate: { gt: lease.startDate },
    };
    const conflictingLease = await tx.lease.findFirst({
      where: {
        id: { not: lease.id },
        propertyId: lease.propertyId,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.TERMINATING] },
        ...period,
      },
      select: { id: true, status: true },
    });
    if (conflictingLease) {
      throw new ConflictException({
        code: 'LEASE_OVERLAP',
        message: `Another ${conflictingLease.status} lease already covers part of this period`,
        details: { conflictingLeaseId: conflictingLease.id },
      });
    }
    const conflictingBooking = await tx.booking.findFirst({
      where: {
        propertyId: lease.propertyId,
        status: BookingStatus.CONFIRMED,
        ...period,
      },
      select: { id: true },
    });
    if (conflictingBooking) {
      throw new ConflictException({
        code: 'LEASE_OVERLAP',
        message: 'A confirmed booking overlaps this lease period',
        details: { conflictingBookingId: conflictingBooking.id },
      });
    }
  }

  /**
   * Give notice (congé). The effective date is at least
   * `noticeAt + noticeMonths`; every rent schedule due after it is cancelled.
   */
  async requestTermination(
    userId: string,
    leaseId: string,
    input: {
      initiator: TerminationInitiator;
      reason?: string;
      requestedEndDate: Date;
    },
  ): Promise<PublicLease> {
    const lease = await this.requireLease(leaseId);
    await this.assertCanReadLease(userId, lease);
    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'LEASE_NOT_ACTIVE',
        message: `Notice only applies to ACTIVE leases (status: ${lease.status})`,
      });
    }

    const noticeAt = new Date();
    const noticeMonths =
      input.initiator === TerminationInitiator.LANDLORD
        ? lease.noticeMonthsLandlord
        : lease.noticeMonthsTenant;
    const earliest = this.addMonths(noticeAt, noticeMonths);
    const effectiveAt =
      input.requestedEndDate > earliest ? input.requestedEndDate : earliest;

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.lease.update({
        where: { id: leaseId },
        data: {
          status: LeaseStatus.TERMINATING,
          terminationInitiator: input.initiator,
          terminationNoticeAt: noticeAt,
          terminationEffectiveAt: effectiveAt,
          terminationReason: input.reason ?? null,
        },
      });
      await tx.rentSchedule.updateMany({
        where: {
          leaseId,
          dueDate: { gt: effectiveAt },
          status: {
            in: [RentScheduleStatus.PENDING, RentScheduleStatus.OVERDUE],
          },
        },
        data: { status: RentScheduleStatus.CANCELLED },
      });
      return u;
    });

    await this.notifyTermination(updated, input.initiator);
    return this.toPublic(updated);
  }

  /** Withdraw a notice during the notice period (spec 04). */
  async withdrawTermination(userId: string, leaseId: string): Promise<PublicLease> {
    const lease = await this.requireLease(leaseId);
    if (lease.status !== LeaseStatus.TERMINATING) {
      throw new BadRequestException({
        code: 'LEASE_NOT_TERMINATING',
        message: `No notice to withdraw (status: ${lease.status})`,
      });
    }
    const isTenant = lease.tenantId === userId;
    await this.assertCanReadLease(userId, lease);
    if (
      !isTenant &&
      !(await this.agencyAccess.canOperateOnProperty(userId, lease.propertyId))
    ) {
      throw new ForbiddenException({
        code: 'NOT_PROPERTY_OWNER',
        message: 'Only the parties of the lease can withdraw the notice',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.lease.update({
        where: { id: leaseId },
        data: {
          status: LeaseStatus.ACTIVE,
          terminationInitiator: null,
          terminationNoticeAt: null,
          terminationEffectiveAt: null,
          terminationReason: null,
        },
      });
      if (lease.terminationEffectiveAt) {
        await tx.rentSchedule.updateMany({
          where: {
            leaseId,
            dueDate: { gt: lease.terminationEffectiveAt },
            status: RentScheduleStatus.CANCELLED,
          },
          data: { status: RentScheduleStatus.PENDING },
        });
      }
      return u;
    });
    return this.toPublic(updated);
  }

  /**
   * Close the lease after the notice period (and ideally the exit inspection):
   * `TERMINATED`, remaining due schedules cancelled, property back on the
   * market as AVAILABLE / AVAILABLE_SOON.
   */
  async closeLease(userId: string, leaseId: string): Promise<PublicLease> {
    const lease = await this.requireLease(leaseId);
    await this.assertCanManageLease(userId, lease.propertyId);
    if (
      lease.status !== LeaseStatus.TERMINATING &&
      lease.status !== LeaseStatus.ACTIVE
    ) {
      throw new BadRequestException({
        code: 'LEASE_NOT_CLOSABLE',
        message: `Only ACTIVE or TERMINATING leases can be closed (status: ${lease.status})`,
      });
    }
    const now = new Date();
    if (
      lease.status === LeaseStatus.TERMINATING &&
      lease.terminationEffectiveAt &&
      lease.terminationEffectiveAt > now
    ) {
      throw new BadRequestException({
        code: 'LEASE_NOTICE_NOT_ELAPSED',
        message:
          'The notice period has not elapsed yet — the lease cannot be closed',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.lease.update({
        where: { id: leaseId },
        data: { status: LeaseStatus.TERMINATED, terminatedAt: now },
      });
      await tx.rentSchedule.updateMany({
        where: {
          leaseId,
          status: {
            in: [
              RentScheduleStatus.PENDING,
              RentScheduleStatus.OVERDUE,
              RentScheduleStatus.PARTIAL,
            ],
          },
        },
        data: { status: RentScheduleStatus.CANCELLED },
      });
      const exitAt = lease.terminationEffectiveAt ?? lease.endDate;
      const released = exitAt <= now;
      await tx.property.update({
        where: { id: lease.propertyId },
        data: released
          ? { listingStatus: ListingStatus.AVAILABLE, availableFrom: null }
          : { listingStatus: ListingStatus.AVAILABLE_SOON, availableFrom: exitAt },
      });
      return u;
    });
    return this.toPublic(updated);
  }

  private async notifyTermination(
    lease: Lease,
    initiator: TerminationInitiator,
  ): Promise<void> {
    if (!lease.tenantId) return;
    await this.notifications.send({
      userId: lease.tenantId,
      type: 'LEASE_TERMINATION_NOTICE',
      payload: {
        leaseId: lease.id,
        initiator,
        effectiveAt: lease.terminationEffectiveAt?.toISOString() ?? null,
      },
    });
  }

  async getOne(userId: string, leaseId: string): Promise<PublicLease> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { tenant: { select: { phone: true, name: true } } },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    await this.assertCanReadLease(userId, lease);
    return this.toPublic(lease, lease.tenant);
  }

  async getSchedule(
    userId: string,
    leaseId: string,
  ): Promise<PublicRentScheduleEntry[]> {
    const lease = await this.prisma.lease.findUnique({ where: { id: leaseId } });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    await this.assertCanReadLease(userId, lease);
    const rows = await this.prisma.rentSchedule.findMany({
      where: { leaseId },
      orderBy: { dueDate: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      leaseId: r.leaseId,
      dueDate: r.dueDate.toISOString(),
      amount: r.amount.toString(),
      rentPart: r.rentPart.toString(),
      chargesPart: r.chargesPart.toString(),
      lateFee: r.lateFee.toString(),
      amountPaid: r.amountPaid.toString(),
      currency: r.currency,
      kind: r.kind,
      status: r.status,
    }));
  }

  private addMonths(from: Date, months: number): Date {
    const d = new Date(from);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d;
  }

  /** Spec 04 US 7 — colocation: who lives under this lease. */
  async listCoTenants(
    userId: string,
    leaseId: string,
  ): Promise<PublicCoTenant[]> {
    const lease = await this.requireLease(leaseId);
    const isTenant = lease.tenantId === userId;
    const isCoTenant =
      !isTenant &&
      (await this.prisma.leaseTenant.findUnique({
        where: { leaseId_userId: { leaseId, userId } },
        select: { userId: true },
      })) !== null;
    if (!isTenant && !isCoTenant) {
      await this.assertCanManageLease(userId, lease.propertyId);
    }
    const rows = await this.prisma.leaseTenant.findMany({
      where: { leaseId },
      include: { user: { select: { id: true, name: true, phone: true } } },
      orderBy: { userId: 'asc' },
    });
    return rows.map((row) => ({
      userId: row.userId,
      name: row.user.name,
      phone: row.user.phone,
      isPrimary: row.isPrimary,
    }));
  }

  /**
   * Spec 04 US 11 — `POST /leases/:id/renew` : nouveau terme et loyer du
   * nouveau terme. Sous mandat vivant, un changement de loyer crée une
   * approbation RENT_INCREASE / RENT_REDUCTION et rien n'est appliqué avant
   * la décision du propriétaire (effet réel de l'approbation, spec 03).
   */
  async renewLease(
    userId: string,
    leaseId: string,
    input: { newEndDate: Date; newMonthlyRent?: number },
  ): Promise<LeaseRenewalResult> {
    const lease = await this.requireLease(leaseId);
    await this.assertCanManageLease(userId, lease.propertyId);

    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'LEASE_NOT_ACTIVE',
        message: `Only an ACTIVE lease can be renewed (status: ${lease.status})`,
      });
    }
    if (
      Number.isNaN(input.newEndDate.getTime()) ||
      input.newEndDate.getTime() <= lease.endDate.getTime()
    ) {
      throw new BadRequestException({
        code: 'INVALID_RENEWAL_END_DATE',
        message: 'newEndDate must be after the current end date',
      });
    }
    if (input.newMonthlyRent !== undefined && !(input.newMonthlyRent >= 0)) {
      throw new BadRequestException({
        code: 'INVALID_RENEWAL_RENT',
        message: 'newMonthlyRent must be positive',
      });
    }

    const rentChanged =
      input.newMonthlyRent !== undefined &&
      !new Prisma.Decimal(input.newMonthlyRent).eq(lease.monthlyRent);
    const mandate = rentChanged ? await this.findActiveMandate(lease.propertyId) : null;

    if (mandate && input.newMonthlyRent !== undefined) {
      const actionType = new Prisma.Decimal(input.newMonthlyRent).gt(
        lease.monthlyRent,
      )
        ? 'RENT_INCREASE'
        : 'RENT_REDUCTION';
      // The new rent only governs the new term (spec 04 US 11).
      const effectiveFrom = new Date(lease.endDate.getTime() + 86_400_000);
      const approval = await this.approvals.requireApproval({
        mandateId: mandate.id,
        actionType,
        sourceType: 'LEASE',
        sourceId: lease.id,
        payload: {
          leaseId: lease.id,
          newMonthlyRent: String(input.newMonthlyRent),
          effectiveFrom: effectiveFrom.toISOString(),
          newEndDate: input.newEndDate.toISOString(),
        },
        requestedByUserId: userId,
      });
      if (lease.tenantId) {
        await this.notifications.send({
          userId: lease.tenantId,
          type: 'LEASE_RENEWAL_PROPOSED',
          payload: {
            leaseId: lease.id,
            newEndDate: input.newEndDate.toISOString(),
            newMonthlyRent: String(input.newMonthlyRent),
            approvalId: approval.id,
          },
        });
      }
      return {
        applied: false,
        approvalId: approval.id,
        lease: this.toPublic(lease, lease.tenant),
      };
    }

    const updated = await this.prisma.lease.update({
      where: { id: lease.id },
      data: {
        endDate: input.newEndDate,
        ...(rentChanged && input.newMonthlyRent !== undefined
          ? { monthlyRent: new Prisma.Decimal(input.newMonthlyRent) }
          : {}),
      },
    });
    // Only the lines of the new term are missing: `generateForLease` keeps
    // every existing line thanks to the (leaseId, dueDate, kind) unique index.
    await this.scheduleGen.generateForLease(lease.id, {
      startDate: lease.startDate,
      endDate: updated.endDate,
      monthlyRent: updated.monthlyRent.toString(),
      chargesAmount: updated.chargesAmount.toString(),
      dueDay: updated.dueDay,
      currency: updated.currency,
    });

    await this.events.emit(DOMAIN_EVENTS.LEASE_RENEWED, {
      leaseId: lease.id,
      propertyId: lease.propertyId,
      tenantId: lease.tenantId,
      previousEndDate: lease.endDate.toISOString(),
      newEndDate: updated.endDate.toISOString(),
      newMonthlyRent: updated.monthlyRent.toString(),
      approvalId: null,
    });

    const property = await this.prisma.property.findUnique({
      where: { id: lease.propertyId },
      select: { ownerId: true },
    });
    const payload = {
      leaseId: lease.id,
      previousEndDate: lease.endDate.toISOString(),
      newEndDate: updated.endDate.toISOString(),
      newMonthlyRent: updated.monthlyRent.toString(),
    };
    if (lease.tenantId) {
      await this.notifications.send({
        userId: lease.tenantId,
        type: 'LEASE_RENEWED',
        payload,
      });
    }
    if (property && property.ownerId !== userId) {
      await this.notifications.send({
        userId: property.ownerId,
        type: 'LEASE_RENEWED',
        payload,
      });
    }

    return {
      applied: true,
      approvalId: null,
      lease: this.toPublic(updated, lease.tenant),
    };
  }

  private async requireLease(
    leaseId: string,
  ): Promise<Lease & { tenant: { phone: string | null; name: string | null } | null }> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { tenant: { select: { phone: true, name: true } } },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    return lease;
  }

  private toPublic(
    lease: Lease,
    tenant?: { phone: string | null; name: string | null } | null,
  ): PublicLease {
    return {
      id: lease.id,
      propertyId: lease.propertyId,
      tenantId: lease.tenantId,
      invitedPhone: lease.invitedPhone,
      tenantPhone: tenant?.phone ?? lease.invitedPhone,
      tenantName: tenant?.name ?? null,
      startDate: lease.startDate.toISOString(),
      endDate: lease.endDate.toISOString(),
      monthlyRent: lease.monthlyRent.toString(),
      deposit: lease.deposit.toString(),
      currency: lease.currency,
      status: lease.status,
      dueDay: lease.dueDay,
      chargesAmount: lease.chargesAmount.toString(),
      chargesMode: lease.chargesMode,
      noticeMonthsTenant: lease.noticeMonthsTenant,
      noticeMonthsLandlord: lease.noticeMonthsLandlord,
      indexationRate:
        lease.indexationRate === null ? null : lease.indexationRate.toString(),
      lateFeeAfterDays: lease.lateFeeAfterDays,
      lateFeeAmount:
        lease.lateFeeAmount === null ? null : lease.lateFeeAmount.toString(),
      lateFeeRate:
        lease.lateFeeRate === null ? null : lease.lateFeeRate.toString(),
      autoRenew: lease.autoRenew,
      tenantSignedAt: lease.tenantSignedAt?.toISOString() ?? null,
      landlordSignedAt: lease.landlordSignedAt?.toISOString() ?? null,
      activatedAt: lease.activatedAt?.toISOString() ?? null,
      terminationInitiator: lease.terminationInitiator,
      terminationNoticeAt: lease.terminationNoticeAt?.toISOString() ?? null,
      terminationEffectiveAt:
        lease.terminationEffectiveAt?.toISOString() ?? null,
      terminationReason: lease.terminationReason,
      terminatedAt: lease.terminatedAt?.toISOString() ?? null,
      createdAt: lease.createdAt.toISOString(),
    };
  }

  private async findActiveMandate(propertyId: string) {
    return this.prisma.mandate.findFirst({
      where: {
        propertyId,
        OR: [
          { status: 'ACTIVE' },
          // Still under notice: the agency keeps managing until the
          // termination takes effect (spec 03).
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
      where: {
        mandateId,
        actionType: 'LEASE_SIGN',
        status: 'APPROVED',
      },
    });
    return rows.some((row) => {
      const payload = row.payload as { leaseId?: string } | null;
      return payload?.leaseId === leaseId;
    });
  }

  private async assertCanManageLease(
    userId: string,
    propertyId: string,
  ): Promise<void> {
    await this.agencyAccess.assertCanOperateOnProperty(userId, propertyId);
  }

  private async assertCanReadLease(
    userId: string,
    lease: Pick<Lease, 'propertyId' | 'tenantId'>,
  ): Promise<void> {
    if (lease.tenantId === userId) return;
    await this.agencyAccess.assertCanOperateOnProperty(
      userId,
      lease.propertyId,
    );
  }
}
