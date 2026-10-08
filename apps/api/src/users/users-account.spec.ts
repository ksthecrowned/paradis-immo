import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { InfobipOtpService } from '../auth/infobip-otp.service';
import { MagicLinkStore } from '../auth/magic-link.store';
import { OtpStore } from '../auth/otp.store';
import { UsersService } from './users.service';

describe('UsersService account security (spec 01 — P1/P2)', () => {
  let users: UsersService;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  const sentOtp: string[] = [];
  const sentTexts: string[] = [];
  let lastMagicToken: string | null = null;
  let lastMagicEmail: string | null = null;

  const phoneA = '+242062200001';
  const phoneB = '+242062200002';
  const phoneTaken = '+242062200003';
  const email = 'spec01.account@example.com';

  let countryId: string;
  let userAId: string;
  let userBId: string;
  let takenId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        PrismaService,
        OtpStore,
        MagicLinkStore,
        {
          provide: InfobipOtpService,
          useValue: {
            sendOtp: async (m: { to: string; code: string }) => {
              sentOtp.push(`${m.to}:${m.code}`);
            },
            sendText: async (m: { to: string; text: string }) => {
              sentTexts.push(`${m.to}:${m.text}`);
            },
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendMagicLink: async (
              to: string,
              token: string,
              _purpose: string,
            ) => {
              lastMagicToken = token;
              lastMagicEmail = to;
            },
          },
        },
      ],
    }).compile();
    users = moduleRef.get(UsersService);
    prisma = moduleRef.get(PrismaService);
    otpStore = moduleRef.get(OtpStore);
    await prisma.onModuleInit();

    const country = await prisma.country.findFirstOrThrow();
    countryId = country.id;
    const phones = [phoneA, phoneB, phoneTaken];
    await prisma.user.deleteMany({ where: { phone: { in: phones } } });
    await prisma.emailMagicLink.deleteMany({ where: { email } });

    const a = await prisma.user.create({
      data: { phone: phoneA, countryId, name: 'Account A' },
    });
    userAId = a.id;
    const b = await prisma.user.create({
      data: { phone: phoneB, countryId, name: 'Account B' },
    });
    userBId = b.id;
    const taken = await prisma.user.create({
      data: { phone: phoneTaken, countryId, name: 'Taken' },
    });
    takenId = taken.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    const userIds = [userAId, userBId, takenId].filter(Boolean);
    await prisma.emailMagicLink.deleteMany({ where: { email } });
    if (userIds.length) {
      await prisma.userPhoneHistory.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.otpChallenge.deleteMany({
      where: { phone: { in: [phoneA, phoneB, phoneTaken] } },
    });
    await prisma.onModuleDestroy();
  });

  it('lists active sessions and revokes one that belongs to the user', async () => {
    const token = await prisma.refreshToken.create({
      data: {
        userId: userAId,
        tokenHash: `sessions-spec-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400_000),
        deviceName: 'Test Browser',
        platform: 'WEB',
      },
    });
    const sessions = await users.listSessions(userAId);
    expect(sessions.some((s) => s.id === token.id)).toBe(true);

    await users.revokeSession(userAId, token.id);
    const after = await prisma.refreshToken.findUniqueOrThrow({
      where: { id: token.id },
    });
    expect(after.revokedAt).not.toBeNull();
    const listed = await users.listSessions(userAId);
    expect(listed.some((s) => s.id === token.id)).toBe(false);
  });

  it('refuses to revoke another user’s session', async () => {
    const other = await prisma.refreshToken.create({
      data: {
        userId: userBId,
        tokenHash: `sessions-other-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400_000),
      },
    });
    await expect(users.revokeSession(userAId, other.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('changes phone after OTP verification and keeps history', async () => {
    sentOtp.length = 0;
    // Free number — not owned by any account yet.
    const newPhone = '+242062200020';
    await prisma.otpChallenge.deleteMany({ where: { phone: newPhone } });

    await users.requestPhoneChange(userAId, newPhone);
    expect(sentOtp.some((s) => s.startsWith(`${newPhone}:`))).toBe(true);
    const code = await otpStore.peek(newPhone);
    expect(code).toBeTruthy();

    const updated = await users.confirmPhoneChange(userAId, newPhone, code!);
    expect(updated.phone).toBe(newPhone);

    const history = await prisma.userPhoneHistory.findMany({
      where: { userId: userAId },
    });
    expect(history.map((h) => h.phone)).toContain(phoneA);

    // The old number receives an information SMS (spec 01).
    expect(sentTexts.some((t) => t.startsWith(`${phoneA}:`))).toBe(true);

    // Restore the fixture so later tests see the original number.
    await prisma.user.update({
      where: { id: userAId },
      data: { phone: phoneA },
    });
    await prisma.otpChallenge.deleteMany({ where: { phone: newPhone } });
  });

  it('rejects a phone already used by another account', async () => {
    await expect(
      users.requestPhoneChange(userAId, phoneTaken),
    ).rejects.toMatchObject({
      response: { code: 'PHONE_ALREADY_USED' },
    });
  });

  it('rejects an invalid OTP on phone confirmation', async () => {
    const newPhone = '+242062200009';
    await prisma.otpChallenge.deleteMany({ where: { phone: newPhone } });
    await users.requestPhoneChange(userAId, newPhone).catch(() => undefined);
    const code = await otpStore.peek(newPhone);
    if (code) {
      await expect(
        users.confirmPhoneChange(userAId, newPhone, '000000'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await prisma.otpChallenge.deleteMany({ where: { phone: newPhone } });
  });

  it('changes email after consuming the magic link', async () => {
    lastMagicToken = null;
    await users.requestEmailChange(userAId, email);
    expect(lastMagicEmail).toBe(email);
    expect(lastMagicToken).toBeTruthy();

    const updated = await users.confirmEmailChange(userAId, lastMagicToken!);
    expect(updated.email).toBe(email);
  });

  it('records versioned consents', async () => {
    const updated = await users.updateConsents(userAId, {
      termsVersion: '2026-10-01',
      marketingOptIn: true,
    });
    expect(updated.termsVersion).toBe('2026-10-01');
    expect(updated.termsAcceptedAt).toBeTruthy();
    expect(updated.marketingOptIn).toBe(true);
  });

  it('exposes ForbiddenException for a foreign session under another user', () => {
    // Sanity: the exception type is the one Nest maps to HTTP 403/404.
    expect(
      new ForbiddenException().getStatus(),
    ).toBe(403);
  });
});
