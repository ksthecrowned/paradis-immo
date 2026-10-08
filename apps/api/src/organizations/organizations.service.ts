import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberStatus,
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

export type PublicOrganizationReview = {
  id: string;
  organizationId: string;
  authorName: string;
  propertyTitle: string | null;
  body: string;
  rating: number;
  createdAt: string;
  reply: string | null;
  repliedAt: string | null;
};

export type PaginatedReviews = {
  data: PublicOrganizationReview[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

const publicOrgWhere: Prisma.OrganizationWhereInput = {
  OR: [
    { isOfficial: true },
    { type: OrganizationType.AGENCY, shortName: { not: null } },
  ],
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
          where: {
            role: { in: [OrgMemberRole.AGENT, OrgMemberRole.ADMIN] },
          },
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

  /**
   * Paginated public reviews (spec 02 — the endpoint was made paginated).
   * Only PUBLISHED reviews are visible; hidden/flagged ones await moderation.
   */
  async listReviews(
    organizationId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedReviews> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, ...publicOrgWhere },
      select: { id: true },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });
    }
    const where = { organizationId, status: 'PUBLISHED' };
    const safePage = Math.max(1, page);
    const safeSize = Math.min(50, Math.max(1, pageSize));
    const [total, rows] = await Promise.all([
      this.prisma.organizationReview.count({ where }),
      this.prisma.organizationReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeSize,
        take: safeSize,
      }),
    ]);
    return {
      data: rows.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        authorName: r.authorName,
        propertyTitle: r.propertyTitle,
        body: r.body,
        rating: r.rating,
        createdAt: r.createdAt.toISOString(),
        reply: r.reply ?? null,
        repliedAt: r.repliedAt ? r.repliedAt.toISOString() : null,
      })),
      meta: {
        page: safePage,
        pageSize: safeSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeSize)),
      },
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
   * Resolve the caller's personal OWNER organization (spec 02 — no
   * self-service): OWNER organizations are only ever created when a
   * PLATFORM_ADMIN invites their owner. Publishing without one is refused
   * with a pointer to the request form.
   */
  async ensureOwnerOrg(
    userId: string,
    _countryId: string,
  ): Promise<Organization> {
    const existing = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        status: MemberStatus.ACTIVE,
        role: OrgMemberRole.OWNER,
        organization: { type: OrganizationType.OWNER },
      },
      include: { organization: true },
    });
    if (existing) return existing.organization;

    this.logger.warn(
      `Refused property write for ${userId}: no OWNER organization (invitation-only)`,
    );
    throw new ConflictException({
      code: 'OWNER_ORG_REQUIRED',
      message:
        'Votre compte propriétaire n’a pas encore été ouvert par un administrateur. Déposez une demande, puis attendez votre lien d’invitation.',
    });
  }
}
