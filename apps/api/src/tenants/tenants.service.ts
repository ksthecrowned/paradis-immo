import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, RentScheduleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import type {
  ManagedTenantDetail,
  ManagedTenantLeaseDetail,
  ManagedTenantListItem,
  ManagedTenantRecentPayment,
} from './tenants.types';

type PaymentMetadata = {
  rentScheduleId?: string;
};

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

  async listManaged(managerUserId: string): Promise<ManagedTenantListItem[]> {
    const propertyIds =
      await this.agencyAccess.listOperablePropertyIds(managerUserId);
    if (propertyIds.length === 0) return [];

    const leases = await this.prisma.lease.findMany({
      where: { propertyId: { in: propertyIds } },
      include: {
        tenant: {
          select: { id: true, name: true, phone: true, createdAt: true },
        },
        property: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byTenant = new Map<string, ManagedTenantListItem>();
    for (const lease of leases) {
      const t = lease.tenant;
      let row = byTenant.get(t.id);
      if (!row) {
        row = {
          id: t.id,
          name: t.name,
          phone: t.phone,
          accountCreatedAt: t.createdAt.toISOString(),
          activeLeaseCount: 0,
          leases: [],
          paymentSummary: { pendingValidation: 0, overdueRentLines: 0 },
        };
        byTenant.set(t.id, row);
      }
      row.leases.push({
        id: lease.id,
        propertyId: lease.propertyId,
        propertyTitle: lease.property.title,
        status: lease.status,
        monthlyRent: lease.monthlyRent.toString(),
        currency: lease.currency,
      });
      if (lease.status === 'ACTIVE') row.activeLeaseCount += 1;
    }

    const rows = [...byTenant.values()];
    await this.attachPaymentSummaries(rows);
    return this.sortTenants(rows);
  }

  async getManagedTenant(
    managerUserId: string,
    tenantUserId: string,
  ): Promise<ManagedTenantDetail> {
    const propertyIds =
      await this.agencyAccess.listOperablePropertyIds(managerUserId);
    if (propertyIds.length === 0) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Locataire introuvable sur vos biens',
      });
    }

    const leases = await this.prisma.lease.findMany({
      where: {
        tenantId: tenantUserId,
        propertyId: { in: propertyIds },
      },
      include: {
        tenant: {
          select: { id: true, name: true, phone: true, createdAt: true },
        },
        property: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (leases.length === 0) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Locataire introuvable sur vos biens',
      });
    }

    const tenant = leases[0].tenant;
    const leaseDetails: ManagedTenantLeaseDetail[] = [];
    let activeLeaseCount = 0;

    for (const lease of leases) {
      const schedules = await this.prisma.rentSchedule.findMany({
        where: { leaseId: lease.id },
        orderBy: { dueDate: 'asc' },
      });
      const now = new Date();
      const overdueCount = schedules.filter(
        (s) =>
          s.status === RentScheduleStatus.PENDING && s.dueDate.getTime() < now.getTime(),
      ).length;
      const nextPending = schedules.find(
        (s) => s.status === RentScheduleStatus.PENDING,
      );
      if (lease.status === 'ACTIVE') activeLeaseCount += 1;
      leaseDetails.push({
        id: lease.id,
        propertyId: lease.propertyId,
        propertyTitle: lease.property.title,
        status: lease.status,
        monthlyRent: lease.monthlyRent.toString(),
        currency: lease.currency,
        overdueCount,
        nextDue: nextPending
          ? {
              id: nextPending.id,
              dueDate: nextPending.dueDate.toISOString(),
              amount: nextPending.amount.toString(),
              currency: nextPending.currency,
              status: nextPending.status,
            }
          : null,
      });
    }

    const header: ManagedTenantListItem = {
      id: tenant.id,
      name: tenant.name,
      phone: tenant.phone,
      accountCreatedAt: tenant.createdAt.toISOString(),
      activeLeaseCount,
      leases: leaseDetails.map(
        ({ nextDue: _n, overdueCount: _o, ...summary }) => summary,
      ),
      paymentSummary: { pendingValidation: 0, overdueRentLines: 0 },
    };
    await this.attachPaymentSummaries([header]);

    const recentPayments = await this.listRecentPaymentsForTenant(
      tenantUserId,
      leases.map((l) => l.id),
    );

    return {
      ...header,
      leases: leaseDetails,
      recentPayments,
    };
  }

  private sortTenants(
    rows: ManagedTenantListItem[],
  ): ManagedTenantListItem[] {
    return rows.sort((a, b) => {
      const an = (a.name ?? '').toLocaleLowerCase();
      const bn = (b.name ?? '').toLocaleLowerCase();
      if (an && bn && an !== bn) return an.localeCompare(bn, 'fr');
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      return b.accountCreatedAt.localeCompare(a.accountCreatedAt);
    });
  }

  private async attachPaymentSummaries(
    rows: ManagedTenantListItem[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const now = new Date();
    const leaseIds = rows.flatMap((r) => r.leases.map((l) => l.id));
    const schedules =
      leaseIds.length === 0
        ? []
        : await this.prisma.rentSchedule.findMany({
            where: { leaseId: { in: leaseIds } },
            select: {
              id: true,
              leaseId: true,
              status: true,
              dueDate: true,
            },
          });

    const scheduleIdsByLease = new Map<string, string[]>();
    const overdueByLease = new Map<string, number>();
    for (const s of schedules) {
      const ids = scheduleIdsByLease.get(s.leaseId) ?? [];
      ids.push(s.id);
      scheduleIdsByLease.set(s.leaseId, ids);
      if (
        s.status === RentScheduleStatus.PENDING &&
        s.dueDate.getTime() < now.getTime()
      ) {
        overdueByLease.set(s.leaseId, (overdueByLease.get(s.leaseId) ?? 0) + 1);
      }
    }

    const allScheduleIds = schedules.map((s) => s.id);
    const scheduleIdSet = new Set(allScheduleIds);

    const allocatedPending =
      allScheduleIds.length === 0
        ? []
        : await this.prisma.paymentAllocation.findMany({
            where: {
              rentScheduleId: { in: allScheduleIds },
              payment: { status: PaymentStatus.PENDING_VALIDATION },
            },
            select: { paymentId: true, rentScheduleId: true },
          });

    const pendingCash = await this.prisma.payment.findMany({
      where: {
        method: 'CASH',
        status: PaymentStatus.PENDING_VALIDATION,
        userId: { in: rows.map((r) => r.id) },
      },
      select: { id: true, userId: true, metadata: true },
      take: 500,
    });

    for (const row of rows) {
      const tenantLeaseIds = new Set(row.leases.map((l) => l.id));
      const tenantScheduleIds = new Set(
        [...tenantLeaseIds].flatMap(
          (lid) => scheduleIdsByLease.get(lid) ?? [],
        ),
      );

      let overdue = 0;
      for (const lid of tenantLeaseIds) {
        overdue += overdueByLease.get(lid) ?? 0;
      }

      const pendingIds = new Set<string>();
      for (const a of allocatedPending) {
        if (a.rentScheduleId && tenantScheduleIds.has(a.rentScheduleId)) {
          pendingIds.add(a.paymentId);
        }
      }
      for (const p of pendingCash) {
        if (p.userId !== row.id) continue;
        const meta = (p.metadata ?? {}) as PaymentMetadata;
        if (
          typeof meta.rentScheduleId === 'string' &&
          scheduleIdSet.has(meta.rentScheduleId) &&
          !tenantScheduleIds.has(meta.rentScheduleId)
        ) {
          continue;
        }
        if (
          typeof meta.rentScheduleId === 'string' &&
          tenantScheduleIds.has(meta.rentScheduleId)
        ) {
          pendingIds.add(p.id);
          continue;
        }
        if (!meta.rentScheduleId) {
          pendingIds.add(p.id);
        }
      }

      row.paymentSummary = {
        pendingValidation: pendingIds.size,
        overdueRentLines: overdue,
      };
    }
  }

  private async listRecentPaymentsForTenant(
    tenantUserId: string,
    leaseIds: string[],
  ): Promise<ManagedTenantRecentPayment[]> {
    if (leaseIds.length === 0) return [];

    const schedules = await this.prisma.rentSchedule.findMany({
      where: { leaseId: { in: leaseIds } },
      select: { id: true },
    });
    const scheduleIds = schedules.map((s) => s.id);
    const scheduleIdSet = new Set(scheduleIds);

    const allocatedIds =
      scheduleIds.length === 0
        ? []
        : (
            await this.prisma.paymentAllocation.findMany({
              where: { rentScheduleId: { in: scheduleIds } },
              select: { paymentId: true },
              distinct: ['paymentId'],
              take: 100,
            })
          ).map((a) => a.paymentId);

    const pendingRows = await this.prisma.payment.findMany({
      where: {
        userId: tenantUserId,
        status: {
          in: [
            PaymentStatus.PENDING_VALIDATION,
            PaymentStatus.VALIDATED,
            PaymentStatus.INITIATED,
            PaymentStatus.FAILED,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, metadata: true },
    });

    const pendingIds = pendingRows
      .filter((p) => {
        const meta = (p.metadata ?? {}) as PaymentMetadata;
        if (
          typeof meta.rentScheduleId === 'string' &&
          scheduleIdSet.has(meta.rentScheduleId)
        ) {
          return true;
        }
        return allocatedIds.includes(p.id) || !meta.rentScheduleId;
      })
      .map((p) => p.id);

    const paymentIds = Array.from(new Set([...allocatedIds, ...pendingIds]));
    if (paymentIds.length === 0) return [];

    const rows = await this.prisma.payment.findMany({
      where: { id: { in: paymentIds }, userId: tenantUserId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return rows.map((p) => ({
      id: p.id,
      userId: p.userId,
      amount: p.amount.toString(),
      currency: p.currency,
      method: p.method,
      provider: p.provider,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      validatedAt: p.validatedAt?.toISOString() ?? null,
    }));
  }
}
