import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { UsersService } from '../users/users.service';
import { SaleAgreementsService } from './sale-agreements.service';

describe('SaleAgreementsService', () => {
  let svc: SaleAgreementsService;
  let prisma: PrismaService;

  let countryId: string;
  let quartierId: string;
  let ownerUserId: string;
  let buyerUserId: string;
  let strangerUserId: string;
  let orgId: string;
  let propertyId: string;
  let inquiryId: string;
  const phones = ['+242074000001', '+242074000002', '+242074000003'];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SaleAgreementsService,
        PrismaService,
        AgencyAccessService,
        UsersService,
      ],
    }).compile();
    svc = moduleRef.get(SaleAgreementsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    quartierId = quartier.id;

    const stale = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.saleInstallment.deleteMany({
        where: { agreement: { buyerId: { in: staleIds } } },
      });
      await prisma.saleAgreement.deleteMany({
        where: {
          OR: [
            { buyerId: { in: staleIds } },
            { property: { ownerId: { in: staleIds } } },
          ],
        },
      });
      await prisma.saleInquiry.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.property.deleteMany({ where: { ownerId: { in: staleIds } } });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const owner = await prisma.user.create({
      data: {
        phone: phones[0],
        name: 'Owner Sale',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;

    const buyer = await prisma.user.create({
      data: {
        phone: phones[1],
        name: 'Buyer Sale',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    buyerUserId = buyer.id;

    const stranger = await prisma.user.create({
      data: {
        phone: phones[2],
        name: 'Stranger Sale',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    strangerUserId = stranger.id;

    const org = await prisma.organization.create({
      data: {
        name: `Sale Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    orgId = org.id;

    const prop = await prisma.property.create({
      data: {
        title: 'Villa Sale Spec',
        description: 'x',
        type: 'HOUSE',
        mode: 'SALE',
        status: 'ACTIVE',
        price: 10_000_000,
        currency: 'XAF',
        priceUnit: 'TOTAL',
        quartierId,
        address: 'x',
        countryId,
        ownerId: ownerUserId,
        organizationId: orgId,
        listingStatus: 'AVAILABLE',
      },
    });
    propertyId = prop.id;

    const inquiry = await prisma.saleInquiry.create({
      data: {
        propertyId,
        userId: buyerUserId,
        message: 'intéressé',
        status: 'NEW',
      },
    });
    inquiryId = inquiry.id;
  });

  afterEach(async () => {
    await prisma.saleInstallment.deleteMany({
      where: { agreement: { propertyId } },
    });
    await prisma.saleAgreement.deleteMany({ where: { propertyId } });
    await prisma.property.update({
      where: { id: propertyId },
      data: { listingStatus: 'AVAILABLE' },
    });
    await prisma.saleInquiry.update({
      where: { id: inquiryId },
      data: { status: 'NEW' },
    });
  });

  afterAll(async () => {
    await prisma.saleInstallment.deleteMany({
      where: { agreement: { propertyId } },
    });
    await prisma.saleAgreement.deleteMany({ where: { propertyId } });
    await prisma.saleInquiry.deleteMany({ where: { id: inquiryId } });
    await prisma.property.deleteMany({ where: { id: propertyId } });
    await prisma.organizationMember.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, buyerUserId, strangerUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerUserId, buyerUserId, strangerUserId] } },
    });
    await prisma.onModuleDestroy();
  });

  const baseInstallments = [
    { label: 'Apport', dueDate: new Date('2026-08-01'), amount: 3_000_000 },
    { label: 'Solde', dueDate: new Date('2026-09-01'), amount: 7_000_000 },
  ];

  it('creates a DRAFT agreement manually', async () => {
    const created = await svc.create(ownerUserId, {
      propertyId,
      buyerPhone: phones[1]!,
      buyerName: 'Buyer Sale',
      agreedPrice: 10_000_000,
      currency: 'XAF',
      installments: baseInstallments,
    });
    expect(created.status).toBe('DRAFT');
    expect(created.installments).toHaveLength(2);
    expect(created.buyerId).toBe(buyerUserId);
  });

  it('rejects installment sum mismatch', async () => {
    await expect(
      svc.create(ownerUserId, {
        propertyId,
        buyerPhone: phones[1]!,
        agreedPrice: 10_000_000,
        currency: 'XAF',
        installments: [
          { dueDate: new Date('2026-08-01'), amount: 1_000_000 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates from sale inquiry and activates to UNDER_OFFER', async () => {
    const created = await svc.create(ownerUserId, {
      propertyId,
      saleInquiryId: inquiryId,
      agreedPrice: 10_000_000,
      currency: 'XAF',
      installments: baseInstallments,
    });
    expect(created.saleInquiryId).toBe(inquiryId);
    expect(created.buyerId).toBe(buyerUserId);

    const active = await svc.activate(ownerUserId, created.id);
    expect(active.status).toBe('ACTIVE');
    const prop = await prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
    });
    expect(prop.listingStatus).toBe('UNDER_OFFER');
    const inquiry = await prisma.saleInquiry.findUniqueOrThrow({
      where: { id: inquiryId },
    });
    expect(inquiry.status).toBe('CLOSED');
  });

  it('allows two ACTIVE agreements on same property', async () => {
    const a = await svc.create(ownerUserId, {
      propertyId,
      buyerPhone: phones[1]!,
      agreedPrice: 10_000_000,
      currency: 'XAF',
      installments: baseInstallments,
    });
    await svc.activate(ownerUserId, a.id);

    const otherBuyer = await prisma.user.create({
      data: {
        phone: `+24207400${Date.now().toString().slice(-6)}`,
        name: 'Other Buyer',
        countryId,
      },
    });
    const b = await svc.create(ownerUserId, {
      propertyId,
      buyerPhone: otherBuyer.phone!,
      buyerName: 'Other Buyer',
      agreedPrice: 10_000_000,
      currency: 'XAF',
      installments: baseInstallments,
    });
    await svc.activate(ownerUserId, b.id);
    const list = await svc.listManaged(ownerUserId);
    expect(list.filter((x) => x.status === 'ACTIVE')).toHaveLength(2);

    await prisma.saleInstallment.deleteMany({
      where: { agreementId: b.id },
    });
    await prisma.saleAgreement.delete({ where: { id: b.id } });
    await prisma.user.delete({ where: { id: otherBuyer.id } });
  });

  it('rejects PATCH after ACTIVE', async () => {
    const created = await svc.create(ownerUserId, {
      propertyId,
      buyerPhone: phones[1]!,
      agreedPrice: 10_000_000,
      currency: 'XAF',
      installments: baseInstallments,
    });
    await svc.activate(ownerUserId, created.id);
    await expect(
      svc.updateDraft(ownerUserId, created.id, { agreedPrice: 9_000_000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects stranger manager', async () => {
    await expect(
      svc.create(strangerUserId, {
        propertyId,
        buyerPhone: phones[1]!,
        agreedPrice: 10_000_000,
        currency: 'XAF',
        installments: baseInstallments,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
