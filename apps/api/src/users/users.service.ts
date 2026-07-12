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
  phone: string;
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
