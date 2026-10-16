import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgencyClientLinkStatus,
  MemberStatus,
  NotificationChannel,
  OrgMemberRole,
  OrganizationType,
  Prisma,
} from '@prisma/client';
import { AuditLogService } from '../common/audit-log.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { maskDisplayName } from '../users/users.service';
import type {
  CreateExternalAgencyClientDto,
  LinkExistingUserDto,
  ListAgencyClientsQueryDto,
  UpdateAgencyClientDto,
} from './dto/agency-client.dto';

export type PublicAgencyClient = {
  id: string;
  organizationId: string;
  displayName: string;
  phoneE164: string | null;
  email: string | null;
  linkStatus: AgencyClientLinkStatus;
  userId: string | null;
  hasAccount: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  internalNote: string | null;
};

export type AgencyClientLookupResult = {
  exists: boolean;
  userId: string | null;
  displayName: string | null;
  phone: string;
  alreadyLinkedInOrg: boolean;
};

@Injectable()
export class AgencyClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly audit: AuditLogService,
  ) {}

  async list(
    callerId: string,
    organizationId: string,
    query: ListAgencyClientsQueryDto,
  ): Promise<{ data: PublicAgencyClient[]; meta: { total: number; page: number; pageSize: number } }> {
    await this.assertActiveAgencyMember(callerId, organizationId);
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20) || 20));
    const filter = query.filter ?? 'all';
    const where: Prisma.AgencyClientWhereInput = { organizationId };

    if (filter === 'archived') {
      where.archivedAt = { not: null };
    } else {
      where.archivedAt = null;
      if (filter === 'linked') where.userId = { not: null };
      if (filter === 'external') where.userId = null;
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { phoneE164: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.agencyClient.count({ where }),
      this.prisma.agencyClient.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((r) => this.toPublic(r, { includeNote: true })),
      meta: { total, page, pageSize },
    };
  }

  /** Selectable clients for AGENT/ADMIN — no internal notes mutation surface. */
  async listSelectable(
    callerId: string,
    organizationId: string,
    q?: string,
  ): Promise<PublicAgencyClient[]> {
    await this.assertActiveAgencyMember(callerId, organizationId);
    const where: Prisma.AgencyClientWhereInput = {
      organizationId,
      archivedAt: null,
    };
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { displayName: { contains: term, mode: 'insensitive' } },
        { phoneE164: { contains: term } },
      ];
    }
    const rows = await this.prisma.agencyClient.findMany({
      where,
      orderBy: { displayName: 'asc' },
      take: 50,
    });
    return rows.map((r) => this.toPublic(r, { includeNote: false }));
  }

  async getOne(
    callerId: string,
    organizationId: string,
    clientId: string,
  ): Promise<PublicAgencyClient> {
    await this.assertActiveAgencyMember(callerId, organizationId);
    const row = await this.requireClientInOrg(organizationId, clientId);
    return this.toPublic(row, { includeNote: true });
  }

  async lookupAccount(
    callerId: string,
    organizationId: string,
    phone: string,
  ): Promise<AgencyClientLookupResult> {
    await this.agencyAccess.assertIsAgencyGerant(callerId, organizationId);
    const normalized = this.requireE164(phone);
    await this.assertLookupUnderLimit(callerId);

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { countryId: true },
    });
    if (!org) {
      throw new NotFoundException({ code: 'ORG_NOT_FOUND', message: 'Organization not found' });
    }

    const user = await this.prisma.user.findFirst({
      where: { phone: normalized, countryId: org.countryId, deletedAt: null },
      select: { id: true, name: true },
    });

    let alreadyLinkedInOrg = false;
    if (user) {
      const existing = await this.prisma.agencyClient.findFirst({
        where: {
          organizationId,
          userId: user.id,
          archivedAt: null,
        },
        select: { id: true },
      });
      alreadyLinkedInOrg = Boolean(existing);
    }

    await this.audit.record({
      actorId: callerId,
      actorType: 'USER',
      action: 'AGENCY_CLIENT_LOOKUP',
      targetType: 'Organization',
      targetId: organizationId,
      metadata: { phoneSuffix: normalized.slice(-4), found: Boolean(user) },
    });

    return {
      exists: Boolean(user),
      userId: user?.id ?? null,
      displayName: maskDisplayName(user?.name ?? null),
      phone: normalized,
      alreadyLinkedInOrg,
    };
  }

  async createExternal(
    callerId: string,
    organizationId: string,
    dto: CreateExternalAgencyClientDto,
  ): Promise<PublicAgencyClient> {
    await this.agencyAccess.assertIsAgencyGerant(callerId, organizationId);
    await this.assertAgencyOrg(organizationId);
    const phoneE164 = this.requireE164(dto.phone);

    try {
      const row = await this.prisma.agencyClient.create({
        data: {
          organizationId,
          displayName: dto.displayName.trim(),
          phoneE164,
          email: dto.email?.trim() || null,
          internalNote: dto.internalNote?.trim() || null,
          linkStatus: AgencyClientLinkStatus.UNLINKED,
          createdById: callerId,
        },
      });
      await this.audit.record({
        actorId: callerId,
        actorType: 'USER',
        action: 'AGENCY_CLIENT_CREATE_EXTERNAL',
        targetType: 'AgencyClient',
        targetId: row.id,
        after: { organizationId, phoneSuffix: phoneE164.slice(-4) },
      });
      return this.toPublic(row, { includeNote: true });
    } catch (err) {
      this.rethrowUnique(err, 'Un contact actif avec ce numéro existe déjà dans cette agence');
      throw err;
    }
  }

  async linkExistingUser(
    callerId: string,
    organizationId: string,
    dto: LinkExistingUserDto,
  ): Promise<PublicAgencyClient> {
    await this.agencyAccess.assertIsAgencyGerant(callerId, organizationId);
    await this.assertAgencyOrg(organizationId);
    const phoneE164 = this.requireE164(dto.phone);
    await this.assertLookupUnderLimit(callerId);

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { countryId: true, name: true },
    });

    const user = await this.prisma.user.findFirst({
      where: { phone: phoneE164, countryId: org.countryId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Aucun compte trouvé pour ce numéro',
      });
    }

    const existing = await this.prisma.agencyClient.findFirst({
      where: { organizationId, userId: user.id, archivedAt: null },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_LINKED',
        message: 'Ce compte est déjà client de cette agence',
      });
    }

    try {
      const row = await this.prisma.agencyClient.create({
        data: {
          organizationId,
          userId: user.id,
          displayName: (dto.displayName?.trim() || user.name || 'Client').slice(0, 120),
          phoneE164,
          internalNote: dto.internalNote?.trim() || null,
          linkStatus: AgencyClientLinkStatus.LINKED,
          createdById: callerId,
        },
      });

      // Informational only — CRM link ≠ mandate acceptance (ADR-0001).
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          channel: NotificationChannel.WHATSAPP,
          type: 'AGENCY_CLIENT_CRM_ADDED',
          payload: {
            organizationId,
            organizationName: org.name,
            agencyClientId: row.id,
            informational: true,
          },
          status: 'PENDING',
        },
      });

      await this.audit.record({
        actorId: callerId,
        actorType: 'USER',
        action: 'AGENCY_CLIENT_LINK_USER',
        targetType: 'AgencyClient',
        targetId: row.id,
        after: { userId: user.id, organizationId },
      });

      return this.toPublic(row, { includeNote: true });
    } catch (err) {
      this.rethrowUnique(err, 'Ce compte ou ce numéro est déjà lié dans cette agence');
      throw err;
    }
  }

  async update(
    callerId: string,
    organizationId: string,
    clientId: string,
    dto: UpdateAgencyClientDto,
  ): Promise<PublicAgencyClient> {
    await this.agencyAccess.assertIsAgencyGerant(callerId, organizationId);
    const current = await this.requireClientInOrg(organizationId, clientId);
    if (current.archivedAt) {
      throw new ConflictException({
        code: 'CLIENT_ARCHIVED',
        message: 'Impossible de modifier un client archivé',
      });
    }

    const row = await this.prisma.agencyClient.update({
      where: { id: clientId },
      data: {
        displayName: dto.displayName?.trim(),
        email:
          dto.email === undefined
            ? undefined
            : dto.email === null
              ? null
              : dto.email.trim(),
        internalNote:
          dto.internalNote === undefined
            ? undefined
            : dto.internalNote === null
              ? null
              : dto.internalNote.trim(),
      },
    });

    await this.audit.record({
      actorId: callerId,
      actorType: 'USER',
      action: 'AGENCY_CLIENT_UPDATE',
      targetType: 'AgencyClient',
      targetId: clientId,
      before: { displayName: current.displayName },
      after: { displayName: row.displayName },
    });

    return this.toPublic(row, { includeNote: true });
  }

  async archive(
    callerId: string,
    organizationId: string,
    clientId: string,
  ): Promise<PublicAgencyClient> {
    await this.agencyAccess.assertIsAgencyGerant(callerId, organizationId);
    const current = await this.requireClientInOrg(organizationId, clientId);
    if (current.archivedAt) {
      return this.toPublic(current, { includeNote: true });
    }
    const row = await this.prisma.agencyClient.update({
      where: { id: clientId },
      data: { archivedAt: new Date() },
    });
    await this.audit.record({
      actorId: callerId,
      actorType: 'USER',
      action: 'AGENCY_CLIENT_ARCHIVE',
      targetType: 'AgencyClient',
      targetId: clientId,
    });
    return this.toPublic(row, { includeNote: true });
  }

  private async assertActiveAgencyMember(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true, status: true },
    });
    if (
      !member ||
      member.status !== MemberStatus.ACTIVE ||
      (member.role !== OrgMemberRole.ADMIN && member.role !== OrgMemberRole.AGENT)
    ) {
      throw new ForbiddenException({
        code: 'NOT_AGENCY_MEMBER',
        message: 'Active agency ADMIN or AGENT membership required',
      });
    }
  }

  private async assertAgencyOrg(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { type: true },
    });
    if (!org || org.type !== OrganizationType.AGENCY) {
      throw new BadRequestException({
        code: 'NOT_AGENCY_ORG',
        message: 'CRM clients are only available for agency organizations',
      });
    }
  }

  private async requireClientInOrg(organizationId: string, clientId: string) {
    const row = await this.prisma.agencyClient.findFirst({
      where: { id: clientId, organizationId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'AGENCY_CLIENT_NOT_FOUND',
        message: 'Client not found in this agency',
      });
    }
    return row;
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

  private async assertLookupUnderLimit(callerId: string): Promise<void> {
    const key = `lookup:agency-client:${callerId}`;
    const now = new Date();
    const entry = await this.prisma.rateLimitCounter.findUnique({ where: { key } });
    if (entry && entry.windowEndAt > now && entry.count >= 20) {
      throw new ForbiddenException({
        code: 'LOOKUP_RATE_LIMITED',
        message: 'Trop de recherches. Réessayez plus tard.',
      });
    }
    if (!entry || entry.windowEndAt <= now) {
      await this.prisma.rateLimitCounter.upsert({
        where: { key },
        create: {
          key,
          count: 1,
          windowEndAt: new Date(now.getTime() + 60 * 60 * 1000),
        },
        update: {
          count: 1,
          windowEndAt: new Date(now.getTime() + 60 * 60 * 1000),
        },
      });
    } else {
      await this.prisma.rateLimitCounter.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
    }
  }

  private rethrowUnique(err: unknown, message: string): void {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'AGENCY_CLIENT_DUPLICATE',
        message,
      });
    }
  }

  private toPublic(
    row: {
      id: string;
      organizationId: string;
      displayName: string;
      phoneE164: string | null;
      email: string | null;
      linkStatus: AgencyClientLinkStatus;
      userId: string | null;
      archivedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      internalNote: string | null;
    },
    opts: { includeNote: boolean },
  ): PublicAgencyClient {
    return {
      id: row.id,
      organizationId: row.organizationId,
      displayName: row.displayName,
      phoneE164: row.phoneE164,
      email: row.email,
      linkStatus: row.linkStatus,
      userId: row.userId,
      hasAccount: Boolean(row.userId),
      archivedAt: row.archivedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      internalNote: opts.includeNote ? row.internalNote : null,
    };
  }
}
