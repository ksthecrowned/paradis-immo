import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { MandateRenewalProcessor } from './processors/mandate-renewal.processor';

describe('MandateRenewalProcessor (spec 03 — fin de mandat)', () => {
  let processor: MandateRenewalProcessor;
  let prisma: PrismaService;
  // Persists rows like the real service — the dedup logic reads them back.
  const send = jest.fn(
    async (input: {
      userId: string;
      type: string;
      payload: Record<string, unknown>;
    }) => {
      await prisma.notification.create({
        data: {
          userId: input.userId,
          channel: 'PUSH',
          type: input.type,
          payload: input.payload,
        },
      });
      return { status: 'SENT' as const };
    },
  );

  let countryId: string;
  let ownerUserId: string;
  let gerantUserId: string;
  let ownerOrgId: string;
  let agencyOrgId: string;
  let propertyId: string;
  const mandateIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MandateRenewalProcessor,
        PrismaService,
        { provide: NotificationsService, useValue: { send } },
      ],
    }).compile();
    processor = moduleRef.get(MandateRenewalProcessor);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');

    await prisma.user.deleteMany({
      where: { phone: { in: ['+242072600001', '+242072600002'] } },
    });
    const owner = await prisma.user.create({
      data: { phone: '+242072600001', countryId, name: 'Renew Owner' },
    });
    ownerUserId = owner.id;
    const gerant = await prisma.user.create({
      data: { phone: '+242072600002', countryId, name: 'Renew Gérant' },
    });
    gerantUserId = gerant.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Renew Owner Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;
    const agencyOrg = await prisma.organization.create({
      data: {
        name: `Renew Agency Org ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: gerantUserId, role: 'ADMIN' } },
      },
    });
    agencyOrgId = agencyOrg.id;

    const prop = await prisma.property.create({
      data: {
        title: 'Renew Property',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'x',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrgId,
      },
    });
    propertyId = prop.id;

    // Notice period elapsed.
    const notice = await prisma.mandate.create({
      data: {
        propertyId,
        organizationId: agencyOrgId,
        status: 'TERMINATING',
        proposedById: ownerUserId,
        terminationEffectiveAt: new Date(Date.now() - 60_000),
        terminationReason: 'Fin de collaboration',
      },
    });
    mandateIds.push(notice.id);

    // Fixed term without tacit renewal, already past its end date.
    const noRenewal = await prisma.mandate.create({
      data: {
        propertyId,
        organizationId: agencyOrgId,
        status: 'ACTIVE',
        proposedById: ownerUserId,
        endDate: new Date(Date.now() - 86_400_000),
        tacitRenewal: false,
      },
    });
    mandateIds.push(noRenewal.id);

    // Tacit renewal, ending in ~45 days → J-45 alert.
    const expiring = await prisma.mandate.create({
      data: {
        propertyId,
        organizationId: agencyOrgId,
        status: 'ACTIVE',
        proposedById: ownerUserId,
        endDate: new Date(Date.now() + 45 * 86_400_000 - 60_000),
        tacitRenewal: true,
      },
    });
    mandateIds.push(expiring.id);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (mandateIds.length) {
      await prisma.mandate
        .deleteMany({ where: { id: { in: mandateIds } } })
        .catch(() => undefined);
    }
    if (propertyId) {
      await prisma.property
        .deleteMany({ where: { id: propertyId } })
        .catch(() => undefined);
    }
    const userIds = [ownerUserId, gerantUserId].filter(Boolean);
    if (userIds.length) {
      await prisma.notification
        .deleteMany({ where: { userId: { in: userIds }, type: 'MANDATE_EXPIRING' } })
        .catch(() => undefined);
      await prisma.organizationMember
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.userRole
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { id: { in: userIds } } })
        .catch(() => undefined);
    }
    const orgIds = [ownerOrgId, agencyOrgId].filter(Boolean);
    if (orgIds.length) {
      await prisma.organization
        .deleteMany({ where: { id: { in: orgIds } } })
        .catch(() => undefined);
    }
    await prisma.onModuleDestroy();
  });

  it('flips due mandates and alerts both parties once (J-45)', async () => {
    send.mockClear();
    const result = await processor.runDaily();
    expect(result.terminated).toBe(1);
    expect(result.expired).toBe(1);
    // Owner + gérant alerted about the J-45 mandate.
    expect(result.expiring).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ownerUserId,
        type: 'MANDATE_EXPIRING',
        payload: expect.objectContaining({ daysLeft: 45 }),
      }),
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: gerantUserId, type: 'MANDATE_EXPIRING' }),
    );

    const [notice, noRenewal, expiring] = mandateIds;
    const noticeRow = await prisma.mandate.findUniqueOrThrow({
      where: { id: notice },
    });
    expect(noticeRow.status).toBe('TERMINATED');
    const expiredRow = await prisma.mandate.findUniqueOrThrow({
      where: { id: noRenewal },
    });
    expect(expiredRow.status).toBe('EXPIRED');
    const expiringRow = await prisma.mandate.findUniqueOrThrow({
      where: { id: expiring },
    });
    // Tacit renewal keeps the mandate alive.
    expect(expiringRow.status).toBe('ACTIVE');

    // Second run: no duplicate alerts.
    send.mockClear();
    const again = await processor.runDaily();
    expect(again.expiring).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
