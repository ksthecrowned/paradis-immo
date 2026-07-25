import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  let tenants: TenantsService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let strangerUserId: string;
  let propertyId: string;
  let propertyId2: string;
  let orgId: string;
  let tenantCreatedAtIso: string;
  const createdLeaseIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const phones = ['+242072000001', '+242072000002', '+242072000003'];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [TenantsService, PrismaService, AgencyAccessService],
    }).compile();
    tenants = moduleRef.get(TenantsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;

    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    bzvQuartierId = quartier.id;

    const stale = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.lease.deleteMany({
        where: { tenantId: { in: staleIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const owner = await prisma.user.create({
      data: {
        phone: phones[0],
        name: 'Owner Tenants Spec',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;

    const tenant = await prisma.user.create({
      data: {
        phone: phones[1],
        name: 'Tenant Spec',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;
    tenantCreatedAtIso = tenant.createdAt.toISOString();

    const stranger = await prisma.user.create({
      data: {
        phone: phones[2],
        name: 'Stranger',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    strangerUserId = stranger.id;

    const org = await prisma.organization.create({
      data: {
        name: `Tenants Spec Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    orgId = org.id;

    const prop = await prisma.property.create({
      data: {
        title: 'Tenants Spec Property A',
        description: 'A',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 150000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: org.id,
      },
    });
    propertyId = prop.id;
    createdPropertyIds.push(prop.id);

    const prop2 = await prisma.property.create({
      data: {
        title: 'Tenants Spec Property B',
        description: 'B',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 200000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'Y',
        countryId,
        ownerId: ownerUserId,
        organizationId: org.id,
      },
    });
    propertyId2 = prop2.id;
    createdPropertyIds.push(prop2.id);

    const lease1 = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
        monthlyRent: 150000,
        deposit: 300000,
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });
    createdLeaseIds.push(lease1.id);

    await prisma.rentSchedule.create({
      data: {
        leaseId: lease1.id,
        dueDate: new Date('2026-01-01T00:00:00Z'),
        amount: 150000,
        currency: 'XAF',
        status: 'PENDING',
      },
    });
  });

  afterAll(async () => {
    if (createdLeaseIds.length) {
      await prisma.rentSchedule.deleteMany({
        where: { leaseId: { in: createdLeaseIds } },
      });
      await prisma.lease.deleteMany({ where: { id: { in: createdLeaseIds } } });
    }
    if (createdPropertyIds.length) {
      await prisma.property.deleteMany({
        where: { id: { in: createdPropertyIds } },
      });
    }
    await prisma.organizationMember.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    for (const id of [ownerUserId, tenantUserId, strangerUserId]) {
      await prisma.userRole.deleteMany({ where: { userId: id } });
      await prisma.refreshToken.deleteMany({ where: { userId: id } });
      await prisma.user.deleteMany({ where: { id } });
    }
    await prisma.onModuleDestroy();
  });

  it('returns distinct tenants for operable properties with accountCreatedAt', async () => {
    const rows = await tenants.listManaged(ownerUserId);
    expect(rows.some((t) => t.id === tenantUserId)).toBe(true);
    const hit = rows.find((t) => t.id === tenantUserId)!;
    expect(hit.accountCreatedAt).toBe(tenantCreatedAtIso);
    expect(hit.leases.length).toBeGreaterThanOrEqual(1);
    expect(hit.name).toBe('Tenant Spec');
  });

  it('dedupes one tenant with two leases into a single row', async () => {
    const lease2 = await prisma.lease.create({
      data: {
        propertyId: propertyId2,
        tenantId: tenantUserId,
        startDate: new Date('2026-02-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
        monthlyRent: 200000,
        deposit: 400000,
        currency: 'XAF',
        status: 'DRAFT',
      },
    });
    createdLeaseIds.push(lease2.id);

    const rows = await tenants.listManaged(ownerUserId);
    expect(rows.filter((t) => t.id === tenantUserId)).toHaveLength(1);
    expect(
      rows.find((t) => t.id === tenantUserId)!.leases.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for a user with no operable properties', async () => {
    expect(await tenants.listManaged(strangerUserId)).toEqual([]);
  });

  it('getManagedTenant returns nextDue, overdueCount, recentPayments', async () => {
    const detail = await tenants.getManagedTenant(ownerUserId, tenantUserId);
    expect(detail.id).toBe(tenantUserId);
    const active = detail.leases.find((l) => l.status === 'ACTIVE');
    expect(active).toBeDefined();
    expect(active!.overdueCount).toBeGreaterThanOrEqual(1);
    expect(active!.nextDue).not.toBeNull();
    expect(Array.isArray(detail.recentPayments)).toBe(true);
  });

  it('getManagedTenant 404 when no shared lease', async () => {
    await expect(
      tenants.getManagedTenant(ownerUserId, strangerUserId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('paymentSummary counts overdue PENDING schedules', async () => {
    const rows = await tenants.listManaged(ownerUserId);
    expect(
      rows.find((t) => t.id === tenantUserId)!.paymentSummary.overdueRentLines,
    ).toBeGreaterThanOrEqual(1);
  });
});
