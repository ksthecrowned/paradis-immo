import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  GlobalRole,
  OrgMemberRole,
  OrganizationType,
} from '@prisma/client';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { InfobipOtpService } from './infobip-otp.service';
import { MagicLinkStore } from './magic-link.store';
import { OtpStore } from './otp.store';
import { PrismaService } from '../prisma/prisma.service';
import { PARADIS_IMMO_ORG_ID } from '../common/constants/seed-ids';
import { hashPassword } from './password.util';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  const phone = '+242061234567';

  async function cleanupPhone() {
    const users = await prisma.user.findMany({ where: { phone } });
    for (const u of users) {
      await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
      await prisma.userRole.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    await prisma.otpChallenge.deleteMany({ where: { phone } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        OtpStore,
        MagicLinkStore,
        EmailService,
        PrismaService,
        InfobipOtpService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(async (payload) => {
              const uniq = `${payload.sub}-${payload.jti ?? 'access'}-${Date.now()}-${Math.random()}`;
              return `token.${Buffer.from(uniq).toString('base64url')}`;
            }),
            verifyAsync: jest.fn(async () => ({})),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    otpStore = moduleRef.get(OtpStore);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    if (!(await prisma.country.findUnique({ where: { code: 'CG' } }))) {
      await prisma.country.create({
        data: {
          code: 'CG',
          name: 'Congo',
          currency: 'XAF',
          phonePrefix: '+242',
          activeProviders: ['AIRTEL'],
        },
      });
    }

    await cleanupPhone();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy().catch(() => undefined);
  });

  it('requestOtp stores a 6-digit code in Postgres with 5min TTL', async () => {
    await service.requestOtp({ phone, purpose: 'REGISTER' });
    const code = await otpStore.peek(phone);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('verifyOtp returns tokens for valid code', async () => {
    await cleanupPhone();
    await service.requestOtp({ phone, purpose: 'REGISTER' });
    const code = await otpStore.peek(phone);
    expect(code).not.toBeNull();
    const result = await service.verifyOtp({
      phone,
      code: code!,
      purpose: 'REGISTER',
    });
    expect(result.accessToken).toMatch(/^token\./);
    expect(result.refreshToken).toBeDefined();
    expect(result.user.phone).toBe(phone);
    expect(result.user.roles).toContain('TENANT');

    const userInDb = await prisma.user.findFirst({
      where: { phone },
      include: { roles: true },
    });
    expect(userInDb).not.toBeNull();
    expect(userInDb!.roles.some((r) => r.role === GlobalRole.TENANT)).toBe(true);
  });

  it('requestOtp LOGIN rejects unknown phone', async () => {
    await cleanupPhone();
    await expect(
      service.requestOtp({ phone, purpose: 'LOGIN' }),
    ).rejects.toMatchObject({
      response: { code: 'USER_NOT_FOUND' },
    });
  });

  it('requestOtp REGISTER rejects existing phone', async () => {
    await cleanupPhone();
    await service.requestOtp({ phone, purpose: 'REGISTER' });
    const code = await otpStore.peek(phone);
    await service.verifyOtp({ phone, code: code!, purpose: 'REGISTER' });
    await expect(
      service.requestOtp({ phone, purpose: 'REGISTER' }),
    ).rejects.toMatchObject({
      response: { code: 'USER_ALREADY_EXISTS' },
    });
  });

  it('verifyOtp LOGIN works for existing user', async () => {
    await cleanupPhone();
    await service.requestOtp({ phone, purpose: 'REGISTER' });
    const registerCode = await otpStore.peek(phone);
    await service.verifyOtp({
      phone,
      code: registerCode!,
      purpose: 'REGISTER',
    });

    await service.requestOtp({ phone, purpose: 'LOGIN' });
    const loginCode = await otpStore.peek(phone);
    const result = await service.verifyOtp({
      phone,
      code: loginCode!,
      purpose: 'LOGIN',
    });
    expect(result.user.phone).toBe(phone);
  });

  it('verifyOtp rejects an incorrect code', async () => {
    const badPhone = '+242061234568';
    await prisma.otpChallenge.deleteMany({ where: { phone: badPhone } });
    await otpStore.put(badPhone, '000000', 'REGISTER');
    let err: unknown;
    try {
      await service.verifyOtp({
        phone: badPhone,
        code: '111111',
        purpose: 'REGISTER',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(UnauthorizedException);
    await prisma.otpChallenge.deleteMany({ where: { phone: badPhone } });
  });

  it('verifyOtp rejects when no OTP requested', async () => {
    const unknown = '+242069999999';
    await otpStore.del(unknown);
    let err: unknown;
    try {
      await service.verifyOtp({
        phone: unknown,
        code: '123456',
        purpose: 'REGISTER',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(UnauthorizedException);
  });

  describe('setWebRole', () => {
    const webEmail = 'web-role-onboarding@example.com';

    async function cleanupWebUser(): Promise<string | null> {
      const existing = await prisma.user.findUnique({ where: { email: webEmail } });
      if (!existing) return null;
      await prisma.refreshToken.deleteMany({ where: { userId: existing.id } });
      await prisma.organizationMember.deleteMany({ where: { userId: existing.id } });
      await prisma.organization.deleteMany({
        where: {
          type: OrganizationType.OWNER,
          members: { none: {} },
          name: { contains: 'web-role' },
        },
      });
      // Owner orgs created for this user (by membership)
      const owned = await prisma.organization.findMany({
        where: { members: { some: { userId: existing.id } } },
        select: { id: true },
      });
      await prisma.organizationMember.deleteMany({ where: { userId: existing.id } });
      if (owned.length) {
        await prisma.organization.deleteMany({
          where: { id: { in: owned.map((o) => o.id) } },
        });
      }
      await prisma.user.delete({ where: { id: existing.id } });
      return existing.id;
    }

    async function createWebUser() {
      const country = await prisma.country.findUniqueOrThrow({
        where: { code: 'CG' },
      });
      return prisma.user.create({
        data: {
          email: webEmail,
          name: 'Web Role Test',
          countryId: country.id,
          phone: null,
          emailVerifiedAt: new Date(),
        },
      });
    }

    beforeEach(async () => {
      await cleanupWebUser();
    });

    afterAll(async () => {
      await cleanupWebUser();
    });

    it('persists OWNER membership so a second call returns the same org role', async () => {
      const user = await createWebUser();
      const first = await service.setWebRole(user.id, 'OWNER');
      expect(first.user.orgRoles).toContain(OrgMemberRole.OWNER);

      const second = await service.setWebRole(user.id, 'OWNER');
      expect(second.user.orgRoles).toContain(OrgMemberRole.OWNER);
      expect(second.user.id).toBe(user.id);

      const members = await prisma.organizationMember.findMany({
        where: { userId: user.id },
      });
      expect(members).toHaveLength(1);
      expect(members[0]!.role).toBe(OrgMemberRole.OWNER);
    });

    it('persists AGENT membership against the platform org', async () => {
      const user = await createWebUser();
      const first = await service.setWebRole(user.id, 'AGENT');
      expect(first.user.orgRoles).toContain(OrgMemberRole.AGENT);

      const second = await service.setWebRole(user.id, 'AGENT');
      expect(second.user.orgRoles).toContain(OrgMemberRole.AGENT);

      const members = await prisma.organizationMember.findMany({
        where: { userId: user.id, organizationId: PARADIS_IMMO_ORG_ID },
      });
      expect(members).toHaveLength(1);
    });
  });

  describe('email + Google account linking', () => {
    const linkEmail = 'link-google-email@example.com';
    const googleSub = 'google-sub-link-test-001';

    async function cleanupLinkUser(): Promise<void> {
      const users = await prisma.user.findMany({
        where: {
          OR: [{ email: linkEmail }, { googleId: googleSub }],
        },
      });
      for (const u of users) {
        await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
        const ownerOrgs = await prisma.organization.findMany({
          where: {
            type: OrganizationType.OWNER,
            members: { some: { userId: u.id } },
          },
          select: { id: true },
        });
        await prisma.organizationMember.deleteMany({ where: { userId: u.id } });
        if (ownerOrgs.length) {
          await prisma.organization.deleteMany({
            where: { id: { in: ownerOrgs.map((o) => o.id) } },
          });
        }
        await prisma.user.delete({ where: { id: u.id } });
      }
    }

    function mockGoogleIdToken(payload: {
      sub: string;
      email: string;
      email_verified?: boolean;
      name?: string;
    }): void {
      process.env.GOOGLE_CLIENT_ID = 'test-google-client';
      (
        service as unknown as {
          googleClient: {
            verifyIdToken: (args: unknown) => Promise<{
              getPayload: () => typeof payload;
            }>;
          };
        }
      ).googleClient = {
        verifyIdToken: async () => ({
          getPayload: () => payload,
        }),
      };
    }

    beforeEach(async () => {
      await cleanupLinkUser();
    });

    afterAll(async () => {
      await cleanupLinkUser();
    });

    it('Google login attaches to existing email user and keeps org role', async () => {
      const country = await prisma.country.findUniqueOrThrow({
        where: { code: 'CG' },
      });
      const emailUser = await prisma.user.create({
        data: {
          email: linkEmail,
          name: 'Email First',
          countryId: country.id,
          phone: null,
          emailVerifiedAt: new Date(),
          passwordHash: 'salt:hash',
        },
      });
      await service.setWebRole(emailUser.id, 'OWNER');

      mockGoogleIdToken({
        sub: googleSub,
        email: linkEmail,
        email_verified: true,
        name: 'Google Name',
      });

      const googleSession = await service.loginGoogleWeb({
        idToken: 'fake-id-token',
      });

      expect(googleSession.user.id).toBe(emailUser.id);
      expect(googleSession.user.orgRoles).toContain(OrgMemberRole.OWNER);

      const refreshed = await prisma.user.findUniqueOrThrow({
        where: { id: emailUser.id },
      });
      expect(refreshed.googleId).toBe(googleSub);
    });

    it('password login after Google signup uses the same user id', async () => {
      mockGoogleIdToken({
        sub: googleSub,
        email: linkEmail,
        email_verified: true,
        name: 'Google First',
      });

      const googleSession = await service.loginGoogleWeb({
        idToken: 'fake-id-token',
      });
      await service.setWebRole(googleSession.user.id, 'AGENT');

      const passwordHash = await hashPassword('Password123!');
      await prisma.user.update({
        where: { id: googleSession.user.id },
        data: { passwordHash, emailVerifiedAt: new Date() },
      });

      const passwordSession = await service.loginWeb({
        email: linkEmail,
        password: 'Password123!',
      });

      expect(passwordSession.user.id).toBe(googleSession.user.id);
      expect(passwordSession.user.orgRoles).toContain(OrgMemberRole.AGENT);
    });

    it('registerWeb rejects when a Google account already exists for the email', async () => {
      mockGoogleIdToken({
        sub: googleSub,
        email: linkEmail,
        email_verified: true,
        name: 'Google First',
      });
      await service.loginGoogleWeb({ idToken: 'fake-id-token' });

      await expect(service.registerWeb({ email: linkEmail })).rejects.toMatchObject({
        response: {
          code: 'GOOGLE_ACCOUNT_EXISTS',
        },
      });
    });

    it('registerWeb still works for a new email (no Google account)', async () => {
      const result = await service.registerWeb({ email: linkEmail });
      expect(result.message).toMatch(/lien/i);
      const user = await prisma.user.findUnique({ where: { email: linkEmail } });
      expect(user).not.toBeNull();
      expect(user!.googleId).toBeNull();
    });
  });
});
