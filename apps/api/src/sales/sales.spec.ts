import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SaleInquiryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  let sales: SalesService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let agentUserId: string;
  let buyerUserId: string;
  let salePropertyId: string;
  let rentPropertyId: string;
  let ownerOrgId: string;
  let agentOrgId: string;
  const createdInquiryIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SalesService, PrismaService],
    }).compile();
    sales = moduleRef.get(SalesService);
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

    // Belt-and-suspenders cleanup
    const userIds = (
      await prisma.user.findMany({
        where: {
          phone: { in: ['+242075555551', '+242075555552', '+242075555553'] },
        },
        select: { id: true },
      })
    ).map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.saleInquiry
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const owner = await prisma.user.create({
      data: {
        phone: '+242075555551',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const agent = await prisma.user.create({
      data: {
        phone: '+242075555552',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    agentUserId = agent.id;
    const buyer = await prisma.user.create({
      data: {
        phone: '+242075555553',
        countryId,
        name: 'Marie NGOMA',
        roles: { create: { role: 'TENANT' } },
      },
    });
    buyerUserId = buyer.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Sales Test Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;
    const agentOrg = await prisma.organization.create({
      data: {
        name: `Sales Test Agent ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: agentUserId, role: 'AGENT' } },
      },
    });
    agentOrgId = agentOrg.id;
    const saleProp = await prisma.property.create({
      data: {
        title: 'Sale Test Property',
        description: 'Villa à vendre',
        type: 'HOUSE',
        mode: 'SALE',
        price: 50_000_000,
        currency: 'XAF',
        priceUnit: 'TOTAL',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
      },
    });
    salePropertyId = saleProp.id;
    const rentProp = await prisma.property.create({
      data: {
        title: 'Rent Test Property',
        description: 'Appartement à louer',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 200_000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
      },
    });
    rentPropertyId = rentProp.id;
  });

  afterAll(async () => {
    if (createdInquiryIds.length) {
      await prisma.saleInquiry
        .deleteMany({ where: { id: { in: createdInquiryIds } } })
        .catch(() => undefined);
    }
    await prisma.saleInquiry
      .deleteMany({
        where: { userId: { in: [ownerUserId, agentUserId, buyerUserId] } },
      })
      .catch(() => undefined);
    if (salePropertyId) {
      await prisma.saleInquiry
        .deleteMany({ where: { propertyId: salePropertyId } })
        .catch(() => undefined);
      await prisma.property
        .delete({ where: { id: salePropertyId } })
        .catch(() => undefined);
    }
    if (rentPropertyId) {
      await prisma.property
        .delete({ where: { id: rentPropertyId } })
        .catch(() => undefined);
    }
    await prisma.property
      .deleteMany({
        where: { organizationId: { in: [ownerOrgId, agentOrgId] } },
      })
      .catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [ownerUserId, agentUserId, buyerUserId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [ownerOrgId, agentOrgId] } },
    });
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, agentUserId, buyerUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerUserId, agentUserId, buyerUserId] } },
    });
    await prisma.onModuleDestroy();
  });

  // Note: createdInquiryIds is NOT cleared between tests — later tests
  // (list*) rely on the IDs accumulated by earlier create* tests.

  it('creates an inquiry on a SALE property with status NEW', async () => {
    const inquiry = await sales.createInquiry({
      propertyId: salePropertyId,
      userId: buyerUserId,
      message: 'Intéressé par la villa',
    });
    createdInquiryIds.push(inquiry.id);

    expect(inquiry.status).toBe(SaleInquiryStatus.NEW);
    expect(inquiry.propertyId).toBe(salePropertyId);
    expect(inquiry.userId).toBe(buyerUserId);
  });

  it('rejects an inquiry on a non-SALE property with PROPERTY_NOT_FOR_SALE', async () => {
    await expect(
      sales.createInquiry({
        propertyId: rentPropertyId,
        userId: buyerUserId,
        message: 'Hello',
      }),
    ).rejects.toMatchObject({
      response: { code: 'PROPERTY_NOT_FOR_SALE' },
    });
  });

  it('updates inquiry status NEW → CONTACTED for the property owner', async () => {
    const created = await sales.createInquiry({
      propertyId: salePropertyId,
      userId: buyerUserId,
      message: 'Encore moi',
    });
    createdInquiryIds.push(created.id);

    const updated = await sales.updateInquiryStatus({
      inquiryId: created.id,
      actorUserId: ownerUserId,
      newStatus: SaleInquiryStatus.CONTACTED,
    });

    expect(updated.status).toBe(SaleInquiryStatus.CONTACTED);
  });

  it('rejects update from a user with no relation to the property', async () => {
    const created = await sales.createInquiry({
      propertyId: salePropertyId,
      userId: buyerUserId,
      message: 'Troisième passage',
    });
    createdInquiryIds.push(created.id);

    // The agent doesn't belong to the property's owner org, so they cannot
    // mutate the inquiry. Use a fresh user with no org membership instead.
    const stranger = await prisma.user.create({
      data: {
        phone: `+24207${Date.now().toString().slice(-8)}`,
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    try {
      await expect(
        sales.updateInquiryStatus({
          inquiryId: created.id,
          actorUserId: stranger.id,
          newStatus: SaleInquiryStatus.CONTACTED,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    } finally {
      await prisma.userRole
        .deleteMany({ where: { userId: stranger.id } })
        .catch(() => undefined);
      await prisma.user
        .delete({ where: { id: stranger.id } })
        .catch(() => undefined);
    }
  });

  it('lists inquiries for the managed properties of an actor', async () => {
    const list = await sales.listInquiriesForManager(ownerUserId);
    const ours = list.filter((i) => createdInquiryIds.includes(i.id));
    expect(ours.length).toBeGreaterThanOrEqual(1);
    expect(ours.every((i) => i.propertyId === salePropertyId)).toBe(true);
  });

  it('lists inquiries submitted by a buyer', async () => {
    const mine = await sales.listInquiriesForBuyer(buyerUserId);
    const tracked = mine.filter((i) => createdInquiryIds.includes(i.id));
    expect(tracked.length).toBeGreaterThanOrEqual(1);
    expect(tracked.every((i) => i.userId === buyerUserId)).toBe(true);
  });
});
