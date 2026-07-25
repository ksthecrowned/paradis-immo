import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService.lookupByPhone', () => {
  let users: UsersService;
  let prisma: PrismaService;
  const phone = '+242068888801';
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, PrismaService],
    }).compile();
    users = moduleRef.get(UsersService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country = await prisma.country.findFirstOrThrow();
    await prisma.user.deleteMany({ where: { phone } });
    const user = await prisma.user.create({
      data: {
        phone,
        countryId: country.id,
        name: 'Lookup Tenant',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.onModuleDestroy();
  });

  it('returns id/name/phone for a registered number', async () => {
    const found = await users.lookupByPhone(phone);
    expect(found.id).toBe(userId);
    expect(found.phone).toBe(phone);
    expect(found.name).toBe('Lookup Tenant');
  });

  it('rejects invalid phone format', async () => {
    await expect(users.lookupByPhone('06000000')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws when no user matches', async () => {
    await expect(
      users.lookupByPhone('+242069999999'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
