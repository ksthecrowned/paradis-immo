import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService.resolveOrCreateByPhone', () => {
  let users: UsersService;
  let prisma: PrismaService;
  const phone = '+242068888802';
  let createdIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, PrismaService],
    }).compile();
    users = moduleRef.get(UsersService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();
    await prisma.user.deleteMany({ where: { phone } });
  });

  afterAll(async () => {
    if (createdIds.length) {
      await prisma.userRole.deleteMany({
        where: { userId: { in: createdIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.onModuleDestroy();
  });

  it('creates a TENANT profile when the phone is unknown', async () => {
    const result = await users.resolveOrCreateByPhone(phone, 'Locataire Externe');
    createdIds.push(result.id);
    expect(result.created).toBe(true);
    expect(result.phone).toBe(phone);
    expect(result.name).toBe('Locataire Externe');

    const roles = await prisma.userRole.findMany({
      where: { userId: result.id },
    });
    expect(roles.map((r) => r.role)).toContain(GlobalRole.TENANT);
  });

  it('returns the existing user without creating a duplicate', async () => {
    const again = await users.resolveOrCreateByPhone(phone, 'Autre Nom');
    expect(again.created).toBe(false);
    expect(again.name).toBe('Locataire Externe');
  });

  it('requires a name when creating', async () => {
    await expect(
      users.resolveOrCreateByPhone('+242069888803'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
