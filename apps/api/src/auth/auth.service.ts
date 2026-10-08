import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  Country,
  GlobalRole,
  OrgMemberRole,
  OrganizationType,
  User,
} from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { InfobipOtpService } from './infobip-otp.service';
import { MagicLinkStore } from './magic-link.store';
import {
  OtpStore,
  OTP_MAX_ATTEMPTS as MAX_OTP_ATTEMPTS,
  type OtpPurpose,
} from './otp.store';
import { hashPassword, verifyPassword } from './password.util';
import { fixedOtpFor } from './test-otp';

const REFRESH_TTL_DAYS = 30;
const ACCESS_TTL = '15m';

type UserWithRoles = User & {
  roles: { role: GlobalRole }[];
  orgMembers?: { role: OrgMemberRole }[];
};

interface JwtAccessPayload {
  sub: string;
  roles: string[];
}

interface JwtRefreshPayload {
  sub: string;
  jti: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

/** Device context captured at login so sessions can be listed and revoked. */
export interface AuthDeviceContext {
  deviceId?: string;
  deviceName?: string;
  platform?: 'IOS' | 'ANDROID' | 'WEB' | 'ADMIN';
  ipAddress?: string;
  userAgent?: string;
}

export interface PublicUser {
  id: string;
  phone: string | null;
  name: string | null;
  email: string | null;
  roles: string[];
  orgRoles: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpStore: OtpStore,
    private readonly magicLinks: MagicLinkStore,
    private readonly email: EmailService,
    private readonly infobip: InfobipOtpService,
    private readonly jwt: JwtService,
  ) {}

  async requestOtp(input: {
    phone: string;
    purpose: OtpPurpose;
    ipAddress?: string;
  }): Promise<void> {
    await this.assertPhoneMatchesPurpose(input.phone, input.purpose);

    // Store-review accounts use a fixed code and never hit the SMS provider,
    // so they are exempt from the send rate limits (spec 01).
    const fixedCode = fixedOtpFor(input.phone);
    if (fixedCode) {
      await this.otpStore.put(input.phone, fixedCode, input.purpose);
      this.logger.warn(
        `[test] Fixed OTP for ${input.phone}: ${fixedCode} (SMS skipped)`,
      );
      return;
    }

    const decision = await this.otpStore.decideSend(
      input.phone,
      input.ipAddress,
    );
    if (!decision.allowed) {
      throw new HttpException(
        {
          code: decision.code ?? 'OTP_RATE_LIMITED',
          message:
            decision.code === 'OTP_COOLDOWN'
              ? 'Un code a déjà été envoyé récemment. Réessayez dans un instant.'
              : decision.code === 'OTP_LOCKED'
                ? 'Trop de tentatives : ce numéro est bloqué temporairement.'
                : 'Trop de demandes de code. Réessayez plus tard.',
          retryAfter: decision.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateCode();
    await this.otpStore.put(input.phone, code, input.purpose);
    if (input.ipAddress) {
      await this.otpStore.recordIpRequest(input.ipAddress);
    }
    await this.infobip.sendOtp({ to: input.phone, code });
  }

  async verifyOtp(input: {
    phone: string;
    code: string;
    purpose: OtpPurpose;
    device?: AuthDeviceContext;
  }): Promise<AuthTokens> {
    const record = await this.otpStore.getWithAttempts(input.phone);
    if (!record) {
      throw new UnauthorizedException({
        code: 'OTP_NOT_FOUND',
        message: 'No OTP requested for this phone',
      });
    }
    if (record.purpose !== input.purpose) {
      throw new UnauthorizedException({
        code: 'OTP_PURPOSE_MISMATCH',
        message: 'OTP was requested for a different flow',
      });
    }
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      // Keep the row: `lockedUntil` is what blocks new sends for 30 minutes.
      throw new UnauthorizedException({
        code: 'OTP_LOCKED',
        message: 'Trop de tentatives : réessayez dans 30 minutes.',
      });
    }
    if (record.code !== input.code) {
      await this.otpStore.incrementAttempts(input.phone);
      throw new UnauthorizedException({
        code: 'OTP_INVALID',
        message: 'Invalid OTP code',
      });
    }

    await this.otpStore.del(input.phone);

    const country = await this.getOrCreateCountryForPhone(input.phone);
    const user =
      input.purpose === 'LOGIN'
        ? await this.requireExistingUser(input.phone)
        : await this.getOrCreateUser(input.phone, country.id);
    this.assertNotPlatformAdmin(user);

    const tokens = await this.issueTokens(user, input.device);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async loginAdminPassword(input: {
    email: string;
    password: string;
    device?: AuthDeviceContext;
  }): Promise<AuthTokens> {
    const tokens = await this.loginWeb(input);
    if (!tokens.user.roles.includes(GlobalRole.PLATFORM_ADMIN)) {
      throw new ForbiddenException({
        code: 'NOT_PLATFORM_ADMIN',
        message: 'Accès réservé aux administrateurs plateforme',
      });
    }
    return tokens;
  }

  async loginAdminGoogle(input: {
    idToken: string;
    device?: AuthDeviceContext;
  }): Promise<AuthTokens> {
    const tokens = await this.loginGoogleWeb(input);
    if (!tokens.user.roles.includes(GlobalRole.PLATFORM_ADMIN)) {
      throw new ForbiddenException({
        code: 'NOT_PLATFORM_ADMIN',
        message: 'Accès réservé aux administrateurs plateforme',
      });
    }
    return tokens;
  }

  async registerWeb(input: { email: string }): Promise<{ message: string }> {
    const email = input.email.trim().toLowerCase();
    const country = await this.ensureDefaultCountry();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    // Google-first accounts must keep using Google — no password signup path.
    if (existing?.googleId) {
      throw new ConflictException({
        code: 'GOOGLE_ACCOUNT_EXISTS',
        message:
          'Un compte existe déjà avec Google pour cet email. Connectez-vous avec Google.',
      });
    }
    if (!existing) {
      await this.prisma.user.create({
        data: { email, countryId: country.id, phone: null },
      });
    }
    const { rawToken } = await this.magicLinks.create(email, 'VERIFY_EMAIL');
    await this.email.sendMagicLink(email, rawToken, 'VERIFY_EMAIL');
    return { message: 'Si cet email est valide, un lien a été envoyé' };
  }

  async resendWebMagic(input: { email: string }): Promise<{ message: string }> {
    return this.registerWeb(input);
  }

  async consumeMagic(input: {
    token: string;
    password: string;
    device?: AuthDeviceContext;
  }): Promise<AuthTokens> {
    if (input.password.length < 8) {
      throw new BadRequestException({
        code: 'PASSWORD_TOO_SHORT',
        message: '8 caractères minimum',
      });
    }
    const { email } = await this.magicLinks.consume(
      input.token,
      'VERIFY_EMAIL',
    );
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.googleId) {
      throw new ConflictException({
        code: 'GOOGLE_ACCOUNT_EXISTS',
        message:
          'Un compte existe déjà avec Google pour cet email. Connectez-vous avec Google.',
      });
    }
    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.user.update({
      where: { email },
      data: { emailVerifiedAt: new Date(), passwordHash },
      include: { roles: true, orgMembers: true },
    });
    const tokens = await this.issueTokens(user, input.device);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async loginWeb(input: {
    email: string;
    password: string;
    device?: AuthDeviceContext;
  }): Promise<AuthTokens> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true, orgMembers: true },
    });
    if (!user?.passwordHash || !user.emailVerifiedAt) {
      throw new UnauthorizedException({
        code: 'WEB_INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect',
      });
    }
    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'WEB_INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect',
      });
    }
    const tokens = await this.issueTokens(user, input.device);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async loginGoogleWeb(input: {
    idToken: string;
    device?: AuthDeviceContext;
  }): Promise<AuthTokens> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new ServiceUnavailableException({
        code: 'GOOGLE_NOT_CONFIGURED',
        message: 'Google sign-in is not configured',
      });
    }
    let payload: {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: input.idToken,
        audience: clientId,
      });
      payload = ticket.getPayload() ?? {};
    } catch {
      throw new UnauthorizedException({
        code: 'GOOGLE_TOKEN_INVALID',
        message: 'Jeton Google invalide',
      });
    }
    const email = payload.email?.trim().toLowerCase();
    const googleId = payload.sub;
    if (!email || !googleId || payload.email_verified === false) {
      throw new UnauthorizedException({
        code: 'GOOGLE_EMAIL_REQUIRED',
        message: 'Compte Google sans email vérifié',
      });
    }

    const country = await this.ensureDefaultCountry();
    // Same email ⇒ same account for password and Google. Prefer email match
    // so an existing web user keeps id / orgRoles when they later use Google.
    let user =
      (await this.prisma.user.findUnique({
        where: { email },
        include: { roles: true, orgMembers: true },
      })) ??
      (await this.prisma.user.findUnique({
        where: { googleId },
        include: { roles: true, orgMembers: true },
      }));

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          googleId,
          emailVerifiedAt: new Date(),
          name: payload.name ?? null,
          countryId: country.id,
          phone: null,
        },
        include: { roles: true, orgMembers: true },
      });
    } else {
      // If this Google sub was linked to another row, detach it first so the
      // verified-email account becomes the single source of truth.
      if (user.googleId !== googleId) {
        await this.prisma.user.updateMany({
          where: { googleId, NOT: { id: user.id } },
          data: { googleId: null },
        });
      }
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          email,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          name: user.name ?? payload.name ?? null,
        },
        include: { roles: true, orgMembers: true },
      });
    }

    const tokens = await this.issueTokens(user, input.device);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async setWebRole(
    userId: string,
    role: 'OWNER' | 'AGENT',
    device?: AuthDeviceContext,
  ): Promise<AuthTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: true, orgMembers: true },
    });
    if (this.isPlatformAdmin(user)) {
      const tokens = await this.issueTokens(user, device);
      return { ...tokens, user: this.toPublicUser(user) };
    }
    // Idempotent: role onboarding must survive re-login / stale sessions.
    // Never throw — return current tokens so the client can refresh JWT orgRoles.
    const hasBiz = (user.orgMembers ?? []).some(
      (m) =>
        m.role === OrgMemberRole.OWNER ||
        m.role === OrgMemberRole.AGENT ||
        m.role === OrgMemberRole.ADMIN,
    );
    if (!hasBiz) {
      // Neither OWNER nor AGENT is ever granted implicitly: both come from an
      // invitation — the agency founder / owner from a PLATFORM_ADMIN
      // invitation (spec 02), the agent from their agency admin (spec 01/02).
      if (role === 'OWNER') {
        throw new ForbiddenException({
          code: 'OWNER_REQUIRES_INVITATION',
          message:
            'Le compte propriétaire est ouvert par un administrateur. Déposez une demande puis attendez votre lien d’invitation.',
        });
      }
      throw new ForbiddenException({
        code: 'AGENT_ROLE_REQUIRES_INVITATION',
        message:
          'Le rôle agent s’obtient sur invitation d’une agence.',
      });
    }
    const refreshed = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: true, orgMembers: true },
    });
    const tokens = await this.issueTokens(refreshed, device);
    return { ...tokens, user: this.toPublicUser(refreshed) };
  }

  async hashAdminPassword(password: string): Promise<string> {
    return hashPassword(password);
  }

  async refresh(input: {
    refreshToken: string;
    device?: AuthDeviceContext;
  }): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtRefreshPayload>(
        input.refreshToken,
      );
    } catch {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        message: 'Invalid or expired refresh token',
      });
    }
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(input.refreshToken) },
      include: {
        user: { include: { roles: true, orgMembers: true } },
      },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        message: 'Invalid or expired refresh token',
      });
    }
    if (stored.revokedAt) {
      // Replay of an already-rotated token: the device either leaked its
      // token or a stolen copy is being used. Revoke the whole family so
      // neither copy can keep minting sessions.
      const revoked = await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(
        `Refresh replay for family ${stored.familyId} (user ${stored.userId}) — revoked ${revoked.count} token(s)`,
      );
      throw new UnauthorizedException({
        code: 'REFRESH_REPLAYED',
        message: 'Refresh token already used; all sessions of this device were revoked',
      });
    }
    if (stored.userId !== payload.sub) {
      throw new UnauthorizedException({
        code: 'REFRESH_MISMATCH',
        message: 'Refresh token does not match user',
      });
    }
    if (stored.user.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Ce compte est suspendu.',
      });
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });
    // Rotation keeps the device bound to the same family.
    const tokens = await this.issueTokens(stored.user, {
      ...input.device,
      deviceId: stored.deviceId,
      deviceName: input.device?.deviceName ?? stored.deviceName ?? undefined,
      platform: input.device?.platform ?? stored.platform,
      ipAddress: input.device?.ipAddress ?? stored.ipAddress ?? undefined,
      userAgent: input.device?.userAgent ?? stored.userAgent ?? undefined,
      familyId: stored.familyId,
    });
    return { ...tokens, user: this.toPublicUser(stored.user) };
  }

  /**
   * Suspend an account (spec 01): the status blocks every authenticated route
   * and every session is revoked immediately.
   */
  async suspendUser(
    userId: string,
    reason?: string,
  ): Promise<{ sessionsRevoked: number }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspendedReason: reason ?? null,
      },
    });
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.warn(`Account ${userId} suspended (${revoked.count} sessions revoked)`);
    return { sessionsRevoked: revoked.count };
  }

  /** Lift a suspension — the user gets 200 on login again but no old session. */
  async unsuspendUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        suspendedAt: null,
        suspendedReason: null,
      },
    });
  }

  /** Revoke the presented refresh token — `POST auth/logout`. */
  async logout(input: { refreshToken: string }): Promise<{ revoked: boolean }> {
    const tokenHash = this.hash(input.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, revokedAt: true },
    });
    // Unknown or already revoked token → still a success for the client.
    if (!stored) return { revoked: false };
    if (stored.revokedAt) return { revoked: true };
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  /** Revoke every session of the user — `POST auth/logout-all`. */
  async logoutAll(
    userId: string,
    input: {
      includeCurrent?: boolean;
      refreshToken?: string;
    } = {},
  ): Promise<{ revoked: number }> {
    const includeCurrent = input.includeCurrent ?? true;
    const keepHash =
      !includeCurrent && input.refreshToken
        ? this.hash(input.refreshToken)
        : null;
    const result = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(keepHash ? { tokenHash: { not: keepHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }

  private isPlatformAdmin(user: UserWithRoles): boolean {
    return user.roles.some((r) => r.role === GlobalRole.PLATFORM_ADMIN);
  }

  private assertIsPlatformAdmin(user: UserWithRoles): void {
    if (!this.isPlatformAdmin(user)) {
      throw new ForbiddenException({
        code: 'NOT_PLATFORM_ADMIN',
        message: 'Accès réservé aux administrateurs plateforme',
      });
    }
  }

  private assertNotPlatformAdmin(user: UserWithRoles): void {
    if (this.isPlatformAdmin(user)) {
      throw new ForbiddenException({
        code: 'ADMIN_USE_EMAIL_LOGIN',
        message:
          'Les administrateurs se connectent avec email / Google, pas par OTP.',
      });
    }
  }

  private async assertPhoneMatchesPurpose(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: { phone },
      include: { roles: true },
    });
    if (existing) {
      this.assertNotPlatformAdmin(existing);
    }
    if (purpose === 'LOGIN' && !existing) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message:
          'Aucun compte associé à ce numéro. Créez un compte d’abord.',
      });
    }
    if (purpose === 'REGISTER' && existing) {
      throw new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message:
          'Un compte existe déjà pour ce numéro. Connectez-vous.',
      });
    }
  }

  private async requireExistingUser(phone: string): Promise<UserWithRoles> {
    const existing = await this.prisma.user.findFirst({
      where: { phone },
      include: { roles: true, orgMembers: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message:
          'Aucun compte associé à ce numéro. Créez un compte d’abord.',
      });
    }
    return existing;
  }

  private async issueTokens(
    user: UserWithRoles,
    device: AuthDeviceContext & { familyId?: string } = {},
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const roles = user.roles.map((r) => r.role);
    const accessPayload: JwtAccessPayload = { sub: user.id, roles };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      expiresIn: ACCESS_TTL,
    });

    const jti = crypto.randomUUID();
    const refreshPayload: JwtRefreshPayload = { sub: user.id, jti };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      expiresIn: `${REFRESH_TTL_DAYS}d`,
    });

    const tokenHash = this.hash(refreshToken);
    const expiresAt = new Date(
      Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        familyId: device.familyId ?? crypto.randomUUID(),
        deviceId: device.deviceId ?? crypto.randomUUID(),
        deviceName: device.deviceName ?? null,
        platform: device.platform ?? 'WEB',
        ipAddress: device.ipAddress ?? null,
        userAgent: device.userAgent ?? null,
      },
    });

    return { accessToken, refreshToken };
  }

  /** Congo (CG) is the MVP default market — upsert so auth works before seed. */
  private async ensureDefaultCountry(): Promise<Country> {
    return this.prisma.country.upsert({
      where: { code: 'CG' },
      update: {},
      create: {
        code: 'CG',
        name: 'Congo',
        currency: 'XAF',
        phonePrefix: '+242',
        activeProviders: ['AIRTEL'],
      },
    });
  }

  private async getOrCreateCountryForPhone(phone: string): Promise<Country> {
    const prefix = phone.startsWith('+') ? phone.slice(0, 4) : null;
    if (!prefix) {
      throw new UnauthorizedException({
        code: 'PHONE_FORMAT',
        message: 'phone must start with + and country code',
      });
    }
    const existing = await this.prisma.country.findFirst({
      where: { phonePrefix: prefix },
    });
    if (existing) return existing;
    return this.ensureDefaultCountry();
  }

  private async getOrCreateUser(
    phone: string,
    countryId: string,
  ): Promise<UserWithRoles> {
    const existing = await this.prisma.user.findFirst({
      where: { phone, countryId },
      include: { roles: true, orgMembers: true },
    });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        phone,
        countryId,
        roles: {
          create: { role: GlobalRole.TENANT },
        },
      },
      include: { roles: true, orgMembers: true },
    });
  }

  private toPublicUser(user: UserWithRoles): PublicUser {
    const orgRoles = [...new Set((user.orgMembers ?? []).map((m) => m.role))];
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      roles: user.roles.map((r) => r.role),
      orgRoles,
    };
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
