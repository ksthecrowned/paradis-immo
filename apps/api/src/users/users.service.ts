import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import {
  GlobalRole,
  NotificationChannel,
  OrgMemberRole,
  SeekerExperience,
  SeekerIntent,
  User,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { InfobipOtpService } from '../auth/infobip-otp.service';
import { MagicLinkStore } from '../auth/magic-link.store';
import { OtpStore } from '../auth/otp.store';

export interface PublicUser {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  notificationChannel: 'PUSH' | 'SMS' | 'WHATSAPP';
  countryId: string;
  roles: string[];
  createdAt: string;
  seekerIntent: 'RENT' | 'BUY' | 'VISIT' | 'ALL_OPTIONS' | null;
  seekerExperience: 'FIRST_TIME' | 'RETURNING' | 'PRO' | null;
  budgetMinXaf: number | null;
  budgetMaxXaf: number | null;
  preferredQuartierIds: string[];
  seekerSetupCompletedAt: string | null;
  kycStatus: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  marketingOptIn: boolean;
}

/** Minimal public profile for owner/agent tenant resolution. */
export interface UserLookupResult {
  id: string;
  name: string | null;
  phone: string;
}

/**
 * Masked answer for `GET users/lookup` (spec 01): a manager only needs to
 * confirm the account exists and recognise it, never to harvest full names.
 * Example: `{ exists: true, userId, displayName: 'Jean M.' }`.
 */
export interface UserLookupPublicResult {
  exists: boolean;
  userId: string | null;
  displayName: string | null;
  phone: string;
}

/** Spec 01 — an active session is a non-revoked, non-expired refresh token. */
export interface SessionItem {
  id: string;
  deviceId: string;
  deviceName: string | null;
  platform: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: string;
  createdAt: string;
}

const LOOKUP_MAX_PER_HOUR = 20;
const LOOKUP_ROLES: OrgMemberRole[] = [
  OrgMemberRole.OWNER,
  OrgMemberRole.ADMIN,
  OrgMemberRole.AGENT,
];

/** "Jean Mbemba" → "Jean M." — keeps first name + initial, drops the rest. */
export function maskDisplayName(name: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  const lastInitial = parts[parts.length - 1]!.charAt(0).toUpperCase();
  return `${parts[0]} ${lastInitial}.`;
}

export interface PublicOrganization {
  id: string;
  name: string;
  type: string;
  memberRole: string;
}

type UserWithRoles = User & { roles: { role: GlobalRole }[] };

type UpdateMePatch = {
  name?: string;
  email?: string;
  avatarUrl?: string;
  fcmToken?: string;
  notificationChannel?: 'PUSH' | 'SMS' | 'WHATSAPP';
  seekerIntent?: 'RENT' | 'BUY' | 'VISIT' | 'ALL_OPTIONS';
  seekerExperience?: 'FIRST_TIME' | 'RETURNING' | 'PRO';
  budgetMinXaf?: number;
  budgetMaxXaf?: number;
  preferredQuartierIds?: string[];
  completeSeekerSetup?: boolean;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    // Spec 01 P1 deps are optional so focused unit tests that only exercise
    // lookup / deletion can instantiate the service with Prisma alone.
    @Optional() private readonly otpStore?: OtpStore,
    @Optional() private readonly infobip?: InfobipOtpService,
    @Optional() private readonly magicLinks?: MagicLinkStore,
    @Optional() private readonly email?: EmailService,
  ) {}

  // ------------------------------------------------------------------
  // Sessions (spec 01 — P1)
  // ------------------------------------------------------------------

  /** Active sessions of the user, newest activity first. */
  async listSessions(userId: string): Promise<SessionItem[]> {
    const rows = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      deviceId: r.deviceId,
      deviceName: r.deviceName,
      platform: r.platform,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      lastUsedAt: r.lastUsedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Revoke a single session (must belong to the caller). */
  async revokeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ revoked: boolean }> {
    const session = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, revokedAt: true },
    });
    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session introuvable.',
      });
    }
    if (!session.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
    return { revoked: true };
  }

  // ------------------------------------------------------------------
  // Phone change (spec 01 — P1)
  // ------------------------------------------------------------------

  /**
   * Verify the new number with an OTP before touching the account. The number
   * must not belong to another account in the same country.
   */
  async requestPhoneChange(
    userId: string,
    newPhone: string,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const normalized = this.requireE164(newPhone);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phone: true, countryId: true },
    });
    if (user.phone === normalized) {
      throw new BadRequestException({
        code: 'PHONE_UNCHANGED',
        message: 'Le nouveau numéro est identique au numéro actuel.',
      });
    }
    const taken = await this.prisma.user.findFirst({
      where: { phone: normalized, countryId: user.countryId, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException({
        code: 'PHONE_ALREADY_USED',
        message: 'Ce numéro est déjà associé à un autre compte.',
      });
    }
    if (!this.otpStore || !this.infobip) {
      throw new HttpException(
        { code: 'OTP_UNAVAILABLE', message: 'OTP indisponible.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const decision = await this.otpStore.decideSend(normalized, ipAddress);
    if (!decision.allowed) {
      throw new HttpException(
        {
          code: decision.code ?? 'OTP_RATE_LIMITED',
          message: 'Trop de demandes de code. Réessayez plus tard.',
          retryAfter: decision.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = this.generateCode();
    await this.otpStore.put(normalized, code, 'PHONE_CHANGE');
    if (ipAddress) await this.otpStore.recordIpRequest(ipAddress);
    await this.infobip.sendOtp({ to: normalized, code });
    return { message: 'Code envoyé au nouveau numéro.' };
  }

  /** Confirm the OTP and swap the number, keeping history for audit. */
  async confirmPhoneChange(
    userId: string,
    newPhone: string,
    code: string,
  ): Promise<PublicUser> {
    const normalized = this.requireE164(newPhone);
    if (!this.otpStore || !this.infobip) {
      throw new HttpException(
        { code: 'OTP_UNAVAILABLE', message: 'OTP indisponible.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const record = await this.otpStore.getWithAttempts(normalized);
    if (!record || record.purpose !== 'PHONE_CHANGE') {
      throw new UnauthorizedException({
        code: 'OTP_NOT_FOUND',
        message: 'Aucun code en attente pour ce numéro.',
      });
    }
    if (record.attempts >= 5) {
      throw new UnauthorizedException({
        code: 'OTP_LOCKED',
        message: 'Trop de tentatives : réessayez dans 30 minutes.',
      });
    }
    if (record.code !== code) {
      await this.otpStore.incrementAttempts(normalized);
      throw new UnauthorizedException({
        code: 'OTP_INVALID',
        message: 'Code invalide.',
      });
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phone: true, countryId: true },
    });
    const taken = await this.prisma.user.findFirst({
      where: { phone: normalized, countryId: user.countryId, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException({
        code: 'PHONE_ALREADY_USED',
        message: 'Ce numéro est déjà associé à un autre compte.',
      });
    }

    const previousPhone = user.phone;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { phone: normalized },
      include: { roles: true },
    });
    if (previousPhone) {
      await this.prisma.userPhoneHistory.create({
        data: { userId, phone: previousPhone },
      });
      // Inform the old number that it is no longer linked (spec 01).
      try {
        await this.infobip.sendText({
          to: previousPhone,
          text: 'Votre numéro a été délié de votre compte Paradis Immo.',
        });
      } catch {
        // Best-effort: the swap already succeeded.
      }
    }
    await this.otpStore.del(normalized);
    return this.toPublic(updated);
  }

  // ------------------------------------------------------------------
  // Email change (spec 01 — P1)
  // ------------------------------------------------------------------

  /** Send a VERIFY_EMAIL magic link to the address being added. */
  async requestEmailChange(
    userId: string,
    email: string,
  ): Promise<{ message: string }> {
    const normalized = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
      throw new BadRequestException({
        code: 'EMAIL_FORMAT',
        message: 'Adresse e-mail invalide.',
      });
    }
    const taken = await this.prisma.user.findFirst({
      where: { email: normalized, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_USED',
        message: 'Cette adresse est déjà utilisée par un autre compte.',
      });
    }
    if (!this.magicLinks || !this.email) {
      throw new HttpException(
        { code: 'EMAIL_UNAVAILABLE', message: 'Envoi e-mail indisponible.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const { rawToken } = await this.magicLinks.create(normalized, 'VERIFY_EMAIL');
    await this.email.sendMagicLink(normalized, rawToken, 'VERIFY_EMAIL');
    return { message: 'Lien de vérification envoyé.' };
  }

  /** Consume the magic link sent to the new address and apply the change. */
  async confirmEmailChange(userId: string, token: string): Promise<PublicUser> {
    if (!this.magicLinks) {
      throw new HttpException(
        { code: 'EMAIL_UNAVAILABLE', message: 'Envoi e-mail indisponible.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const { email } = await this.magicLinks.consume(token, 'VERIFY_EMAIL');
    const taken = await this.prisma.user.findFirst({
      where: { email, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_USED',
        message: 'Cette adresse est déjà utilisée par un autre compte.',
      });
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { email, emailVerifiedAt: new Date() },
      include: { roles: true },
    });
    return this.toPublic(updated);
  }

  // ------------------------------------------------------------------
  // Versioned consents (spec 01 — P2)
  // ------------------------------------------------------------------

  async updateConsents(
    userId: string,
    input: { termsVersion?: string; marketingOptIn?: boolean },
  ): Promise<PublicUser> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.termsVersion !== undefined
          ? { termsVersion: input.termsVersion, termsAcceptedAt: new Date() }
          : {}),
        ...(input.marketingOptIn !== undefined
          ? { marketingOptIn: input.marketingOptIn }
          : {}),
      },
      include: { roles: true },
    });
    return this.toPublic(updated);
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User does not exist',
      });
    }
    return this.toPublic(user);
  }

  /**
   * Resolve a registered user by E.164 phone. Used by owners/agents when
   * creating leases (or booking on behalf of a guest). Returns a minimal
   * profile — never throws PII beyond id/name/phone.
   *
   * Internal callers (leases, bookings…) use this full form. The HTTP route
   * goes through `lookupForManager` which masks the name.
   */
  async lookupByPhone(phone: string): Promise<UserLookupResult> {
    const normalized = this.requireE164(phone);
    const user = await this.prisma.user.findFirst({
      where: { phone: normalized },
      select: { id: true, name: true, phone: true },
    });
    if (!user?.phone) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Aucun compte trouvé pour ce numéro',
      });
    }
    return { id: user.id, name: user.name, phone: user.phone };
  }

  /**
   * `GET users/lookup?phone=` — spec 01.
   *
   * Restricted to members of an organization (OWNER / ADMIN / AGENT): a plain
   * seeker or tenant must not be able to enumerate accounts by phone number.
   * The name is masked, no email or avatar is ever returned, and each caller
   * is limited to 20 lookups per hour.
   */
  async lookupForManager(
    callerId: string,
    phone: string,
  ): Promise<UserLookupPublicResult> {
    const normalized = this.requireE164(phone);

    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: callerId, role: { in: LOOKUP_ROLES } },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'ORG_MEMBERSHIP_REQUIRED',
        message:
          'La recherche par numéro est réservée aux membres d’une organisation.',
      });
    }

    await this.assertLookupUnderLimit(callerId);

    const user = await this.prisma.user.findFirst({
      where: { phone: normalized },
      select: { id: true, name: true },
    });
    return {
      exists: Boolean(user),
      userId: user?.id ?? null,
      displayName: maskDisplayName(user?.name ?? null),
      phone: normalized,
    };
  }

  /**
   * Blockers that prevent deleting an account (spec 01). Returns a human list
   * so the API can answer 409 with the reasons.
   */
  async accountDeletionBlockers(userId: string): Promise<string[]> {
    const now = new Date();
    const [lease, booking, sale, unpaid] = await Promise.all([
      this.prisma.lease.findFirst({
        where: { tenantId: userId, status: 'ACTIVE' },
        select: { id: true },
      }),
      this.prisma.booking.findFirst({
        where: {
          userId,
          endDate: { gte: now },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: { id: true },
      }),
      this.prisma.saleAgreement.findFirst({
        where: { buyerId: userId, status: 'ACTIVE' },
        select: { id: true },
      }),
      this.prisma.rentSchedule.findFirst({
        where: {
          lease: { tenantId: userId },
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        select: { id: true },
      }),
    ]);

    const blockers: string[] = [];
    if (lease) blockers.push('Un bail est toujours actif.');
    if (booking) blockers.push('Un séjour est à venir.');
    if (sale) blockers.push('Un dossier de vente est en cours.');
    if (unpaid) blockers.push('Un solde de loyer reste dû.');
    return blockers;
  }

  /**
   * Request account deletion: soft delete + revoke every session. The data is
   * anonymised 30 days later by a cron; until then the user can cancel by
   * signing back in.
   */
  async requestAccountDeletion(
    userId: string,
  ): Promise<{ deletedAt: Date; blockers?: never }> {
    const blockers = await this.accountDeletionBlockers(userId);
    if (blockers.length > 0) {
      throw new ConflictException({
        code: 'ACCOUNT_HAS_ACTIVE_OBLIGATIONS',
        message:
          'Impossible de supprimer ce compte tant que ces éléments existent.',
        details: { blockers },
      });
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { deletedAt: user.deletedAt as Date };
  }

  /** Cancel a pending deletion (allowed for 30 days). */
  async cancelAccountDeletion(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null, status: 'ACTIVE' },
    });
  }

  /** Fixed-window throttle for `users/lookup` — 20 calls per hour and user. */
  private async assertLookupUnderLimit(callerId: string): Promise<void> {
    const key = `lookup:user:${callerId}`;
    const now = new Date();
    const entry = await this.prisma.rateLimitCounter.findUnique({
      where: { key },
    });
    if (entry && entry.windowEndAt > now) {
      if (entry.count >= LOOKUP_MAX_PER_HOUR) {
        const retryAfter = Math.max(
          1,
          Math.ceil((entry.windowEndAt.getTime() - now.getTime()) / 1000),
        );
        throw new HttpException(
          {
            code: 'LOOKUP_RATE_LIMITED',
            message: 'Trop de recherches. Réessayez plus tard.',
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      await this.prisma.rateLimitCounter.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
      return;
    }
    await this.prisma.rateLimitCounter.upsert({
      where: { key },
      create: {
        key,
        count: 1,
        windowEndAt: new Date(now.getTime() + 3600 * 1000),
      },
      update: { count: 1, windowEndAt: new Date(now.getTime() + 3600 * 1000) },
    });
  }

  /**
   * Find a user by phone, or create a minimal TENANT profile when missing.
   * `name` is required for creation so owners can identify non-app tenants.
   * The user can later sign in via OTP on that same phone.
   */
  async resolveOrCreateByPhone(
    phone: string,
    name?: string | null,
  ): Promise<UserLookupResult & { created: boolean }> {
    const normalized = this.requireE164(phone);
    const existing = await this.prisma.user.findFirst({
      where: { phone: normalized },
      select: { id: true, name: true, phone: true },
    });
    if (existing?.phone) {
      if (name?.trim() && !existing.name) {
        const updated = await this.prisma.user.update({
          where: { id: existing.id },
          data: { name: name.trim() },
          select: { id: true, name: true, phone: true },
        });
        return {
          id: updated.id,
          name: updated.name,
          phone: updated.phone!,
          created: false,
        };
      }
      return {
        id: existing.id,
        name: existing.name,
        phone: existing.phone,
        created: false,
      };
    }

    const trimmedName = name?.trim();
    if (!trimmedName) {
      throw new BadRequestException({
        code: 'USER_NAME_REQUIRED',
        message:
          'Nom requis pour créer un profil sans compte Paradis Immo',
      });
    }

    const country = await this.resolveCountryForPhone(normalized);
    const created = await this.prisma.user.create({
      data: {
        phone: normalized,
        name: trimmedName,
        countryId: country.id,
        roles: { create: { role: GlobalRole.TENANT } },
      },
      select: { id: true, name: true, phone: true },
    });
    return {
      id: created.id,
      name: created.name,
      phone: created.phone!,
      created: true,
    };
  }

  private requireE164(phone: string): string {
    const normalized = phone.trim();
    if (!/^\+\d{7,15}$/.test(normalized)) {
      throw new BadRequestException({
        code: 'PHONE_FORMAT',
        message: 'phone must be E.164 (+country…)',
      });
    }
    return normalized;
  }

  /** Prefer the longest matching `Country.phonePrefix` for an E.164 number. */
  private async resolveCountryForPhone(phone: string) {
    const countries = await this.prisma.country.findMany({
      select: { id: true, phonePrefix: true },
    });
    const match = countries
      .filter((c) => phone.startsWith(c.phonePrefix))
      .sort((a, b) => b.phonePrefix.length - a.phonePrefix.length)[0];
    if (match) return match;

    const fallback =
      (await this.prisma.country.findUnique({ where: { code: 'CG' } })) ??
      (await this.prisma.country.findFirst());
    if (!fallback) {
      throw new BadRequestException({
        code: 'COUNTRY_REQUIRED',
        message: 'No country configured to attach the new tenant',
      });
    }
    return fallback;
  }

  async updateMe(userId: string, patch: UpdateMePatch): Promise<PublicUser> {
    if (
      patch.preferredQuartierIds !== undefined &&
      patch.preferredQuartierIds.length > 3
    ) {
      throw new BadRequestException({
        code: 'TOO_MANY_QUARTIERS',
        message: 'At most 3 preferred quartiers are allowed',
      });
    }

    if (
      patch.budgetMinXaf !== undefined &&
      patch.budgetMaxXaf !== undefined &&
      patch.budgetMinXaf > patch.budgetMaxXaf
    ) {
      throw new BadRequestException({
        code: 'INVALID_BUDGET_RANGE',
        message: 'budgetMinXaf must be <= budgetMaxXaf',
      });
    }

    if (
      patch.preferredQuartierIds !== undefined &&
      patch.preferredQuartierIds.length > 0
    ) {
      const ids = [...new Set(patch.preferredQuartierIds)];
      const count = await this.prisma.quartier.count({
        where: { id: { in: ids } },
      });
      if (count !== ids.length) {
        throw new BadRequestException({
          code: 'UNKNOWN_QUARTIER',
          message: 'One or more preferredQuartierIds do not exist',
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined
          ? {
              email: patch.email.trim() || null,
              // Spec 01: only `users/me/email` (magic link) proves ownership,
              // so a direct profile edit always resets the verification.
              emailVerifiedAt: null,
            }
          : {}),
        ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
        ...(patch.fcmToken !== undefined ? { fcmToken: patch.fcmToken } : {}),
        ...(patch.notificationChannel !== undefined
          ? {
              notificationChannel:
                patch.notificationChannel === 'SMS'
                  ? NotificationChannel.SMS
                  : patch.notificationChannel === 'WHATSAPP'
                    ? NotificationChannel.WHATSAPP
                    : NotificationChannel.PUSH,
            }
          : {}),
        ...(patch.seekerIntent !== undefined
          ? { seekerIntent: patch.seekerIntent as SeekerIntent }
          : {}),
        ...(patch.seekerExperience !== undefined
          ? { seekerExperience: patch.seekerExperience as SeekerExperience }
          : {}),
        ...(patch.budgetMinXaf !== undefined
          ? { budgetMinXaf: patch.budgetMinXaf }
          : {}),
        ...(patch.budgetMaxXaf !== undefined
          ? { budgetMaxXaf: patch.budgetMaxXaf }
          : {}),
        ...(patch.preferredQuartierIds !== undefined
          ? { preferredQuartierIds: patch.preferredQuartierIds }
          : {}),
        ...(patch.completeSeekerSetup === true
          ? { seekerSetupCompletedAt: new Date() }
          : {}),
      },
      include: { roles: true },
    });
    return this.toPublic(updated);
  }

  async listMyOrganizations(userId: string): Promise<PublicOrganization[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      type: m.organization.type,
      memberRole: m.role,
    }));
  }

  private toPublic(user: UserWithRoles): PublicUser {
    // Report the stored preference as-is: WhatsApp is the default for new
    // accounts (schema default), but an explicit PUSH choice must survive
    // `getMe` (spec: SMS is never a delivery channel).
    const channel: PublicUser['notificationChannel'] =
      user.notificationChannel;
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      notificationChannel: channel,
      countryId: user.countryId,
      roles: user.roles.map((r) => r.role),
      createdAt: user.createdAt.toISOString(),
      seekerIntent: user.seekerIntent,
      seekerExperience: user.seekerExperience,
      budgetMinXaf: user.budgetMinXaf,
      budgetMaxXaf: user.budgetMaxXaf,
      preferredQuartierIds: user.preferredQuartierIds ?? [],
      seekerSetupCompletedAt: user.seekerSetupCompletedAt
        ? user.seekerSetupCompletedAt.toISOString()
        : null,
      kycStatus: user.kycStatus,
      termsVersion: user.termsVersion ?? null,
      termsAcceptedAt: user.termsAcceptedAt
        ? user.termsAcceptedAt.toISOString()
        : null,
      marketingOptIn: user.marketingOptIn,
    };
  }
}
