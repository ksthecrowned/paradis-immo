import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService account deletion (spec 01)', () => {
  let users: UsersService;
  let prisma: PrismaService;
  let countryId: string;
  let ownerId: string;
  let tenantId: string;
  let orgId: string;
  let propertyId: string;
  let leaseId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, PrismaService],
    }).compile();
    users = moduleRef.get(UsersService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country = await prisma.country.findFirstOrThrow();
    countryId = country.id;
    const quartier = await prisma.quartier.findFirstOrThrow({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });

    // Idempotent: a crashed earlier run may have left rows behind. Clean the
    // whole chain (lease → property → org → users) before recreating.
    const stale = await prisma.user.findMany({
      where: { phone: { in: ['+242067700001', '+242067700002'] } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      const staleProps = await prisma.property.findMany({
        where: { ownerId: { in: staleIds } },
        select: { id: true },
      });
      const stalePropIds = staleProps.map((p) => p.id);
      if (stalePropIds.length) {
        const staleLeases = await prisma.lease.findMany({
          where: { propertyId: { in: stalePropIds } },
          select: { id: true },
        });
        const staleLeaseIds = staleLeases.map((l) => l.id);
        if (staleLeaseIds.length) {
          await prisma.paymentAllocation.deleteMany({
            where: { rentSchedule: { leaseId: { in: staleLeaseIds } } },
          });
          await prisma.rentSchedule.deleteMany({
            where: { leaseId: { in: staleLeaseIds } },
          });
          await prisma.lease.deleteMany({
            where: { id: { in: staleLeaseIds } },
          });
        }
        await prisma.property.deleteMany({
          where: { id: { in: stalePropIds } },
        });
      }
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }
    await prisma.organization.deleteMany({
      where: {
        name: { startsWith: 'Users Deletion Spec Org' },
        members: { none: {} },
        properties: { none: {} },
      },
    });

    const owner = await prisma.user.create({
      data: { phone: '+242067700001', countryId, name: 'Owner Del' },
    });
    ownerId = owner.id;
    const tenant = await prisma.user.create({
      data: { phone: '+242067700002', countryId, name: 'Tenant Del' },
    });
    tenantId = tenant.id;

    // Own fixture: borrowing an arbitrary property via findFirstOrThrow made
    // this suite lease (and block deletion of) other suites' properties when
    // tests run in parallel against the same database.
    const org = await prisma.organization.create({
      data: {
        name: `Users Deletion Spec Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerId, role: 'OWNER' } },
      },
    });
    orgId = org.id;
    const property = await prisma.property.create({
      data: {
        title: 'Users Deletion Spec Property',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'x',
        countryId,
        ownerId,
        organizationId: orgId,
      },
    });
    propertyId = property.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    // beforeAll may have failed midway: never delete with undefined ids.
    if (leaseId) {
      await prisma.paymentAllocation.deleteMany({
        where: { rentSchedule: { leaseId } },
      });
      await prisma.rentSchedule.deleteMany({ where: { leaseId } });
      await prisma.lease.deleteMany({ where: { id: leaseId } });
    }
    if (propertyId) {
      await prisma.property.deleteMany({ where: { id: propertyId } });
    }
    const userIds = [ownerId, tenantId].filter(Boolean);
    if (userIds.length) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await prisma.onModuleDestroy();
  });

  it('deletes an account with no obligations and revokes sessions', async () => {
    await prisma.refreshToken.create({
      data: {
        userId: tenantId,
        tokenHash: `deletion-spec-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400_000),
      },
    });

    const result = await users.requestAccountDeletion(tenantId);
    expect(result.deletedAt).toBeInstanceOf(Date);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: tenantId },
    });
    expect(user.status).toBe('DELETED');
    expect(user.deletedAt).not.toBeNull();

    const live = await prisma.refreshToken.count({
      where: { userId: tenantId, revokedAt: null },
    });
    expect(live).toBe(0);
  });

  it('cancels a pending deletion', async () => {
    await users.cancelAccountDeletion(tenantId);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: tenantId },
    });
    expect(user.status).toBe('ACTIVE');
    expect(user.deletedAt).toBeNull();
  });

  it('refuses deletion while an ACTIVE lease exists', async () => {
    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 86400_000),
        monthlyRent: 100000,
        currency: 'XAF',
        deposit: 100000,
        status: 'ACTIVE',
      },
    });
    leaseId = lease.id;

    await expect(users.requestAccountDeletion(tenantId)).rejects.toMatchObject({
      response: {
        code: 'ACCOUNT_HAS_ACTIVE_OBLIGATIONS',
        details: { blockers: expect.arrayContaining([expect.stringMatching(/bail/i)]) },
      },
    });
    await expect(
      users.requestAccountDeletion(tenantId),
    ).rejects.toBeInstanceOf(ConflictException);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: tenantId },
    });
    expect(user.deletedAt).toBeNull();
    expect(user.status).toBe('ACTIVE');
  });
});
