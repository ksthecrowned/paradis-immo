import { Injectable, NotFoundException } from '@nestjs/common';
import { GlobalRole, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicUser {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  countryId: string;
  roles: string[];
  createdAt: string;
}

export interface PublicOrganization {
  id: string;
  name: string;
  type: string;
}

type UserWithRoles = User & { roles: { role: GlobalRole }[] };

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

  async updateMe(
    userId: string,
    patch: { name?: string; avatarUrl?: string },
  ): Promise<PublicUser> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
      },
      include: { roles: true },
    });
    return this.toPublic(updated);
  }

  /**
   * Returns the user's organizations with their role. Used by dashboards.
   */
  async listMyOrganizations(userId: string): Promise<PublicOrganization[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      type: m.organization.type,
    }));
  }

  private toPublic(user: UserWithRoles): PublicUser {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      countryId: user.countryId,
      roles: user.roles.map((r) => r.role),
      createdAt: user.createdAt.toISOString(),
    };
  }
}
