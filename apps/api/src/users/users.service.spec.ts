import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpStore } from '../auth/otp.store';
import { AuthService } from '../auth/auth.service';
import { InfobipOtpService } from '../auth/infobip-otp.service';
import { EventPublisher } from '../events/event.publisher';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let users: UsersService;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  let auth: AuthService;
  let userId: string;
  const phone = '+242067777777';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        OtpStore,
        PrismaService,
        InfobipOtpService,
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
        {
          provide: EventPublisher,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();
    users = moduleRef.get(UsersService);
    prisma = moduleRef.get(PrismaService);
    otpStore = moduleRef.get(OtpStore);
    auth = moduleRef.get(AuthService);
    await prisma.onModuleInit();
    await otpStore.onModuleInit();

    // Provision user via the auth flow (creates TENANT role)
    await prisma.user.deleteMany({ where: { phone } }).catch(() => undefined);
    await auth.requestOtp({ phone });
    const code = await otpStore.peek(phone);
    const result = await auth.verifyOtp({ phone, code: code! });
    userId = result.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.onModuleDestroy();
    await otpStore.onModuleDestroy();
  });

  it('getMe returns the authenticated user', async () => {
    const me = await users.getMe(userId);
    expect(me.id).toBe(userId);
    expect(me.phone).toBe(phone);
    expect(me.roles).toContain('TENANT');
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

  it('listMyOrganizations returns [] when user has none', async () => {
    const orgs = await users.listMyOrganizations(userId);
    expect(orgs).toEqual([]);
  });
});
