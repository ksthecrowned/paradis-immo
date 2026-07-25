import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GlobalRole,
  NotificationChannel,
  SeekerExperience,
  SeekerIntent,
  User,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicUser {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  notificationChannel: 'PUSH' | 'SMS';
  countryId: string;
  roles: string[];
  createdAt: string;
  seekerIntent: 'RENT' | 'BUY' | 'VISIT' | 'ALL_OPTIONS' | null;
  seekerExperience: 'FIRST_TIME' | 'RETURNING' | 'PRO' | null;
  budgetMinXaf: number | null;
  budgetMaxXaf: number | null;
  preferredQuartierIds: string[];
  seekerSetupCompletedAt: string | null;
}

/** Minimal public profile for owner/agent tenant resolution. */
export interface UserLookupResult {
  id: string;
  name: string | null;
  phone: string;
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
  notificationChannel?: 'PUSH' | 'SMS';
  seekerIntent?: 'RENT' | 'BUY' | 'VISIT' | 'ALL_OPTIONS';
  seekerExperience?: 'FIRST_TIME' | 'RETURNING' | 'PRO';
  budgetMinXaf?: number;
  budgetMaxXaf?: number;
  preferredQuartierIds?: string[];
  completeSeekerSetup?: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
          ? { email: patch.email.trim() || null }
          : {}),
        ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
        ...(patch.fcmToken !== undefined ? { fcmToken: patch.fcmToken } : {}),
        ...(patch.notificationChannel !== undefined
          ? {
              notificationChannel:
                patch.notificationChannel === 'SMS'
                  ? NotificationChannel.SMS
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
    const channel =
      user.notificationChannel === NotificationChannel.SMS ? 'SMS' : 'PUSH';
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
    };
  }
}
