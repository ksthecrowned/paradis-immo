import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InvitationStatus,
  MemberStatus,
  OrgMemberRole,
  OrganizationType,
  ReviewSourceType,
} from '@prisma/client';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { InfobipOtpService } from '../auth/infobip-otp.service';
import { R2Service } from '../media/r2.service';

/** Spec 02 — invitations are valid for 7 days and single-use. */
export const INVITATION_TTL_DAYS = 7;
const ADMIN_ROLES: OrgMemberRole[] = [OrgMemberRole.OWNER, OrgMemberRole.ADMIN];

export interface CreateAgencyInput {
  name: string;
  legalName?: string;
  rccm?: string;
  niu?: string;
  address?: string;
  cityLabel?: string;
  phone?: string;
  email?: string;
  description?: string;
}

export interface PublicMember {
  userId: string;
  name: string | null;
  phone: string | null;
  role: string;
  status: string;
  joinedAt: string;
}

export interface PublicInvitation {
  id: string;
  role: string;
  phone: string | null;
  email: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  inviteUrl?: string;
}

/** Auto-moderation: reviews containing these never go public as PUBLISHED. */
const BLOCKED_WORDS = [
  'arnaque',
  'escroc',
  'fou',
  'con',
  'idiot',
];

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AgencyService {
  private readonly logger = new Logger(AgencyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly infobip: InfobipOtpService,
    private readonly r2: R2Service,
  ) {}

  /**
   * Public sign-up form (spec 02 — no self-service creation).
   *
   * The applicant gets **nothing but a reference**: no organization, no role,
   * no dashboard. A PLATFORM_ADMIN reviews the dossier and sends an
   * invitation link; only accepting that link creates the organization and
   * grants the role.
   */
  async submitRequest(
    input: CreateAgencyInput & {
      type: 'AGENCY' | 'OWNER';
      submittedById?: string | null;
    },
  ) {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!name) {
      throw new BadRequestException({
        code: 'ORG_NAME_REQUIRED',
        message: 'Le nom est requis.',
      });
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new BadRequestException({
        code: 'EMAIL_REQUIRED',
        message:
          'Une adresse e-mail est requise : c’est elle qui recevra le lien d’invitation.',
      });
    }
    if (input.type === 'AGENCY' && !input.rccm?.trim()) {
      throw new BadRequestException({
        code: 'RCCM_REQUIRED',
        message: 'Le RCCM est requis pour ouvrir une agence.',
      });
    }

    const request = await this.prisma.organizationRequest.create({
      data: {
        type: input.type,
        name,
        legalName: input.legalName?.trim() || null,
        rccm: input.rccm?.trim() || null,
        niu: input.niu?.trim() || null,
        address: input.address?.trim() || null,
        cityLabel: input.cityLabel?.trim() || null,
        phone: input.phone?.trim() || null,
        email,
        description: input.description?.trim() || null,
        submittedById: input.submittedById ?? null,
      },
    });
    this.logger.log(`Organization request ${request.id} (${request.type}) submitted`);
    return {
      reference: request.id,
      status: request.status,
      message:
        'Demande enregistrée. Vous recevrez un lien d’invitation à cette adresse.',
    };
  }

  /** Admin queue (spec 02 / 12). */
  async listRequests(status?: 'PENDING' | 'INVITED' | 'REJECTED') {
    const rows = await this.prisma.organizationRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { requests: rows };
  }

  /**
   * Turn an approved dossier into an organization + invitation (spec 02).
   * The org is created **without members**: the applicant only becomes its
   * ADMIN/OWNER once they open the link and sign in.
   */
  async reviewRequest(
    adminId: string,
    requestId: string,
    input: { action: 'INVITE' | 'REJECT'; rejectionReason?: string },
  ) {
    const request = await this.prisma.organizationRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException({
        code: 'REQUEST_NOT_FOUND',
        message: 'Demande introuvable.',
      });
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException({
        code: 'REQUEST_ALREADY_REVIEWED',
        message: 'Cette demande a déjà été traitée.',
      });
    }

    if (input.action === 'REJECT') {
      const reason = input.rejectionReason?.trim();
      if (!reason) {
        throw new BadRequestException({
          code: 'REJECTION_REASON_REQUIRED',
          message: 'Un motif est requis pour rejeter une demande.',
        });
      }
      const rejected = await this.prisma.organizationRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedBy: adminId,
          reviewedAt: new Date(),
          rejectionReason: reason,
        },
      });
      return { request: rejected, organizationId: null, inviteUrl: null };
    }

    const user = request.submittedById
      ? await this.prisma.user.findUnique({
          where: { id: request.submittedById },
          select: { countryId: true },
        })
      : null;
    const countryId =
      user?.countryId ??
      (await this.prisma.country.findFirstOrThrow({ select: { id: true } })).id;

    const isAgency = request.type === 'AGENCY';
    const org = await this.prisma.organization.create({
      data: {
        name: request.name,
        type: isAgency ? OrganizationType.AGENCY : OrganizationType.OWNER,
        // The admin validating the dossier *is* the affiliation approval.
        affiliationStatus: isAgency ? 'APPROVED' : null,
        approvedAt: new Date(),
        approvedBy: adminId,
        createdById: request.submittedById,
        countryId,
        legalName: request.legalName,
        rccm: request.rccm,
        niu: request.niu,
        address: request.address,
        cityLabel: request.cityLabel,
        phone: request.phone,
        email: request.email,
        description: request.description,
      },
    });

    const role = isAgency ? OrgMemberRole.ADMIN : OrgMemberRole.OWNER;
    const invitation = await this.issueInvitation({
      organizationId: org.id,
      role,
      email: request.email,
      invitedById: adminId,
      targetName: request.name,
    });

    await this.prisma.organizationRequest.update({
      where: { id: requestId },
      data: {
        status: 'INVITED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
    this.logger.log(`Request ${requestId} approved → org ${org.id} invited`);
    return {
      request: { ...request, status: 'INVITED' as const },
      organizationId: org.id,
      inviteUrl: invitation.inviteUrl,
    };
  }

  // ------------------------------------------------------------------
  // Members (spec 02 — P1)
  // ------------------------------------------------------------------

  async listMembers(
    viewerId: string,
    orgId: string,
  ): Promise<PublicMember[]> {
    await this.requireMember(viewerId, orgId);
    const rows = await this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      phone: m.user.phone ?? null,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  /** Change a member's role or disable them (spec 02 — P1). */
  async updateMember(
    actorId: string,
    orgId: string,
    targetUserId: string,
    input: { role?: OrgMemberRole; status?: MemberStatus },
  ): Promise<PublicMember> {
    await this.requireAdmin(actorId, orgId);
    const target = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: targetUserId, organizationId: orgId },
      },
    });
    if (!target) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Ce membre ne fait pas partie de l’organisation.',
      });
    }

    const losesAdmin =
      (input.role !== undefined && input.role !== OrgMemberRole.ADMIN) ||
      (input.status !== undefined && input.status !== MemberStatus.ACTIVE);
    if (target.role === OrgMemberRole.ADMIN && losesAdmin) {
      await this.assertNotLastAdmin(orgId, targetUserId);
    }

    await this.prisma.organizationMember.update({
      where: { id: target.id },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    const updated = await this.prisma.organizationMember.findUniqueOrThrow({
      where: { id: target.id },
      include: { user: { select: { name: true, phone: true } } },
    });
    return {
      userId: updated.userId,
      name: updated.user.name,
      phone: updated.user.phone ?? null,
      role: updated.role,
      status: updated.status,
      joinedAt: updated.joinedAt.toISOString(),
    };
  }

  /** Remove a member. Their assigned mandates return to the manager. */
  async removeMember(
    actorId: string,
    orgId: string,
    targetUserId: string,
  ): Promise<{ removed: boolean; mandatesReassigned: number }> {
    await this.requireAdmin(actorId, orgId);
    if (actorId === targetUserId) {
      throw new ConflictException({
        code: 'USE_LEAVE_INSTEAD',
        message: 'Utilisez « quitter l’agence » pour vous retirer vous-même.',
      });
    }
    return this.dropMembership(orgId, targetUserId);
  }

  /** Leave an organization you belong to (spec 02 — P1). */
  async leave(
    userId: string,
    orgId: string,
  ): Promise<{ removed: boolean; mandatesReassigned: number }> {
    await this.requireMember(userId, orgId);
    return this.dropMembership(orgId, userId);
  }

  private async dropMembership(
    orgId: string,
    targetUserId: string,
  ): Promise<{ removed: boolean; mandatesReassigned: number }> {
    const target = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: targetUserId, organizationId: orgId },
      },
    });
    if (!target) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Ce membre ne fait pas partie de l’organisation.',
      });
    }
    if (target.role === OrgMemberRole.ADMIN) {
      await this.assertNotLastAdmin(orgId, targetUserId);
    }

    await this.prisma.organizationMember.delete({ where: { id: target.id } });

    let mandatesReassigned = 0;
    if (target.role === OrgMemberRole.AGENT) {
      const reset = await this.prisma.mandate.updateMany({
        where: { assignedAgentId: targetUserId, organizationId: orgId },
        data: { assignedAgentId: null },
      });
      mandatesReassigned = reset.count;
      await this.notifyManagers(orgId, targetUserId, mandatesReassigned);
    }
    this.logger.log(
      `Member ${targetUserId} removed from ${orgId} (${mandatesReassigned} mandate(s) reassigned)`,
    );
    return { removed: true, mandatesReassigned };
  }

  /** An agency must always keep at least one active ADMIN. */
  private async assertNotLastAdmin(orgId: string, targetUserId: string) {
    const otherAdmin = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        role: OrgMemberRole.ADMIN,
        status: MemberStatus.ACTIVE,
        userId: { not: targetUserId },
      },
      select: { id: true },
    });
    if (!otherAdmin) {
      throw new ConflictException({
        code: 'LAST_ADMIN',
        message:
          'Impossible de retirer ou rétrograder le dernier administrateur de l’agence.',
      });
    }
  }

  private async requireMember(userId: string, orgId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: orgId },
      },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'NOT_ORG_MEMBER',
        message: 'Vous n’êtes pas membre de cette organisation.',
      });
    }
    if (membership.status === MemberStatus.DISABLED) {
      throw new ForbiddenException({
        code: 'MEMBER_DISABLED',
        message: 'Votre accès à cette organisation est désactivé.',
      });
    }
    return membership;
  }

  private async requireAdmin(userId: string, orgId: string) {
    const membership = await this.requireMember(userId, orgId);
    if (!ADMIN_ROLES.includes(membership.role)) {
      throw new ForbiddenException({
        code: 'ORG_ADMIN_REQUIRED',
        message: 'Réservé aux administrateurs de l’agence.',
      });
    }
    return membership;
  }

  /** Best-effort: tell every remaining manager an agent just left. */
  private async notifyManagers(
    orgId: string,
    agentId: string,
    mandatesReassigned: number,
  ) {
    const managers = await this.prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
        role: { in: ADMIN_ROLES },
        status: MemberStatus.ACTIVE,
        userId: { not: agentId },
      },
      select: { userId: true },
    });
    await Promise.all(
      managers.map((m) =>
        this.prisma.notification
          .create({
            data: {
              userId: m.userId,
              channel: 'PUSH',
              type: 'AGENT_REMOVED',
              payload: { organizationId: orgId, mandatesReassigned },
              status: 'PENDING',
            },
          })
          .catch(() => undefined),
      ),
    );
  }

  // ------------------------------------------------------------------
  // Invitations (spec 02 — P0)
  // ------------------------------------------------------------------

  /** Invite a collaborator by phone or email with a given org role. */
  async createInvitation(
    inviterId: string,
    orgId: string,
    input: { phone?: string; email?: string; role: OrgMemberRole },
  ): Promise<PublicInvitation> {
    await this.requireAdmin(inviterId, orgId);
    const phone = input.phone?.trim() || null;
    const email = input.email?.trim().toLowerCase() || null;
    if (!phone && !email) {
      throw new BadRequestException({
        code: 'INVITATION_TARGET_REQUIRED',
        message: 'Indiquez un téléphone ou un e-mail.',
      });
    }
    if (phone && email) {
      throw new BadRequestException({
        code: 'INVITATION_ONE_TARGET',
        message: 'Une invitation ne cible qu’un seul contact.',
      });
    }
    if (
      input.role !== OrgMemberRole.ADMIN &&
      input.role !== OrgMemberRole.AGENT
    ) {
      throw new BadRequestException({
        code: 'INVITATION_ROLE_INVALID',
        message: 'Le rôle doit être ADMIN ou AGENT.',
      });
    }

    const existing = await this.prisma.organizationInvitation.findFirst({
      where: {
        organizationId: orgId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'INVITATION_ALREADY_PENDING',
        message: 'Une invitation est déjà en attente pour cette cible.',
      });
    }

    return this.issueInvitation({
      organizationId: orgId,
      role: input.role,
      phone,
      email,
      invitedById: inviterId,
    });
  }

  /**
   * Mint a single-use 7-day token, persist it hashed, and deliver the link.
   * Shared by the agency admin (agents) and the platform admin (agencies and
   * owners).
   */
  async issueInvitation(params: {
    organizationId: string;
    role: OrgMemberRole;
    phone?: string | null;
    email?: string | null;
    invitedById: string;
    targetName?: string;
  }): Promise<PublicInvitation> {
    const phone = params.phone?.trim() || null;
    const email = params.email?.trim().toLowerCase() || null;
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    const created = await this.prisma.organizationInvitation.create({
      data: {
        organizationId: params.organizationId,
        role: params.role,
        phone,
        email,
        tokenHash: sha256(rawToken),
        invitedById: params.invitedById,
        expiresAt,
      },
    });

    const inviteUrl = `${process.env.WEB_APP_URL ?? 'http://localhost:3000'}/invitations/${rawToken}`;
    try {
      if (phone) {
        await this.infobip.sendText({
          to: phone,
          text: `Paradis Immo — on vous invite à rejoindre une organisation (${params.role}). Ouvrez : ${inviteUrl}`,
        });
      } else if (email) {
        await this.email.sendText(
          email,
          'Votre lien d’invitation Paradis Immo',
          `Votre compte ${params.targetName ?? ''} vous attend. Ouvrez ce lien pour vous connecter (e-mail + mot de passe ou Google) et finaliser : ${inviteUrl}`,
        );
      }
    } catch (err) {
      // The invitation exists even if the channel is down — the admin can
      // still share the link manually.
      this.logger.warn(`Invitation delivery failed: ${String(err)}`);
    }
    return this.toInvitation(created, inviteUrl);
  }

  async listInvitations(
    viewerId: string,
    orgId: string,
  ): Promise<PublicInvitation[]> {
    await this.requireAdmin(viewerId, orgId);
    const rows = await this.prisma.organizationInvitation.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toInvitation(r));
  }

  async revokeInvitation(
    viewerId: string,
    orgId: string,
    invitationId: string,
  ): Promise<{ revoked: boolean }> {
    await this.requireAdmin(viewerId, orgId);
    const row = await this.prisma.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitation introuvable.',
      });
    }
    if (row.status === InvitationStatus.PENDING) {
      await this.prisma.organizationInvitation.update({
        where: { id: row.id },
        data: { status: InvitationStatus.REVOKED },
      });
    }
    return { revoked: true };
  }

  /** Public preview: which organization, which role, which address to use. */
  async previewInvitation(token: string) {
    const invitation = await this.loadUsableInvitation(token);
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: invitation.organizationId },
      select: { id: true, name: true, cityLabel: true, logoColor: true },
    });
    const targetEmail = invitation.email ?? null;
    const account = targetEmail
      ? await this.prisma.user.findUnique({
          where: { email: targetEmail },
          select: { id: true, passwordHash: true, googleId: true },
        })
      : null;
    return {
      organization: org,
      role: invitation.role,
      email: targetEmail,
      // Lets the link page choose between “créer un compte” and “se connecter”.
      hasAccount: Boolean(account),
      // The invitee always signs in with e-mail + password or Google.
      methods: ['password', 'google'],
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /** Accept an invitation: the caller joins with the invited role. */
  async acceptInvitation(userId: string, token: string) {
    const invitation = await this.loadUsableInvitation(token);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phone: true, email: true },
    });

    if (invitation.phone && user.phone !== invitation.phone) {
      throw new ForbiddenException({
        code: 'INVITATION_TARGET_MISMATCH',
        message: 'Cette invitation est adressée à un autre numéro.',
      });
    }
    if (invitation.email && user.email !== invitation.email) {
      throw new ForbiddenException({
        code: 'INVITATION_TARGET_MISMATCH',
        message: 'Cette invitation est adressée à une autre adresse.',
      });
    }

    const existing = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: invitation.organizationId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'Vous faites déjà partie de cette agence.',
      });
    }

    await this.prisma.organizationMember.create({
      data: {
        userId,
        organizationId: invitation.organizationId,
        role: invitation.role,
        status: MemberStatus.ACTIVE,
        invitedBy: invitation.invitedById,
      },
    });
    await this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED, acceptedById: userId },
    });
    return {
      organizationId: invitation.organizationId,
      role: invitation.role,
    };
  }

  async declineInvitation(userId: string, token: string) {
    const invitation = await this.loadUsableInvitation(token);
    await this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.DECLINED, acceptedById: userId },
    });
    return { declined: true };
  }

  /** Resolve a raw token and reject anything not usable (410). */
  private async loadUsableInvitation(token: string) {
    const invitation =
      await this.prisma.organizationInvitation.findUnique({
        where: { tokenHash: sha256(token) },
      });
    if (!invitation) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitation introuvable.',
      });
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new GoneException({
        code: 'INVITATION_NO_LONGER_VALID',
        message: 'Cette invitation n’est plus valable.',
      });
    }
    if (invitation.expiresAt < new Date()) {
      await this.prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new GoneException({
        code: 'INVITATION_EXPIRED',
        message: 'Cette invitation a expiré.',
      });
    }
    return invitation;
  }

  private toInvitation(
    row: {
      id: string;
      role: OrgMemberRole;
      phone: string | null;
      email: string | null;
      status: InvitationStatus;
      expiresAt: Date;
      createdAt: Date;
    },
    inviteUrl?: string,
  ): PublicInvitation {
    return {
      id: row.id,
      role: row.role,
      phone: row.phone,
      email: row.email,
      status: row.status,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      ...(inviteUrl ? { inviteUrl } : {}),
    };
  }

  // ------------------------------------------------------------------
  // Vitrine (spec 02 — P1 / P2)
  // ------------------------------------------------------------------

  /** Update the public storefront of an agency (ADMIN only). */
  async updateProfile(
    actorId: string,
    orgId: string,
    input: {
      name?: string;
      tagline?: string;
      address?: string;
      cityLabel?: string;
      phone?: string;
      email?: string;
      description?: string;
      shortName?: string;
      logoColor?: string;
      foundedYear?: number;
      openingHours?: Record<string, unknown>;
      socialLinks?: Record<string, unknown>;
    },
  ) {
    await this.requireAdmin(actorId, orgId);
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, type: true },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organisation introuvable.',
      });
    }
    return this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.cityLabel !== undefined ? { cityLabel: input.cityLabel } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.shortName !== undefined ? { shortName: input.shortName } : {}),
        ...(input.logoColor !== undefined ? { logoColor: input.logoColor } : {}),
        ...(input.foundedYear !== undefined
          ? { foundedYear: input.foundedYear }
          : {}),
        ...(input.openingHours !== undefined
          ? { openingHours: input.openingHours as object }
          : {}),
        ...(input.socialLinks !== undefined
          ? { socialLinks: input.socialLinks as object }
          : {}),
      },
    });
  }

  /** Store the agency logo in private R2 and keep the key on the org. */
  async uploadLogo(
    actorId: string,
    orgId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ logoUrl: string }> {
    await this.requireAdmin(actorId, orgId);
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: 'Le logo doit être une image.',
      });
    }
    const { url, key } = await this.r2.uploadPrivateFile({
      folder: 'logos',
      ownerId: orgId,
      filename: file.originalname || 'logo.png',
      contentType: file.mimetype,
      body: file.buffer,
    });
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { logoKey: key },
    });
    return { logoUrl: url };
  }

  /** Replace the quartiers this agency covers (spec 02 — P2). */
  async setServiceAreas(
    actorId: string,
    orgId: string,
    quartierIds: string[],
  ): Promise<{ quartierIds: string[] }> {
    await this.requireAdmin(actorId, orgId);
    const unique = [...new Set(quartierIds)];
    if (unique.length > 0) {
      const count = await this.prisma.quartier.count({
        where: { id: { in: unique } },
      });
      if (count !== unique.length) {
        throw new BadRequestException({
          code: 'UNKNOWN_QUARTIER',
          message: 'Un ou plusieurs quartiers n’existent pas.',
        });
      }
    }
    await this.prisma.$transaction([
      this.prisma.organizationServiceArea.deleteMany({
        where: { organizationId: orgId },
      }),
      this.prisma.organizationServiceArea.createMany({
        data: unique.map((quartierId) => ({
          organizationId: orgId,
          quartierId,
        })),
      }),
    ]);
    return { quartierIds: unique };
  }

  // ------------------------------------------------------------------
  // Reviews (spec 02 — P1 / P2)
  // ------------------------------------------------------------------

  /** Real reviews only: the author must have had an eligible interaction. */
  private async isEligible(
    sourceType: ReviewSourceType,
    sourceId: string,
    userId: string,
    orgId: string,
  ): Promise<boolean> {
    switch (sourceType) {
      case ReviewSourceType.LEASE:
        return Boolean(
          await this.prisma.lease.findFirst({
            where: {
              id: sourceId,
              tenantId: userId,
              status: { in: ['ACTIVE', 'TERMINATED'] },
              property: { organizationId: orgId },
            },
            select: { id: true },
          }),
        );
      case ReviewSourceType.BOOKING:
        return Boolean(
          await this.prisma.booking.findFirst({
            where: {
              id: sourceId,
              userId,
              status: 'COMPLETED',
              property: { organizationId: orgId },
            },
            select: { id: true },
          }),
        );
      case ReviewSourceType.SALE:
        return Boolean(
          await this.prisma.saleAgreement.findFirst({
            where: {
              id: sourceId,
              buyerId: userId,
              organizationId: orgId,
              status: { in: ['ACTIVE', 'COMPLETED'] },
            },
            select: { id: true },
          }),
        );
      case ReviewSourceType.VISIT:
        return Boolean(
          await this.prisma.visitBooking.findFirst({
            where: {
              id: sourceId,
              userId,
              status: 'COMPLETED',
              property: { organizationId: orgId },
            },
            select: { id: true },
          }),
        );
      default:
        return false;
    }
  }

  /** Publish (or auto-moderate) a review and refresh the org metrics. */
  async createReview(
    authorId: string,
    orgId: string,
    input: {
      sourceType: ReviewSourceType;
      sourceId: string;
      rating: number;
      comment: string;
    },
  ) {
    const comment = input.comment?.trim() ?? '';
    if (comment.length < 20 || comment.length > 1000) {
      throw new BadRequestException({
        code: 'REVIEW_COMMENT_LENGTH',
        message: 'Le commentaire doit faire entre 20 et 1000 caractères.',
      });
    }
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new BadRequestException({
        code: 'REVIEW_RATING_RANGE',
        message: 'La note doit être un entier entre 1 et 5.',
      });
    }
    if (!(await this.isEligible(input.sourceType, input.sourceId, authorId, orgId))) {
      throw new ForbiddenException({
        code: 'REVIEW_NOT_ELIGIBLE',
        message: 'Aucune interaction éligible avec cette agence.',
      });
    }

    const duplicate = await this.prisma.organizationReview.findFirst({
      where: {
        organizationId: orgId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        authorId,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'REVIEW_ALREADY_POSTED',
        message: 'Vous avez déjà noté cette interaction.',
      });
    }

    const author = await this.prisma.user.findUniqueOrThrow({
      where: { id: authorId },
      select: { name: true, phone: true },
    });
    const flagged = BLOCKED_WORDS.some((w) =>
      comment.toLowerCase().includes(w),
    );

    const created = await this.prisma.organizationReview.create({
      data: {
        organizationId: orgId,
        authorId,
        authorName: author.name ?? author.phone ?? 'Client',
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        body: comment,
        rating: input.rating,
        status: flagged ? 'FLAGGED' : 'PUBLISHED',
      },
    });
    await this.refreshMetrics(orgId);
    return created;
  }

  /** Interactions the user could rate, minus the ones already rated. */
  async reviewEligibility(userId: string) {
    const [leases, bookings, sales, visits, posted] = await Promise.all([
      this.prisma.lease.findMany({
        where: { tenantId: userId, status: { in: ['ACTIVE', 'TERMINATED'] } },
        select: {
          id: true,
          property: { select: { organizationId: true } },
        },
      }),
      this.prisma.booking.findMany({
        where: { userId, status: 'COMPLETED' },
        select: {
          id: true,
          property: { select: { organizationId: true } },
        },
      }),
      this.prisma.saleAgreement.findMany({
        where: { buyerId: userId, status: { in: ['ACTIVE', 'COMPLETED'] } },
        select: { id: true, organizationId: true },
      }),
      this.prisma.visitBooking.findMany({
        where: { userId, status: 'COMPLETED' },
        select: {
          id: true,
          property: { select: { organizationId: true } },
        },
      }),
      this.prisma.organizationReview.findMany({
        where: { authorId: userId },
        select: { sourceType: true, sourceId: true },
      }),
    ]);

    const done = new Set(
      posted.map((r) => `${r.sourceType}:${r.sourceId}`),
    );
    const items: {
      sourceType: ReviewSourceType;
      sourceId: string;
      organizationId: string;
    }[] = [
      ...leases.map((l) => ({
        sourceType: ReviewSourceType.LEASE,
        sourceId: l.id,
        organizationId: l.property.organizationId,
      })),
      ...bookings.map((b) => ({
        sourceType: ReviewSourceType.BOOKING,
        sourceId: b.id,
        organizationId: b.property.organizationId,
      })),
      ...sales.map((s) => ({
        sourceType: ReviewSourceType.SALE,
        sourceId: s.id,
        organizationId: s.organizationId,
      })),
      ...visits.map((v) => ({
        sourceType: ReviewSourceType.VISIT,
        sourceId: v.id,
        organizationId: v.property.organizationId,
      })),
    ];
    return items.filter((i) => !done.has(`${i.sourceType}:${i.sourceId}`));
  }

  /** Public reply to a review (ADMIN of that org only). */
  async replyToReview(
    actorId: string,
    reviewId: string,
    reply: string,
  ) {
    const review = await this.requireOwnReview(actorId, reviewId);
    const text = reply.trim();
    if (text.length < 5 || text.length > 1000) {
      throw new BadRequestException({
        code: 'REPLY_LENGTH',
        message: 'La réponse doit faire entre 5 et 1000 caractères.',
      });
    }
    return this.prisma.organizationReview.update({
      where: { id: review.id },
      data: { reply: text, repliedAt: new Date() },
    });
  }

  /** Flag a review for moderation (ADMIN of that org only). */
  async flagReview(actorId: string, reviewId: string) {
    const review = await this.requireOwnReview(actorId, reviewId);
    return this.prisma.organizationReview.update({
      where: { id: review.id },
      data: { status: 'FLAGGED' },
    });
  }

  private async requireOwnReview(actorId: string, reviewId: string) {
    const review = await this.prisma.organizationReview.findUnique({
      where: { id: reviewId },
      select: { id: true, organizationId: true },
    });
    if (!review) {
      throw new NotFoundException({
        code: 'REVIEW_NOT_FOUND',
        message: 'Avis introuvable.',
      });
    }
    await this.requireAdmin(actorId, review.organizationId);
    return review;
  }

  /**
   * Recompute the org's rating / reviewCount and its 12-month deal-success
   * percentage so nothing stays a static seeded value (spec 02).
   */
  async refreshMetrics(orgId: string): Promise<void> {
    const published = await this.prisma.organizationReview.findMany({
      where: { organizationId: orgId, status: 'PUBLISHED' },
      select: { rating: true },
    });
    const rating =
      published.length > 0
        ? published.reduce((sum, r) => sum + r.rating, 0) / published.length
        : null;

    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const [concluded, requests] = await Promise.all([
      this.concludedDeals(orgId, since),
      this.receivedRequests(orgId, since),
    ]);
    const dealSuccessPercent =
      requests > 0
        ? Math.min(100, Math.round((concluded / requests) * 100))
        : null;

    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        rating,
        reviewCount: published.length,
        dealSuccessPercent,
      },
    });
  }

  private async concludedDeals(orgId: string, since: Date): Promise<number> {
    const [leases, sales] = await Promise.all([
      this.prisma.lease.count({
        where: {
          status: { in: ['ACTIVE', 'TERMINATED'] },
          createdAt: { gte: since },
          property: { organizationId: orgId },
        },
      }),
      this.prisma.saleAgreement.count({
        where: {
          organizationId: orgId,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          createdAt: { gte: since },
        },
      }),
    ]);
    return leases + sales;
  }

  private async receivedRequests(orgId: string, since: Date): Promise<number> {
    const [inquiries, bookings] = await Promise.all([
      this.prisma.saleInquiry.count({
        where: { createdAt: { gte: since }, property: { organizationId: orgId } },
      }),
      this.prisma.booking.count({
        where: { createdAt: { gte: since }, property: { organizationId: orgId } },
      }),
    ]);
    return inquiries + bookings;
  }
}
