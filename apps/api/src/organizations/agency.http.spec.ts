import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { InfobipOtpService } from '../auth/infobip-otp.service';
import { R2Service } from '../media/r2.service';
import { AgencyService } from './agency.service';
import {
  AdminOrganizationRequestsController,
  AgencyController,
} from './agency.controller';
import { InvitationsController } from './invitations.controller';

/**
 * End-to-end over HTTP (spec 02): the public sign-up form grants nothing, the
 * PLATFORM_ADMIN approves it into an organization + invitation, and the
 * invited founder only joins after accepting the token.
 */
describe('Agency request → invitation HTTP (spec 02)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const founderEmail = 'http-founder@example.com';
  const inviteUrlHolder: { url?: string } = {};
  const sentEmails: string[] = [];

  const founderPhone = '+242064500001';
  const adminPhone = '+242064500002';
  let founderId: string;
  let adminId: string;
  let requestId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AgencyController,
        AdminOrganizationRequestsController,
        InvitationsController,
      ],
      providers: [
        AgencyService,
        PrismaService,
        {
          provide: EmailService,
          useValue: {
            sendText: async (_to: string, _s: string, body: string) => {
              sentEmails.push(body);
            },
            sendMagicLink: async () => undefined,
          },
        },
        {
          provide: InfobipOtpService,
          useValue: { sendText: async () => undefined, sendOtp: async () => undefined },
        },
        { provide: R2Service, useValue: { uploadPrivateFile: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country = await prisma.country.findFirstOrThrow();
    // Defensive: wipe leftovers from a previous run before touching users.
    await prisma.organizationInvitation.deleteMany({
      where: { organization: { name: 'HTTP Immo' } },
    });
    const staleOrgs = await prisma.organization.findMany({
      where: { name: 'HTTP Immo' },
      select: { id: true },
    });
    const staleOrgIds = staleOrgs.map((o) => o.id);
    await prisma.organizationMember.deleteMany({
      where: { organizationId: { in: staleOrgIds } },
    });
    if (staleOrgIds.length) {
      await prisma.organization.deleteMany({ where: { id: { in: staleOrgIds } } });
    }
    await prisma.organizationRequest.deleteMany({ where: { name: 'HTTP Immo' } });

    await prisma.user.deleteMany({
      where: { phone: { in: [founderPhone, adminPhone] } },
    });
    const founder = await prisma.user.create({
      data: {
        phone: founderPhone,
        email: founderEmail,
        emailVerifiedAt: new Date(),
        countryId: country.id,
        name: 'HTTP Founder',
      },
    });
    founderId = founder.id;
    const admin = await prisma.user.create({
      data: { phone: adminPhone, countryId: country.id, name: 'HTTP Admin' },
    });
    adminId = admin.id;
    await prisma.userRole.create({
      data: { userId: adminId, role: 'PLATFORM_ADMIN' },
    });
  });

  afterAll(async () => {
    await prisma.organizationInvitation.deleteMany({
      where: { organization: { name: 'HTTP Immo' } },
    });
    const orgIds = (
      await prisma.organization.findMany({
        where: { name: 'HTTP Immo' },
        select: { id: true },
      })
    ).map((o) => o.id);
    await prisma.organizationMember.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    if (orgIds.length) {
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    await prisma.organizationRequest.deleteMany({ where: { name: 'HTTP Immo' } });
    const userIds = [founderId, adminId].filter(Boolean);
    if (userIds.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (app) await app.close();
    if (prisma) await prisma.onModuleDestroy();
  });

  it('accepts the public form without any session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/organizations/requests')
      .send({ type: 'AGENCY', name: 'HTTP Immo', email: founderEmail, rccm: 'R-1' })
      .expect(202);
    requestId = res.body.reference;
    expect(res.body.status).toBe('PENDING');

    // Nothing granted: no organization, no membership.
    expect(await prisma.organization.count({ where: { name: 'HTTP Immo' } })).toBe(0);
  });

  it('rejects a form without an e-mail (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations/requests')
      .send({ type: 'AGENCY', name: 'Sans email', rccm: 'R-2' })
      .expect(400);
  });

  it('refuses approval to a non-admin (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/organization-requests/${requestId}`)
      .set('x-test-user', founderId)
      .set('x-test-roles', 'TENANT')
      .send({ action: 'INVITE' })
      .expect(403);
  });

  it('approves into an organization with zero members plus an invitation link', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/organization-requests/${requestId}`)
      .set('x-test-user', adminId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ action: 'INVITE' })
      .expect(200);
    inviteUrlHolder.url = res.body.inviteUrl;
    expect(res.body.organizationId).toBeTruthy();
    expect(sentEmails.join(' ')).toContain('/invitations/');

    const members = await prisma.organizationMember.count({
      where: { organizationId: res.body.organizationId },
    });
    expect(members).toBe(0);
  });

  it('validates the token before anything else (public preview)', async () => {
    const token = inviteUrlHolder.url!.split('/invitations/')[1]!;
    const res = await request(app.getHttpServer())
      .get(`/api/v1/invitations/${token}`)
      .expect(200);
    expect(res.body.role).toBe('ADMIN');
    expect(res.body.email).toBe(founderEmail);
    expect(res.body.methods).toEqual(['password', 'google']);

    await request(app.getHttpServer())
      .get('/api/v1/invitations/not-a-real-token')
      .expect(404);
  });

  it('lets the invited founder sign in and accept', async () => {
    const token = inviteUrlHolder.url!.split('/invitations/')[1]!;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/invitations/${token}/accept`)
      .set('x-test-user', founderId)
      .expect(200);
    expect(res.body.role).toBe('ADMIN');

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: res.body.organizationId },
    });
    expect(members).toHaveLength(1);
    expect(members[0]!.userId).toBe(founderId);

    // Single use: the same token cannot be consumed twice (410).
    await request(app.getHttpServer())
      .post(`/api/v1/invitations/${token}/accept`)
      .set('x-test-user', adminId)
      .expect(410);
  });
});
