import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { StaySettingsService } from './stay-settings.service';

describe('StaySettingsService (spec 07)', () => {
  let service: StaySettingsService;
  let prisma: PrismaService;
  let countryId: string;
  let quartierId: string;
  let ownerId: string;
  let strangerId: string;
  let propertyId: string;
  const rateIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StaySettingsService,
        AgencyAccessService,
        PrismaService,
      ],
    }).compile();
    service = moduleRef.get(StaySettingsService);
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

    const stamp = Date.now();
    const owner = await prisma.user.create({
      data: {
        phone: `+24207${stamp}`.slice(0, 15),
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerId = owner.id;
    const stranger = await prisma.user.create({
      data: {
        phone: `+24206${stamp}`.slice(0, 15),
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    strangerId = stranger.id;

    const org = await prisma.organization.create({
      data: {
        name: `StaySettings Org ${stamp}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerId, role: 'OWNER' } },
      },
    });
    const prop = await prisma.property.create({
      data: {
        title: 'Stay Settings Prop',
        description: 'Spec 07 settings',
        type: 'APARTMENT',
        mode: 'RENT_SHORT',
        price: 25000,
        currency: 'XAF',
        priceUnit: 'NIGHT',
        quartierId,
        address: 'X',
        countryId,
        ownerId,
        organizationId: org.id,
      },
    });
    propertyId = prop.id;
  });

  afterAll(async () => {
    if (rateIds.length) {
      await prisma.seasonalRate
        .deleteMany({ where: { id: { in: rateIds } } })
        .catch(() => undefined);
    }
    const ids = [ownerId, strangerId].filter(Boolean);
    if (propertyId) {
      await prisma.stayListingSettings
        .deleteMany({ where: { propertyId } })
        .catch(() => undefined);
      await prisma.seasonalRate
        .deleteMany({ where: { propertyId } })
        .catch(() => undefined);
      await prisma.property.deleteMany({ where: { id: propertyId } }).catch(() => undefined);
    }
    if (ids.length) {
      await prisma.organizationMember
        .deleteMany({ where: { userId: { in: ids } } })
        .catch(() => undefined);
      await prisma.organization
        .deleteMany({ where: { members: { some: { userId: { in: ids } } } } })
        .catch(() => undefined);
      await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    }
    await prisma.onModuleDestroy();
  });

  it('refuses an unrelated user on write', async () => {
    await expect(
      service.upsertSettings(strangerId, propertyId, {
        baseNightlyRate: 20000,
      }),
    ).rejects.toMatchObject({
      response: { code: 'NOT_ASSIGNED_AGENT' },
    });
  });

  it('refuses unrelated users from reading stay settings and seasonal rates', async () => {
    await expect(
      service.getSettings(strangerId, propertyId),
    ).rejects.toMatchObject({
      response: { code: 'NOT_ASSIGNED_AGENT' },
    });
    await expect(
      service.listSeasonalRates(strangerId, propertyId),
    ).rejects.toMatchObject({
      response: { code: 'NOT_ASSIGNED_AGENT' },
    });
  });

  it('upserts the settings and returns decimals as strings', async () => {
    const created = await service.upsertSettings(ownerId, propertyId, {
      baseNightlyRate: 25000,
      cleaningFee: 5000,
      extraGuestFee: 2000,
      serviceFeeRate: 0.07,
      cancellationPolicy: 'STRICT',
      depositMode: 'COLLECT_ON_BOOKING',
      depositAmount: 10000,
      checkInFrom: '15:00',
      checkOutBefore: '10:00',
      houseRules: 'Pas de fêtes',
    });
    expect(created.baseNightlyRate).toBe('25000');
    expect(created.cancellationPolicy).toBe('STRICT');
    expect(created.checkInFrom).toBe('15:00');
    expect(created.houseRules).toBe('Pas de fêtes');

    const updated = await service.upsertSettings(ownerId, propertyId, {
      cleaningFee: 0,
    });
    expect(updated.cleaningFee).toBe('0');
    expect(updated.baseNightlyRate).toBe('25000');

    const fetched = await service.getSettings(ownerId, propertyId);
    expect(fetched.depositMode).toBe('COLLECT_ON_BOOKING');
  });

  it('rejects baseGuests > maxGuests', async () => {
    await expect(
      service.upsertSettings(ownerId, propertyId, {
        baseGuests: 4,
        maxGuests: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates, lists, updates and deletes seasonal rates; forbids overlap', async () => {
    const rate = await service.createSeasonalRate(ownerId, propertyId, {
      startDate: new Date('2026-12-20T00:00:00Z'),
      endDate: new Date('2027-01-05T00:00:00Z'),
      nightlyRate: 40000,
      minNights: 3,
      label: 'Fêtes',
    });
    rateIds.push(rate.id);
    expect(rate.nightlyRate).toBe('40000');
    expect(rate.label).toBe('Fêtes');

    // Overlap refused.
    await expect(
      service.createSeasonalRate(ownerId, propertyId, {
        startDate: new Date('2026-12-24T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
        nightlyRate: 50000,
      }),
    ).rejects.toMatchObject({
      response: { code: 'SEASONAL_RATE_OVERLAP' },
    });

    const updated = await service.updateSeasonalRate(
      ownerId,
      propertyId,
      rate.id,
      { nightlyRate: 45000, label: 'Noël' },
    );
    expect(updated.nightlyRate).toBe('45000');
    expect(updated.label).toBe('Noël');

    const list = await service.listSeasonalRates(ownerId, propertyId);
    expect(list.map((r) => r.id)).toContain(rate.id);

    await service.deleteSeasonalRate(ownerId, propertyId, rate.id);
    rateIds.length = 0;
    const after = await service.listSeasonalRates(ownerId, propertyId);
    expect(after.map((r) => r.id)).not.toContain(rate.id);
  });
});
