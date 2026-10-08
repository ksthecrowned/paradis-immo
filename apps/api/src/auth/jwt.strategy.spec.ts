import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy account status (spec 01)', () => {
  let strategy: JwtStrategy;
  let prisma: PrismaService;
  let activeId: string;
  let suspendedId: string;
  let deletedId: string;
  const created: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [JwtStrategy, PrismaService],
    }).compile();
    strategy = moduleRef.get(JwtStrategy);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country = await prisma.country.findFirstOrThrow();
    async function make(status: 'ACTIVE' | 'SUSPENDED' | 'DELETED') {
      const user = await prisma.user.create({
        data: {
          phone: `+2420699${Math.floor(Math.random() * 90000 + 10000)}`,
          countryId: country.id,
          status,
        },
      });
      created.push(user.id);
      return user.id;
    }
    activeId = await make('ACTIVE');
    suspendedId = await make('SUSPENDED');
    deletedId = await make('DELETED');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    await prisma.onModuleDestroy();
  });

  it('lets an ACTIVE account through', async () => {
    await expect(
      strategy.validate({ sub: activeId, roles: ['TENANT'] }),
    ).resolves.toEqual({ userId: activeId, roles: ['TENANT'] });
  });

  it('rejects a SUSPENDED account with 403 ACCOUNT_SUSPENDED', async () => {
    await expect(
      strategy.validate({ sub: suspendedId, roles: ['TENANT'] }),
    ).rejects.toMatchObject({
      response: { code: 'ACCOUNT_SUSPENDED' },
    });
    await expect(
      strategy.validate({ sub: suspendedId, roles: ['TENANT'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a DELETED account', async () => {
    await expect(
      strategy.validate({ sub: deletedId, roles: ['TENANT'] }),
    ).rejects.toMatchObject({
      response: { code: 'ACCOUNT_DELETED' },
    });
  });

  it('tolerates a token for a user that no longer exists', async () => {
    await expect(
      strategy.validate({
        sub: '00000000-0000-0000-0000-000000000000',
        roles: ['TENANT'],
      }),
    ).resolves.toMatchObject({ roles: ['TENANT'] });
  });
});
