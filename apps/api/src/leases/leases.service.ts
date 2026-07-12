import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Lease, LeaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { RentScheduleGenerator } from './rent-schedule.generator.service';
import { ListLeasesDto } from './dto/list-leases.dto';
import { MandateApprovalService } from '../mandates/mandate-approval.service';
import type { PublicMandateApproval } from '../mandates/mandate-approval.service';
import { AgencyAccessService } from '../mandates/agency-access.service';

export interface PublicLease {
  id: string;
  propertyId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
  currency: string;
  status: string;
  createdAt: string;
}

export interface PublicRentScheduleEntry {
  id: string;
  leaseId: string;
  dueDate: string;
  amount: string;
  currency: string;
  status: string;
}

export interface CreateLeaseInput {
  propertyId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: string | number;
  deposit: string | number;
  currency: string;
}

@Injectable()
export class LeasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly scheduleGen: RentScheduleGenerator,
    private readonly approvals: MandateApprovalService,
    private readonly agencyAccess: AgencyAccessService,
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

    const tenant = await this.prisma.user.findUnique({
      where: { id: input.tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant user does not exist',
      });
    }

    const lease = await this.prisma.lease.create({
      data: {
        propertyId: input.propertyId,
        tenantId: input.tenantId,
        startDate: input.startDate,
        endDate: input.endDate,
        monthlyRent: new Prisma.Decimal(input.monthlyRent),
        deposit: new Prisma.Decimal(input.deposit),
        currency: input.currency || property.currency,
        status: LeaseStatus.DRAFT,
      },
    });
    return this.toPublic(lease);
  }

  async listManaged(
    userId: string,
    filter: ListLeasesDto,
  ): Promise<PublicLease[]> {
    const propertyIds = await this.agencyAccess.listOperablePropertyIds(userId);
    if (propertyIds.length === 0) return [];

    const rows = await this.prisma.lease.findMany({
      where: {
        propertyId: { in: propertyIds },
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filter.limit ?? 50,
    });
    return rows.map((l) => this.toPublic(l));
  }

  async listMyLeases(userId: string): Promise<PublicLease[]> {
    const rows = await this.prisma.lease.findMany({
      where: { tenantId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((l) => this.toPublic(l));
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
   * Activate a `DRAFT` lease. Generates the full rent schedule in one shot
   * (idempotent on re-run thanks to `@@unique([leaseId, dueDate])`).
   */
  async activateLease(userId: string, leaseId: string): Promise<PublicLease> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        property: { select: { ownerId: true, organizationId: true } },
      },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    if (lease.property.ownerId !== userId) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: lease.property.organizationId,
          },
        },
      });
      if (!membership) {
        throw new ForbiddenException({
          code: 'NOT_PROPERTY_OWNER',
          message:
            'Only the owner or a member of the managing org can activate leases',
        });
      }
    }
    if (lease.status === LeaseStatus.ACTIVE) {
      return this.toPublic(lease);
    }
    if (lease.status === LeaseStatus.TERMINATED) {
      throw new BadRequestException({
        code: 'LEASE_TERMINATED',
        message: 'A terminated lease cannot be re-activated',
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.lease.update({
        where: { id: leaseId },
        data: { status: LeaseStatus.ACTIVE },
      });
      // Generation is delegated to the schedule service to keep the lease
      // service free of date math.
      return u;
    });

    // Generate the schedule outside the transaction so the service-layer
    // idempotency is decoupled from Prisma's unique-index handling.
    await this.scheduleGen.generateForLease(leaseId, {
      startDate: lease.startDate,
      endDate: lease.endDate,
      monthlyRent: lease.monthlyRent.toString(),
      currency: lease.currency,
    });

    await this.events.emit(DOMAIN_EVENTS.LEASE_CREATED, {
      leaseId: updated.id,
      propertyId: updated.propertyId,
      tenantId: updated.tenantId,
    });

    return this.toPublic(updated);
  }

  async getSchedule(leaseId: string): Promise<PublicRentScheduleEntry[]> {
    const rows = await this.prisma.rentSchedule.findMany({
      where: { leaseId },
      orderBy: { dueDate: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      leaseId: r.leaseId,
      dueDate: r.dueDate.toISOString(),
      amount: r.amount.toString(),
      currency: r.currency,
      status: r.status,
    }));
  }

  private toPublic(lease: Lease): PublicLease {
    return {
      id: lease.id,
      propertyId: lease.propertyId,
      tenantId: lease.tenantId,
      startDate: lease.startDate.toISOString(),
      endDate: lease.endDate.toISOString(),
      monthlyRent: lease.monthlyRent.toString(),
      deposit: lease.deposit.toString(),
      currency: lease.currency,
      status: lease.status,
      createdAt: lease.createdAt.toISOString(),
    };
  }

  private async findActiveMandate(propertyId: string) {
    return this.prisma.mandate.findFirst({
      where: { propertyId, status: 'ACTIVE' },
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
}
