import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let svc: FavoritesService;
  let prisma: PrismaService;

  const userId = 'user_fav_test';
  const propertyId = 'prop_fav_test';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [FavoritesService, PrismaService],
    }).compile();
    svc = moduleRef.get(FavoritesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findFirstOrThrow();
    const city = await prisma.city.findFirstOrThrow({ where: { countryId: cg.id } });
    const arr = await prisma.arrondissement.findFirstOrThrow({
      where: { cityId: city.id },
    });
    const quartier = await prisma.quartier.findFirstOrThrow({
      where: { arrondissementId: arr.id },
    });

    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        phone: '+242060000099',
        countryId: cg.id,
        name: 'Fav Test',
      },
      update: {},
    });

    await prisma.property.upsert({
      where: { id: propertyId },
      create: {
        id: propertyId,
        ownerId: userId,
        organizationId: (
          await prisma.organization.findFirstOrThrow({ where: { countryId: cg.id } })
        ).id,
        title: 'Fav test property',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        status: 'ACTIVE',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'test',
        countryId: cg.id,
      },
      update: { title: 'Fav test property' },
    });
  });

  afterAll(async () => {
    await prisma.favorite.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.property.deleteMany({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('adds, lists and removes a favorite', async () => {
    const created = await svc.add(userId, propertyId);
    expect(created.propertyId).toBe(propertyId);

    const list = await svc.list(userId);
    expect(list.some((f) => f.propertyId === propertyId)).toBe(true);

    await svc.remove(userId, propertyId);
    const after = await svc.list(userId);
    expect(after.some((f) => f.propertyId === propertyId)).toBe(false);
  });

  it('rejects duplicate favorites', async () => {
    await svc.add(userId, propertyId);
    await expect(svc.add(userId, propertyId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await svc.remove(userId, propertyId);
  });

  it('throws when property is missing', async () => {
    await expect(svc.add(userId, 'missing-prop')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws when removing unknown favorite', async () => {
    await expect(svc.remove(userId, propertyId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
