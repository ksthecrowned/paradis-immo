import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Organization,
  OrgMemberRole,
  OrganizationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SEED_IDS } from '../common/constants/seed-ids';

const PARADIS_IMMO_ID = SEED_IDS.orgParadisImmo;

export type PublicOrganization = {
  id: string;
  name: string;
  type: string;
  shortName: string | null;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  cityLabel: string | null;
  logoColor: string | null;
  isOfficial: boolean;
  verified: boolean;
  foundedYear: number | null;
  rating: number | null;
  reviewCount: number;
  dealSuccessPercent: number | null;
};

export type PublicAgent = {
  id: string;
  organizationId: string;
  name: string | null;
  phone: string | null;
};

export type PublicOrganizationDetail = PublicOrganization & {
  agents: PublicAgent[];
};

const publicOrgWhere: Prisma.OrganizationWhereInput = {
  OR: [{ type: OrganizationType.AGENCY }, { isOfficial: true }],
};

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the Paradis Immo platform organization (created by the seed).
   * Throws NotFound if the seed has not been run yet.
   */
  async getParadisImmo(): Promise<Organization> {
    const org = await this.prisma.organization.findUnique({
      where: { id: PARADIS_IMMO_ID },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'PARADIS_IMMO_NOT_SEEDED',
        message:
          'Paradis Immo organization not found — run `pnpm prisma db seed`',
      });
    }
    return org;
  }

  async listPublic(): Promise<{ data: PublicOrganization[] }> {
    const rows = await this.prisma.organization.findMany({
      where: publicOrgWhere,
      orderBy: [{ isOfficial: 'desc' }, { name: 'asc' }],
    });
    return { data: rows.map((o) => this.toPublic(o)) };
  }

  async getPublic(id: string): Promise<PublicOrganizationDetail> {
    const org = await this.prisma.organization.findFirst({
      where: { id, AND: [publicOrgWhere] },
      include: {
        members: {
          where: { role: OrgMemberRole.AGENT },
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });
    }
    return {
      ...this.toPublic(org),
      agents: org.members.map((m) => ({
        id: m.user.id,
        organizationId: org.id,
        name: m.user.name,
        phone: m.user.phone ?? null,
      })),
    };
  }

  toPublic(o: Organization): PublicOrganization {
    return {
      id: o.id,
      name: o.name,
      type: o.type,
      shortName: o.shortName ?? null,
      tagline: o.tagline ?? null,
      address: o.address ?? null,
      phone: o.phone ?? null,
      cityLabel: o.cityLabel ?? null,
      logoColor: o.logoColor ?? null,
      isOfficial: o.isOfficial,
      verified: o.verified,
      foundedYear: o.foundedYear ?? null,
      rating: o.rating ?? null,
      reviewCount: o.reviewCount,
      dealSuccessPercent: o.dealSuccessPercent ?? null,
    };
  }

  /**
   * Auto-create a personal OWNER organization when a user publishes their
   * first property. The user becomes the OWNER member. Idempotent: returns
   * the existing org if one already exists for that user.
   */
  async ensureOwnerOrg(
    userId: string,
    countryId: string,
  ): Promise<Organization> {
    const existing = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        role: OrgMemberRole.OWNER,
        organization: { type: OrganizationType.OWNER },
      },
      include: { organization: true },
    });
    if (existing) return existing.organization;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    const baseName =
      user?.name?.trim() || `Propriétaire ${user?.phone ?? userId.slice(-6)}`;

    const name = await this.uniqueOwnerOrgName(baseName);

    try {
      return await this.prisma.organization.create({
        data: {
          name,
          type: OrganizationType.OWNER,
          affiliationStatus: null,
          countryId,
          members: {
            create: { userId, role: OrgMemberRole.OWNER },
          },
        },
      });
    } catch (err) {
      this.logger.warn(`ensureOwnerOrg race for user ${userId}: ${err}`);
      const again = await this.prisma.organizationMember.findFirst({
        where: {
          userId,
          role: OrgMemberRole.OWNER,
          organization: { type: OrganizationType.OWNER },
        },
        include: { organization: true },
      });
      if (!again) throw err;
      return again.organization;
    }
  }

  /**
   * Add the user as an AGENT member of Paradis Immo.
   * Called when a user is promoted to agent status.
   */
  async ensureAgentMembership(
    userId: string,
  ): Promise<{ userId: string; organizationId: string; role: OrgMemberRole }> {
    const paradis = await this.getParadisImmo();
    const existing = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: paradis.id },
      },
    });
    if (existing) return existing;
    try {
      return await this.prisma.organizationMember.create({
        data: {
          userId,
          organizationId: paradis.id,
          role: OrgMemberRole.AGENT,
        },
      });
    } catch (err) {
      const found = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: { userId, organizationId: paradis.id },
        },
      });
      if (!found) throw err;
      return found;
    }
  }

  private async uniqueOwnerOrgName(base: string): Promise<string> {
    const existing = await this.prisma.organization.findFirst({
      where: { name: base },
    });
    if (!existing) return base;
    for (let i = 0; i < 10; i++) {
      const candidate = `${base} (${Math.floor(Math.random() * 9999)})`;
      const taken = await this.prisma.organization.findFirst({
        where: { name: candidate },
      });
      if (!taken) return candidate;
    }
    throw new ConflictException({
      code: 'OWNER_NAME_COLLISION',
      message: 'Could not allocate a unique owner organization name',
    });
  }
}
