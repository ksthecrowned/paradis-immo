import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { OrgMemberRole, ReviewSourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { InfobipOtpService } from '../auth/infobip-otp.service';
import { R2Service } from '../media/r2.service';
import { AgencyService } from './agency.service';

describe('AgencyService (spec 02)', () => {
  let agency: AgencyService;
  let prisma: PrismaService;
  let countryId: string;
  let quartierId: string;
  let managerId: string;
  let agentId: string;
  let outsiderId: string;
  let adminId: string;
  let orgId: string;
  let leaseId: string;
  let propertyId: string;
  let inviteToken: string;
  let inviteId: string;
  let requestId: string;

  const phones = ['+242064400001', '+242064400002', '+242064400003', '+242064400004'];
  const managerEmail = 'spec02-founder@example.com';
  let sentTexts: string[] = [];
  let sentEmails: string[] = [];

  const fakeEmail = {
    sendText: jest.fn(async (_to: string, subject: string, body: string) => {
      sentEmails.push(`${subject}|${body}`);
    }),
    sendMagicLink: jest.fn(async () => undefined),
  };
  const fakeInfobip = {
    sendText: jest.fn(async (m: { text: string }) => {
      sentTexts.push(m.text);
    }),
    sendOtp: jest.fn(async () => undefined),
  };
  const fakeR2 = {
    uploadPrivateFile: jest.fn(async (p: { ownerId: string; filename: string }) => ({
      url: `https://fake.r2/logos/${p.ownerId}/${p.filename}`,
      key: `logos/${p.ownerId}/${p.filename}`,
    })),
    createPresignedDownload: jest.fn(async (key: string) => `https://fake.r2/${key}`),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgencyService,
        PrismaService,
        { provide: EmailService, useValue: fakeEmail },
        { provide: InfobipOtpService, useValue: fakeInfobip },
        { provide: R2Service, useValue: fakeR2 },
      ],
    }).compile();
    agency = moduleRef.get(AgencyService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country = await prisma.country.findFirstOrThrow();
    countryId = country.id;
    const quartier = await prisma.quartier.findFirstOrThrow();
    quartierId = quartier.id;

    // Defensive: remove leftovers from a previous run of this spec.
    await prisma.organizationInvitation.deleteMany({
      where: { organization: { name: 'Spec02 Immo' } },
    });
    await prisma.organizationMember.deleteMany({
      where: { organization: { name: 'Spec02 Immo' } },
    });
    await prisma.organization.deleteMany({ where: { name: 'Spec02 Immo' } });
    await prisma.organizationRequest.deleteMany({
      where: { name: 'Spec02 Immo' },
    });
    await prisma.user.deleteMany({ where: { phone: { in: phones } } });
    const [manager, agent, outsider, admin] = await Promise.all(
      phones.map((phone, i) =>
        prisma.user.create({
          data: {
            phone,
            countryId,
            name: `Spec02 User ${i}`,
            ...(i === 0 ? { email: managerEmail, emailVerifiedAt: new Date() } : {}),
          },
        }),
      ),
    );
    managerId = manager.id;
    agentId = agent.id;
    outsiderId = outsider.id;
    adminId = admin.id;
  });

  afterAll(async () => {
    const ids = [managerId, agentId, outsiderId, adminId].filter(Boolean);
    await prisma.organizationRequest.deleteMany({
      where: { name: 'Spec02 Immo' },
    });
    await prisma.organizationReview.deleteMany({
      where: { organizationId: orgId ?? '' },
    });
    if (propertyId) {
      await prisma.lease.deleteMany({ where: { propertyId } });
      await prisma.property.deleteMany({ where: { id: propertyId } });
    }
    await prisma.organizationInvitation.deleteMany({
      where: { organizationId: orgId ?? '' },
    });
    await prisma.organizationServiceArea.deleteMany({
      where: { organizationId: orgId ?? '' },
    });
    await prisma.organizationMember.deleteMany({
      where: { organizationId: orgId ?? '' },
    });
    await prisma.organization.deleteMany({ where: { id: orgId ?? '' } });
    if (ids.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.onModuleDestroy();
  });

  it('the sign-up form grants nothing to the applicant (spec 02)', async () => {
    const submitted = await agency.submitRequest({
      type: 'AGENCY',
      name: 'Spec02 Immo',
      email: managerEmail,
      rccm: 'BZV-123',
      niu: 'NIU-456',
      submittedById: managerId,
    });
    requestId = submitted.reference;
    expect(submitted.status).toBe('PENDING');

    // No self-service: no organization, no role, no dashboard access.
    expect(
      await prisma.organization.count({ where: { name: 'Spec02 Immo' } }),
    ).toBe(0);
    expect(
      await prisma.organizationMember.count({ where: { userId: managerId } }),
    ).toBe(0);
  });

  it('rejects a form without an e-mail (the invitation target)', async () => {
    await expect(
      agency.submitRequest({ type: 'OWNER', name: 'Sans email' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires an RCCM to open an agency', async () => {
    await expect(
      agency.submitRequest({ type: 'AGENCY', name: 'No RCCM', email: 'a@b.co' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('admin approval creates the org and issues the invitation link', async () => {
    sentEmails = [];
    const result = await agency.reviewRequest(adminId, requestId, {
      action: 'INVITE',
    });
    orgId = result.organizationId!;
    expect(orgId).toBeTruthy();
    expect(sentEmails[0]).toContain('/invitations/');

    // The founder is NOT a member yet — only the invitation grants access.
    expect(
      await prisma.organizationMember.count({ where: { organizationId: orgId } }),
    ).toBe(0);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });
    expect(org.type).toBe('AGENCY');
    // The admin validating the dossier is the affiliation approval.
    expect(org.affiliationStatus).toBe('APPROVED');
    expect(org.rccm).toBe('BZV-123');
    expect(org.approvedBy).toBe(adminId);

    const match = /\/invitations\/([A-Za-z0-9_-]+)/.exec(result.inviteUrl!);
    inviteToken = match![1]!;

    const request = await prisma.organizationRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    expect(request.status).toBe('INVITED');
    expect(request.reviewedBy).toBe(adminId);
  });

  it('rejects reviewing the same dossier twice', async () => {
    await expect(
      agency.reviewRequest(adminId, requestId, { action: 'INVITE' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('the invited founder validates the token then signs in as ADMIN', async () => {
    const preview = await agency.previewInvitation(inviteToken);
    expect(preview.role).toBe(OrgMemberRole.ADMIN);
    expect(preview.email).toBe(managerEmail);
    expect(preview.methods).toEqual(['password', 'google']);

    const joined = await agency.acceptInvitation(managerId, inviteToken);
    expect(joined.role).toBe(OrgMemberRole.ADMIN);

    const members = await agency.listMembers(managerId, orgId);
    expect(members).toHaveLength(1);
    expect(members[0]!.userId).toBe(managerId);
    expect(members[0]!.status).toBe('ACTIVE');
  });

  it('refuses member listing to a non-member', async () => {
    await expect(agency.listMembers(outsiderId, orgId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('invites an agent by phone and the target can accept', async () => {
    sentTexts = [];
    const invitation = await agency.createInvitation(managerId, orgId, {
      phone: phones[1],
      role: OrgMemberRole.AGENT,
    });
    inviteId = invitation.id;
    expect(invitation.status).toBe('PENDING');
    expect(sentTexts[0]).toContain(`/invitations/`);

    const match = /\/invitations\/([A-Za-z0-9_-]+)/.exec(sentTexts[0]!);
    inviteToken = match![1]!;

    const preview = await agency.previewInvitation(inviteToken);
    expect(preview.role).toBe('AGENT');

    const joined = await agency.acceptInvitation(agentId, inviteToken);
    expect(joined.role).toBe('AGENT');

    const members = await agency.listMembers(managerId, orgId);
    expect(members.map((m) => m.userId)).toContain(agentId);
  });

  it('rejects reusing an already accepted invitation with 410', async () => {
    await expect(agency.acceptInvitation(outsiderId, inviteToken)).rejects.toBeInstanceOf(
      GoneException,
    );
  });

  it('refuses an invitation addressed to another phone', async () => {
    sentTexts = [];
    const invitation = await agency.createInvitation(managerId, orgId, {
      phone: phones[2],
      role: OrgMemberRole.AGENT,
    });
    const match = /\/invitations\/([A-Za-z0-9_-]+)/.exec(
      sentTexts[0] ?? invitation.inviteUrl ?? '',
    );
    const token = match?.[1] ?? '';
    await expect(
      agency.acceptInvitation(agentId, token),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await agency.revokeInvitation(managerId, orgId, invitation.id);
  });

  it('blocks removing the last ACTIVE admin (409 LAST_ADMIN)', async () => {
    await expect(
      agency.removeMember(managerId, orgId, managerId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reassigns an agent’s mandates and notifies managers on removal', async () => {
    // Own property: picking an arbitrary one (findFirstOrThrow) can lease or
    // mandate another suite's row and block its cleanup in parallel runs.
    const property = await prisma.property.create({
      data: {
        title: 'Spec02 Mandate Property',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId,
        address: 'x',
        countryId,
        ownerId: managerId,
        organizationId: orgId,
      },
    });
    const mandate = await prisma.mandate.create({
      data: {
        propertyId: property.id,
        organizationId: orgId,
        assignedAgentId: agentId,
        proposedById: managerId,
      },
    });

    const result = await agency.removeMember(managerId, orgId, agentId);
    expect(result.removed).toBe(true);
    expect(result.mandatesReassigned).toBe(1);

    const after = await prisma.mandate.findUniqueOrThrow({
      where: { id: mandate.id },
    });
    expect(after.assignedAgentId).toBeNull();

    const notifications = await prisma.notification.count({
      where: { userId: managerId, type: 'AGENT_REMOVED' },
    });
    expect(notifications).toBeGreaterThanOrEqual(1);

    await prisma.mandate.deleteMany({ where: { id: mandate.id } });
    await prisma.property.deleteMany({ where: { id: property.id } });
    await prisma.notification.deleteMany({
      where: { userId: managerId, type: 'AGENT_REMOVED' },
    });
  });

  it('rejects a review with no eligible interaction (403)', async () => {
    await expect(
      agency.createReview(outsiderId, orgId, {
        sourceType: ReviewSourceType.LEASE,
        sourceId: 'nonexistent',
        rating: 5,
        comment: 'Un commentaire d’au moins vingt caractères.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts a review for a real lease, recomputes rating, rejects duplicates', async () => {
    const property = await prisma.property.create({
      data: {
        title: 'Spec02 Property',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId,
        address: 'x',
        countryId,
        ownerId: managerId,
        organizationId: orgId,
      },
    });
    propertyId = property.id;
    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: outsiderId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        monthlyRent: 100000,
        deposit: 200000,
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });
    leaseId = lease.id;

    await agency.createReview(outsiderId, orgId, {
      sourceType: ReviewSourceType.LEASE,
      sourceId: leaseId,
      rating: 4,
      comment: 'Un commentaire d’au moins vingt caractères.',
    });

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });
    expect(org.reviewCount).toBe(1);
    expect(org.rating).toBe(4);

    await expect(
      agency.createReview(outsiderId, orgId, {
        sourceType: ReviewSourceType.LEASE,
        sourceId: leaseId,
        rating: 5,
        comment: 'Deuxième commentaire avec vingt caractères min.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('auto-moderates a review containing a blocked word', async () => {
    // The manager needs their own eligible interaction first.
    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: managerId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        monthlyRent: 100000,
        deposit: 200000,
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });

    const created = await agency.createReview(managerId, orgId, {
      sourceType: ReviewSourceType.LEASE,
      sourceId: lease.id,
      rating: 1,
      comment: 'Cette agence est une arnaque complète et scandaleuse.',
    });
    expect(created.status).toBe('FLAGGED');

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });
    // FLAGGED reviews never count toward the public rating.
    expect(org.reviewCount).toBe(1);
    expect(org.rating).toBe(4);
  });
});
