import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { OrgMemberRole } from '@prisma/client';
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
      await prisma.rateLimitCounter.deleteMany({
        where: { key: { startsWith: `lookup:user:${userId}` } },
      });
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

describe('UsersService.lookupForManager (spec 01)', () => {
  let users: UsersService;
  let prisma: PrismaService;
  const targetPhone = '+242068888810';
  const managerPhone = '+242068888811';
  const outsiderPhone = '+242068888812';
  let targetId: string;
  let managerId: string;
  let outsiderId: string;
  let orgId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, PrismaService],
    }).compile();
    users = moduleRef.get(UsersService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country = await prisma.country.findFirstOrThrow();
    const phones = [targetPhone, managerPhone, outsiderPhone];
    await prisma.user.deleteMany({ where: { phone: { in: phones } } });

    const target = await prisma.user.create({
      data: { phone: targetPhone, countryId: country.id, name: 'Jean Mbemba' },
    });
    targetId = target.id;

    const manager = await prisma.user.create({
      data: { phone: managerPhone, countryId: country.id },
    });
    managerId = manager.id;

    const outsider = await prisma.user.create({
      data: { phone: outsiderPhone, countryId: country.id },
    });
    outsiderId = outsider.id;

    const org = await prisma.organization.create({
      data: {
        name: `Lookup Spec 01 ${Date.now()}`,
        type: 'AGENCY',
        affiliationStatus: 'APPROVED',
        countryId: country.id,
        members: {
          create: { userId: managerId, role: OrgMemberRole.AGENT },
        },
      },
    });
    orgId = org.id;
  });

  afterAll(async () => {
    await prisma.rateLimitCounter.deleteMany({
      where: {
        key: {
          in: [
            `lookup:user:${managerId}`,
            `lookup:user:${outsiderId}`,
          ],
        },
      },
    });
    await prisma.organizationMember.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({
      where: { id: { in: [targetId, managerId, outsiderId] } },
    });
    await prisma.onModuleDestroy();
  });

  it('rejects a user without any organization membership (403)', async () => {
    await expect(
      users.lookupForManager(outsiderId, targetPhone),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a masked name for an org member', async () => {
    const found = await users.lookupForManager(managerId, targetPhone);
    expect(found).toEqual({
      exists: true,
      userId: targetId,
      displayName: 'Jean M.',
      phone: targetPhone,
    });
    // Never leak the full name, email or avatar.
    expect(JSON.stringify(found)).not.toContain('Mbemba');
  });

  it('answers exists:false instead of throwing for an unknown number', async () => {
    const found = await users.lookupForManager(managerId, '+242069999998');
    expect(found.exists).toBe(false);
    expect(found.userId).toBeNull();
    expect(found.displayName).toBeNull();
  });

  it('rate limits an org member at 20 lookups per hour', async () => {
    await prisma.rateLimitCounter.deleteMany({
      where: { key: `lookup:user:${managerId}` },
    });
    let limited: unknown = null;
    for (let i = 0; i < 21 && !limited; i++) {
      try {
        await users.lookupForManager(managerId, targetPhone);
      } catch (err) {
        limited = err;
      }
    }
    expect(limited).toBeInstanceOf(HttpException);
    expect((limited as HttpException).getStatus()).toBe(429);
  });
});
