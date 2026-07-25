import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { R2Service } from '../media/r2.service';
import { LeaseDocumentsService } from './lease-documents.service';

describe('LeaseDocumentsService', () => {
  let docs: LeaseDocumentsService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let strangerUserId: string;
  let propertyId: string;
  let orgId: string;
  let leaseId: string;
  const phones = ['+242074000001', '+242074000002', '+242074000003'];
  const fakeR2 = {
    uploadLeaseFile: jest.fn(async () => ({
      url: 'https://cdn.test/leases/x/contrat.pdf',
      key: 'leases/x/contrat.pdf',
    })),
    keyFromPublicUrl: jest.fn(() => 'leases/x/contrat.pdf'),
    deleteObject: jest.fn(async () => undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LeaseDocumentsService,
        PrismaService,
        AgencyAccessService,
        { provide: R2Service, useValue: fakeR2 },
      ],
    }).compile();
    docs = moduleRef.get(LeaseDocumentsService);
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
      await prisma.leaseDocument.deleteMany({
        where: { lease: { tenantId: { in: staleIds } } },
      });
      await prisma.lease.deleteMany({ where: { tenantId: { in: staleIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const owner = await prisma.user.create({
      data: {
        phone: phones[0],
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const tenant = await prisma.user.create({
      data: {
        phone: phones[1],
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;
    const stranger = await prisma.user.create({
      data: {
        phone: phones[2],
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    strangerUserId = stranger.id;

    const org = await prisma.organization.create({
      data: {
        name: `Lease Docs Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    orgId = org.id;
    const prop = await prisma.property.create({
      data: {
        title: 'Lease Docs Prop',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'x',
        countryId,
        ownerId: ownerUserId,
        organizationId: org.id,
      },
    });
    propertyId = prop.id;
    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        monthlyRent: 100000,
        deposit: 200000,
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });
    leaseId = lease.id;
  });

  afterAll(async () => {
    await prisma.leaseDocument.deleteMany({ where: { leaseId } });
    await prisma.lease.deleteMany({ where: { id: leaseId } });
    await prisma.property.deleteMany({ where: { id: propertyId } });
    await prisma.organizationMember.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    for (const id of [ownerUserId, tenantUserId, strangerUserId]) {
      await prisma.userRole.deleteMany({ where: { userId: id } });
      await prisma.user.deleteMany({ where: { id } });
    }
    await prisma.onModuleDestroy();
  });

  it('owner uploads and lists SIGNED_LEASE', async () => {
    const created = await docs.upload(
      ownerUserId,
      leaseId,
      {
        buffer: Buffer.from('%PDF'),
        originalname: 'bail.pdf',
        mimetype: 'application/pdf',
      },
      { type: 'SIGNED_LEASE', name: 'Bail signé' },
    );
    expect(created.type).toBe('SIGNED_LEASE');
    const list = await docs.list(ownerUserId, leaseId);
    expect(list.some((d) => d.id === created.id)).toBe(true);
  });

  it('tenant can list but cannot upload', async () => {
    const list = await docs.list(tenantUserId, leaseId);
    expect(Array.isArray(list)).toBe(true);
    await expect(
      docs.upload(
        tenantUserId,
        leaseId,
        {
          buffer: Buffer.from('%PDF'),
          originalname: 'x.pdf',
          mimetype: 'application/pdf',
        },
        { type: 'AMENDMENT' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('stranger cannot list', async () => {
    await expect(docs.list(strangerUserId, leaseId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('unknown lease 404', async () => {
    await expect(
      docs.list(ownerUserId, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
