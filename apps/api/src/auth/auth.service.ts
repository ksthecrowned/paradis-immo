import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Country, GlobalRole, User } from '@prisma/client';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingBillingService } from '../messaging/messaging-billing.service';
import { InfobipOtpService } from './infobip-otp.service';
import { OtpStore, type OtpPurpose } from './otp.store';

const MAX_OTP_ATTEMPTS = 5;
const REFRESH_TTL_DAYS = 30;
const ACCESS_TTL = '15m';

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

interface PublicUser {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  roles: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpStore: OtpStore,
    private readonly infobip: InfobipOtpService,
    private readonly messaging: MessagingBillingService,
    private readonly jwt: JwtService,
  ) {}

  async requestOtp(input: {
    phone: string;
    purpose: OtpPurpose;
  }): Promise<void> {
    await this.assertPhoneMatchesPurpose(input.phone, input.purpose);

    const MAX_REQUESTS_PER_HOUR = 5;
    const count = await this.otpStore.incrementRequestCount(input.phone);
    if (count > MAX_REQUESTS_PER_HOUR) {
      throw new ServiceUnavailableException({
        code: 'OTP_RATE_LIMIT',
        message: 'Too many OTP requests for this phone; try again later',
      });
    }
    const code = this.generateCode();
    await this.otpStore.put(input.phone, code, input.purpose);
    await this.infobip.sendOtp({ to: input.phone, code });
    await this.messaging.recordOtp(input.phone);
  }

  async verifyOtp(input: {
    phone: string;
    code: string;
    purpose: OtpPurpose;
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
      await this.otpStore.del(input.phone);
      throw new UnauthorizedException({
        code: 'OTP_LOCKED',
        message: 'Too many attempts, request a new code',
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
    await this.messaging.attachPhoneChargesToUser(input.phone, user.id);

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async refresh(input: { refreshToken: string }): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtRefreshPayload>(input.refreshToken);
    } catch {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        message: 'Invalid or expired refresh token',
      });
    }
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(input.refreshToken) },
      include: { user: { include: { roles: true } } },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'REFRESH_REVOKED',
        message: 'Refresh token revoked or expired',
      });
    }
    if (stored.userId !== payload.sub) {
      throw new UnauthorizedException({
        code: 'REFRESH_MISMATCH',
        message: 'Refresh token does not match user',
      });
    }
    // Rotate: revoke old, issue new pair
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await this.issueTokens(stored.user);
    return { ...tokens, user: this.toPublicUser(stored.user) };
  }

  // ----------------------------------------------------------------
  // Internals
  // ----------------------------------------------------------------

  private async assertPhoneMatchesPurpose(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const existing = await this.prisma.user.findFirst({ where: { phone } });
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

  private async requireExistingUser(
    phone: string,
  ): Promise<User & { roles: { role: GlobalRole }[] }> {
    const existing = await this.prisma.user.findFirst({
      where: { phone },
      include: { roles: true },
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
    user: User & { roles: { role: GlobalRole }[] },
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
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  private async getOrCreateCountryForPhone(phone: string): Promise<Country> {
    const prefix = phone.startsWith('+') ? phone.slice(0, 4) : null; // e.g. +242
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
    // MVP: only Congo is supported; fall back to CG
    return this.prisma.country.findUniqueOrThrow({ where: { code: 'CG' } });
  }

  private async getOrCreateUser(
    phone: string,
    countryId: string,
  ): Promise<User & { roles: { role: GlobalRole }[] }> {
    const existing = await this.prisma.user.findFirst({
      where: { phone, countryId },
      include: { roles: true },
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
      include: { roles: true },
    });
  }

  private toPublicUser(
    user: User & { roles: { role: GlobalRole }[] },
  ): PublicUser {
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      roles: user.roles.map((r) => r.role),
    };
  }

  private generateCode(): string {
    // 6-digit numeric code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
