import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { R2Service } from '../media/r2.service';
import { TenantDocumentsService } from './tenant-documents.service';

describe('TenantDocumentsService', () => {
  let docs: TenantDocumentsService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let strangerUserId: string;
  let propertyId: string;
  let orgId: string;
  let leaseId: string;
  const phones = ['+242073000001', '+242073000002', '+242073000003'];
  const fakeR2 = {
    uploadTenantFile: jest.fn(async () => ({
      url: 'https://cdn.test/tenants/x/doc.pdf',
      key: 'tenants/x/doc.pdf',
    })),
    keyFromPublicUrl: jest.fn(() => 'tenants/x/doc.pdf'),
    deleteObject: jest.fn(async () => undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TenantDocumentsService,
        PrismaService,
        AgencyAccessService,
        { provide: R2Service, useValue: fakeR2 },
      ],
    }).compile();
    docs = moduleRef.get(TenantDocumentsService);
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
      await prisma.tenantDocument.deleteMany({
        where: { userId: { in: staleIds } },
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
        name: 'Doc Tenant',
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
        name: `Tenant Docs Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    orgId = org.id;
    const prop = await prisma.property.create({
      data: {
        title: 'Tenant Docs Prop',
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
    await prisma.tenantDocument.deleteMany({
      where: { userId: tenantUserId },
    });
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

  it('owner uploads and lists ID_CARD for managed tenant', async () => {
    const created = await docs.upload(
      ownerUserId,
      tenantUserId,
      {
        buffer: Buffer.from('%PDF-1.4'),
        originalname: 'cni.pdf',
        mimetype: 'application/pdf',
      },
      { type: 'ID_CARD', name: 'CNI' },
    );
    expect(created.type).toBe('ID_CARD');
    expect(created.name).toBe('CNI');
    const list = await docs.listForManagedTenant(ownerUserId, tenantUserId);
    expect(list.some((d) => d.id === created.id)).toBe(true);
  });

  it('stranger cannot upload', async () => {
    await expect(
      docs.upload(
        strangerUserId,
        tenantUserId,
        {
          buffer: Buffer.from('%PDF'),
          originalname: 'x.pdf',
          mimetype: 'application/pdf',
        },
        { type: 'PASSPORT' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('tenant listMine returns only own docs', async () => {
    const mine = await docs.listMine(tenantUserId);
    expect(mine.every((d) => d.userId === tenantUserId)).toBe(true);
    expect(mine.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects non pdf/image', async () => {
    await expect(
      docs.upload(
        ownerUserId,
        tenantUserId,
        {
          buffer: Buffer.from('x'),
          originalname: 'x.bin',
          mimetype: 'application/octet-stream',
        },
        { type: 'OTHER_ID' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
