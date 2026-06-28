import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Organization, OrgMemberRole, OrganizationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PARADIS_IMMO_ID = 'org_paradis_immo';

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

    // Use the user's name as the org name (fallback: "Propriétaire <phone>")
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    const baseName =
      user?.name?.trim() || `Propriétaire ${user?.phone ?? userId.slice(-6)}`;

    // Ensure uniqueness — append a short random suffix if the name collides
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
      // Race condition: another request just created the org.
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
      // Possible duplicate race
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
