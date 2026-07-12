import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpStore } from '../auth/otp.store';
import { AuthService } from '../auth/auth.service';
import { InfobipOtpService } from '../auth/infobip-otp.service';
import { MessagingBillingService } from '../messaging/messaging-billing.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let users: UsersService;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  let auth: AuthService;
  let userId: string;
  const phone = '+242067777777';

  beforeAll(async () => {
    process.env.USD_TO_XAF = process.env.USD_TO_XAF || '600';

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        OtpStore,
        PrismaService,
        InfobipOtpService,
        MessagingBillingService,
        UsersService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(
              async (payload) =>
                `token.${Buffer.from(
                  `${payload.sub}-${payload.jti ?? 'access'}-${Date.now()}-${Math.random()}`,
                ).toString('base64url')}`,
            ),
            verifyAsync: jest.fn(async () => ({})),
          },
        },
      ],
    }).compile();
    users = moduleRef.get(UsersService);
    prisma = moduleRef.get(PrismaService);
    otpStore = moduleRef.get(OtpStore);
    auth = moduleRef.get(AuthService);
    await prisma.onModuleInit();

    await prisma.messageCharge
      .deleteMany({ where: { recipientPhone: phone } })
      .catch(() => undefined);
    await prisma.user.deleteMany({ where: { phone } }).catch(() => undefined);
    await auth.requestOtp({ phone });
    const code = await otpStore.peek(phone);
    const result = await auth.verifyOtp({ phone, code: code! });
    userId = result.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.messageCharge
        .deleteMany({
          where: { OR: [{ userId }, { payerId: userId }] },
        })
        .catch(() => undefined);
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.onModuleDestroy();
  });

  it('getMe returns the authenticated user', async () => {
    const me = await users.getMe(userId);
    expect(me.id).toBe(userId);
    expect(me.phone).toBe(phone);
    expect(me.roles).toContain('TENANT');
    expect(me.notificationChannel).toBe('PUSH');
  });

  it('getMe throws 404 for unknown user', async () => {
    await expect(users.getMe('usr_does_not_exist')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updateMe patches name and avatarUrl', async () => {
    const updated = await users.updateMe(userId, {
      name: 'Jean Test',
      avatarUrl: 'https://cdn.example.com/avatars/jean.png',
    });
    expect(updated.name).toBe('Jean Test');
    expect(updated.avatarUrl).toBe('https://cdn.example.com/avatars/jean.png');
  });

  it('updateMe patches email', async () => {
    const updated = await users.updateMe(userId, {
      email: 'jean@example.com',
    });
    expect(updated.email).toBe('jean@example.com');
  });

  it('updateMe patches notificationChannel to SMS', async () => {
    const updated = await users.updateMe(userId, {
      notificationChannel: 'SMS',
    });
    expect(updated.notificationChannel).toBe('SMS');
    const again = await users.getMe(userId);
    expect(again.notificationChannel).toBe('SMS');
  });

  it('listMyOrganizations returns [] when user has none', async () => {
    const orgs = await users.listMyOrganizations(userId);
    expect(orgs).toEqual([]);
  });

  it('updateMe patches seeker prefs and completeSeekerSetup', async () => {
    const q = await prisma.quartier.findFirst({
      where: { name: 'Poto-Poto-Centre' },
    });
    expect(q).toBeTruthy();

    const updated = await users.updateMe(userId, {
      seekerIntent: 'RENT',
      seekerExperience: 'FIRST_TIME',
      budgetMinXaf: 100_000,
      budgetMaxXaf: 250_000,
      preferredQuartierIds: [q!.id],
      completeSeekerSetup: true,
    });

    expect(updated.seekerIntent).toBe('RENT');
    expect(updated.seekerExperience).toBe('FIRST_TIME');
    expect(updated.budgetMinXaf).toBe(100_000);
    expect(updated.budgetMaxXaf).toBe(250_000);
    expect(updated.preferredQuartierIds).toEqual([q!.id]);
    expect(updated.seekerSetupCompletedAt).toBeTruthy();
  });

  it('updateMe rejects more than 3 preferredQuartierIds', async () => {
    await expect(
      users.updateMe(userId, {
        preferredQuartierIds: ['a', 'b', 'c', 'd'],
      }),
    ).rejects.toThrow();
  });

  it('updateMe rejects budgetMin > budgetMax', async () => {
    await expect(
      users.updateMe(userId, {
        budgetMinXaf: 500_000,
        budgetMaxXaf: 100_000,
      }),
    ).rejects.toThrow();
  });
});
