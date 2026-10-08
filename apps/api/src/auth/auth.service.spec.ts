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
import { hashPassword } from './password.util';
import { createHash } from 'node:crypto';

/** Mirrors AuthService.hash — refresh tokens are stored hashed (sha256). */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  const phone = '+242061234567';

  // Fake JWT store: signAsync records the payload so verifyAsync can hand it
  // back. Without this, refresh() would see an empty payload and the rotation
  // / replay paths could not be exercised.
  const issuedTokens = new Map<string, Record<string, unknown>>();

  async function cleanupPhone() {
    const users = await prisma.user.findMany({ where: { phone } });
    for (const u of users) {
      await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
      await prisma.userRole.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    await prisma.otpChallenge.deleteMany({ where: { phone } });
  }

  /**
   * OWNER organizations are invitation-only now (spec 02): an admin opens the
   * account. Tests that need an existing owner grant one directly.
   */
  async function grantOwnerOrg(userId: string): Promise<void> {
    const country = await prisma.country.findUniqueOrThrow({
      where: { code: 'CG' },
    });
    await prisma.organization.create({
      data: {
        name: `Owner Org ${userId.slice(0, 8)}`,
        type: OrganizationType.OWNER,
        countryId: country.id,
        members: { create: { userId, role: OrgMemberRole.OWNER } },
      },
    });
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
            signAsync: jest.fn(async (payload: Record<string, unknown>) => {
              const uniq = `${payload.sub}-${payload.jti ?? 'access'}-${Date.now()}-${Math.random()}`;
              const token = `token.${Buffer.from(uniq).toString('base64url')}`;
              issuedTokens.set(token, payload);
              return token;
            }),
            verifyAsync: jest.fn(
              async (token: string) => issuedTokens.get(token) ?? {},
            ),
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

  it('fixed OTP phone always accepts 123456 without SMS', async () => {
    const qaPhone = '+242065152373';
    await prisma.otpChallenge.deleteMany({ where: { phone: qaPhone } });
    // Never delete this user: it is the seeded QA tenant (stable UUID shared
    // by e2e specs) and carries FK-restricted rows (favorites) on shared DBs.
    const existing = await prisma.user.findFirst({ where: { phone: qaPhone } });
    const purpose: 'LOGIN' | 'REGISTER' = existing ? 'LOGIN' : 'REGISTER';

    await service.requestOtp({ phone: qaPhone, purpose });
    const stored = await otpStore.peek(qaPhone);
    expect(stored).toBe('123456');

    const result = await service.verifyOtp({
      phone: qaPhone,
      code: '123456',
      purpose,
    });
    expect(result.user.phone).toBe(qaPhone);

    await service.requestOtp({ phone: qaPhone, purpose: 'LOGIN' });
    const login = await service.verifyOtp({
      phone: qaPhone,
      code: '123456',
      purpose: 'LOGIN',
    });
    expect(login.user.phone).toBe(qaPhone);
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

    it('refuses OWNER: the owner account is opened by an admin invitation (spec 02)', async () => {
      const user = await createWebUser();
      await expect(service.setWebRole(user.id, 'OWNER')).rejects.toMatchObject({
        response: { code: 'OWNER_REQUIRES_INVITATION' },
      });

      const members = await prisma.organizationMember.findMany({
        where: { userId: user.id },
      });
      expect(members).toHaveLength(0);
    });

    it('returns existing org roles for an invited owner (idempotent)', async () => {
      const user = await createWebUser();
      await grantOwnerOrg(user.id);

      const session = await service.setWebRole(user.id, 'OWNER');
      expect(session.user.orgRoles).toContain(OrgMemberRole.OWNER);
      expect(session.user.id).toBe(user.id);

      const members = await prisma.organizationMember.findMany({
        where: { userId: user.id },
      });
      expect(members).toHaveLength(1);
      expect(members[0]!.role).toBe(OrgMemberRole.OWNER);
    });

    it('refuses AGENT: membership is never granted implicitly (spec 01)', async () => {
      const user = await createWebUser();
      await expect(service.setWebRole(user.id, 'AGENT')).rejects.toMatchObject({
        response: { code: 'AGENT_ROLE_REQUIRES_INVITATION' },
      });

      const members = await prisma.organizationMember.findMany({
        where: { userId: user.id },
      });
      expect(members).toHaveLength(0);
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
      await grantOwnerOrg(emailUser.id);

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
      // The OWNER organization is invitation-only — grant it directly so the
      // session carries orgRoles for the assertions below.
      await grantOwnerOrg(googleSession.user.id);

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
      expect(passwordSession.user.orgRoles).toContain(OrgMemberRole.OWNER);
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

  describe('OTP rate limits (spec 01)', () => {
    const limitedPhone = '+242061238888';

    async function reset(phoneToReset: string): Promise<void> {
      await prisma.otpChallenge.deleteMany({ where: { phone: phoneToReset } });
    }

    beforeAll(async () => {
      await reset(limitedPhone);
      for (const u of await prisma.user.findMany({
        where: { phone: limitedPhone },
      })) {
        await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
        await prisma.userRole.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
      }
    });

    afterAll(async () => {
      await reset(limitedPhone);
      await prisma.rateLimitCounter.deleteMany({
        where: { key: { startsWith: 'otp:ip:test-' } },
      });
    });

    it('rejects a 4th request within 15 minutes with 429 OTP_RATE_LIMITED', async () => {
      await reset(limitedPhone);
      for (let i = 0; i < 3; i++) {
        await service.requestOtp({
          phone: limitedPhone,
          purpose: 'REGISTER',
        });
        // Bypass the 60s gap: we are testing the window, not the cooldown.
        await prisma.otpChallenge.update({
          where: { phone: limitedPhone },
          data: { lastSentAt: new Date(Date.now() - 61_000) },
        });
      }

      await expect(
        service.requestOtp({ phone: limitedPhone, purpose: 'REGISTER' }),
      ).rejects.toMatchObject({
        status: 429,
        response: { code: 'OTP_RATE_LIMITED' },
      });
    });

    it('refuses a second send within 60 seconds with OTP_COOLDOWN', async () => {
      await reset(limitedPhone);
      await service.requestOtp({ phone: limitedPhone, purpose: 'REGISTER' });
      await expect(
        service.requestOtp({ phone: limitedPhone, purpose: 'REGISTER' }),
      ).rejects.toMatchObject({
        status: 429,
        response: { code: 'OTP_COOLDOWN' },
      });
    });

    it('locks the number for 30 minutes after 5 failed verifications', async () => {
      await reset(limitedPhone);
      await service.requestOtp({ phone: limitedPhone, purpose: 'REGISTER' });

      for (let i = 0; i < 5; i++) {
        await expect(
          service.verifyOtp({
            phone: limitedPhone,
            code: '000000',
            purpose: 'REGISTER',
          }),
        ).rejects.toMatchObject({ response: { code: 'OTP_INVALID' } });
      }

      const row = await prisma.otpChallenge.findUnique({
        where: { phone: limitedPhone },
      });
      expect(row!.attempts).toBe(5);
      expect(row!.lockedUntil).not.toBeNull();
      expect(row!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

      await expect(
        service.requestOtp({ phone: limitedPhone, purpose: 'REGISTER' }),
      ).rejects.toMatchObject({
        status: 429,
        response: { code: 'OTP_LOCKED' },
      });
    });

    it('caps sends per IP at 10 per hour', async () => {
      const ip = 'test-203.0.113.9';
      await prisma.rateLimitCounter.deleteMany({ where: { key: `otp:ip:${ip}` } });
      await reset(limitedPhone);

      let ipBlocked: unknown = null;
      for (let i = 0; i < 11 && !ipBlocked; i++) {
        const phoneX = `+2420612${(30000 + i).toString().padStart(5, '0')}`;
        await prisma.otpChallenge.deleteMany({ where: { phone: phoneX } });
        try {
          await service.requestOtp({
            phone: phoneX,
            purpose: 'REGISTER',
            ipAddress: ip,
          });
        } catch (err) {
          ipBlocked = err;
        }
      }
      expect(ipBlocked).toMatchObject({
        status: 429,
        response: { code: 'OTP_RATE_LIMITED' },
      });
    });
  });

  describe('sessions & logout (spec 01)', () => {
    const sessionPhone = '+242061239999';
    let sessionUserId: string;

    /** Login through the real OTP path so a RefreshToken row exists. */
    async function login(): Promise<{
      accessToken: string;
      refreshToken: string;
    }> {
      await prisma.otpChallenge.deleteMany({ where: { phone: sessionPhone } });
      await service.requestOtp({ phone: sessionPhone, purpose: 'LOGIN' });
      const code = await otpStore.peek(sessionPhone);
      return service.verifyOtp({
        phone: sessionPhone,
        code: code!,
        purpose: 'LOGIN',
      });
    }

    beforeAll(async () => {
      await prisma.otpChallenge.deleteMany({ where: { phone: sessionPhone } });
      for (const u of await prisma.user.findMany({
        where: { phone: sessionPhone },
      })) {
        await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
        await prisma.userRole.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
      }
      const country = await prisma.country.findFirstOrThrow({
        where: { code: 'CG' },
      });
      const user = await prisma.user.create({
        data: {
          phone: sessionPhone,
          countryId: country.id,
          roles: { create: { role: GlobalRole.TENANT } },
        },
      });
      sessionUserId = user.id;
    });

    afterAll(async () => {
      await prisma.refreshToken.deleteMany({ where: { userId: sessionUserId } });
      await prisma.userRole.deleteMany({ where: { userId: sessionUserId } });
      await prisma.user.deleteMany({ where: { id: sessionUserId } });
      await prisma.otpChallenge.deleteMany({ where: { phone: sessionPhone } });
    });

    it('stores the device context on the refresh token', async () => {
      const tokens = await login();
      const row = await prisma.refreshToken.findFirst({
        where: {
          userId: sessionUserId,
          tokenHash: hashToken(tokens.refreshToken),
        },
      });
      expect(row).not.toBeNull();
      expect(row!.deviceId).toBeTruthy();
      expect(row!.familyId).toBeTruthy();
      expect(row!.platform).toBe('WEB');
      expect(row!.ipAddress).toBeNull();
    });

    it('persists the device metadata supplied at login', async () => {
      await service.requestOtp({ phone: sessionPhone, purpose: 'LOGIN' });
      const code = await otpStore.peek(sessionPhone);
      const tokens = await service.verifyOtp({
        phone: sessionPhone,
        code: code!,
        purpose: 'LOGIN',
        device: {
          deviceId: 'device-spec-01',
          deviceName: 'Téléphone QA',
          platform: 'ANDROID',
          ipAddress: '10.0.0.7',
        },
      });
      const row = await prisma.refreshToken.findFirst({
        where: {
          userId: sessionUserId,
          tokenHash: hashToken(tokens.refreshToken),
        },
      });
      expect(row).toMatchObject({
        deviceId: 'device-spec-01',
        deviceName: 'Téléphone QA',
        platform: 'ANDROID',
        ipAddress: '10.0.0.7',
      });
    });

    it('logout revokes the token so a later refresh is 401', async () => {
      const tokens = await login();
      const out = await service.logout({ refreshToken: tokens.refreshToken });
      expect(out.revoked).toBe(true);

      await expect(
        service.refresh({ refreshToken: tokens.refreshToken }),
      ).rejects.toMatchObject({ response: { code: 'REFRESH_REPLAYED' } });
    });

    it('logout is idempotent for an unknown token', async () => {
      await expect(
        service.logout({ refreshToken: 'token.does-not-exist-at-all' }),
      ).resolves.toEqual({ revoked: false });
    });

    it('rotation keeps the same familyId and device', async () => {
      const first = await login();
      const before = await prisma.refreshToken.findFirst({
        where: { userId: sessionUserId, tokenHash: hashToken(first.refreshToken) },
      });

      const rotated = await service.refresh({
        refreshToken: first.refreshToken,
      });
      const after = await prisma.refreshToken.findFirst({
        where: { userId: sessionUserId, tokenHash: hashToken(rotated.refreshToken) },
      });

      expect(after!.familyId).toBe(before!.familyId);
      expect(after!.deviceId).toBe(before!.deviceId);
    });

    it('replaying a rotated token revokes the whole device family', async () => {
      const first = await login();
      const rotated = await service.refresh({
        refreshToken: first.refreshToken,
      });

      // Replay of the already-rotated token → every session of the device dies.
      await expect(
        service.refresh({ refreshToken: first.refreshToken }),
      ).rejects.toMatchObject({ response: { code: 'REFRESH_REPLAYED' } });

      const family = await prisma.refreshToken.findMany({
        where: { userId: sessionUserId, tokenHash: hashToken(rotated.refreshToken) },
      });
      expect(family).toHaveLength(1);
      expect(family[0]!.revokedAt).not.toBeNull();

      await expect(
        service.refresh({ refreshToken: rotated.refreshToken }),
      ).rejects.toMatchObject({ response: { code: 'REFRESH_REPLAYED' } });
    });

    it('logout-all revokes every session of the user', async () => {
      const a = await login();
      const b = await login();

      const result = await service.logoutAll(sessionUserId);
      expect(result.revoked).toBeGreaterThanOrEqual(2);

      const still = await prisma.refreshToken.count({
        where: { userId: sessionUserId, revokedAt: null },
      });
      expect(still).toBe(0);

      await expect(service.refresh({ refreshToken: a.refreshToken })).rejects
        .toBeDefined();
      await expect(service.refresh({ refreshToken: b.refreshToken })).rejects
        .toBeDefined();
    });

    it('logout-all can keep the current session when asked', async () => {
      const keep = await login();
      await login();

      const result = await service.logoutAll(sessionUserId, {
        includeCurrent: false,
        refreshToken: keep.refreshToken,
      });
      expect(result.revoked).toBeGreaterThanOrEqual(1);

      const alive = await prisma.refreshToken.findMany({
        where: { userId: sessionUserId, revokedAt: null },
      });
      expect(alive).toHaveLength(1);
      expect(alive[0]!.tokenHash).toBe(hashToken(keep.refreshToken));

      const rotated = await service.refresh({ refreshToken: keep.refreshToken });
      expect(rotated.refreshToken).toBeTruthy();
    });
  });
});
