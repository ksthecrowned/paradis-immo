import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { OtpStore } from '../../src/auth/otp.store';
import { EventPublisher } from '../../src/events/event.publisher';
import { PrismaService } from '../../src/prisma/prisma.service';
import { loginWithOtp } from './helpers';

describe('Flow — mandate lease blocked until owner approves (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpStore: OtpStore;

  const ownerPhone = '+242069100001';
  const agentPhone = '+242069100002';
  const tenantPhone = '+242069100003';

  let ownerToken: string;
  let agentToken: string;
  let ownerId: string;
  let agentId: string;
  let tenantId: string;
  let agentOrgId: string;
  let propertyId: string;
  let mandateId: string;
  let leaseId: string;
  let approvalId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EventPublisher)
      .useValue({ emit: jest.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = moduleRef.get(PrismaService);
    otpStore = moduleRef.get(OtpStore);

    const ownerLogin = await loginWithOtp(app, otpStore, ownerPhone);
    ownerToken = ownerLogin.token;
    ownerId = ownerLogin.userId;

    const agentLogin = await loginWithOtp(app, otpStore, agentPhone);
    agentToken = agentLogin.token;
    agentId = agentLogin.userId;

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    const quartier = await prisma.quartier.findFirst();
    if (!cg || !quartier) throw new Error('Seed required first');

    const tenant = await prisma.user.upsert({
      where: {
        phone_countryId: { phone: tenantPhone, countryId: cg.id },
      },
      update: {},
      create: {
        phone: tenantPhone,
        countryId: cg.id,
        name: 'Flow Tenant',
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantId = tenant.id;

    const agentOrg = await prisma.organization.create({
      data: {
        name: `Flow Agent Org ${Date.now()}`,
        type: 'AGENCY',
        countryId: cg.id,
        members: { create: { userId: agentId, role: 'AGENT' } },
      },
    });
    agentOrgId = agentOrg.id;

    await prisma.organizationMember.upsert({
      where: {
        userId_organizationId: {
          userId: agentId,
          organizationId: 'org_paradis_immo',
        },
      },
      create: {
        userId: agentId,
        organizationId: 'org_paradis_immo',
        role: 'AGENT',
      },
      update: { role: 'AGENT' },
    });

    const property = await prisma.property.create({
      data: {
        title: 'Flow Mandate Lease Property',
        description: 'E2E mandate lease',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 120000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'Flow test',
        countryId: cg.id,
        ownerId,
        organizationId: 'org_paradis_immo',
      },
    });
    propertyId = property.id;
  });

  afterAll(async () => {
    if (leaseId) {
      await prisma.rentSchedule.deleteMany({ where: { leaseId } }).catch(() => undefined);
      await prisma.lease.delete({ where: { id: leaseId } }).catch(() => undefined);
    }
    if (approvalId) {
      await prisma.mandateApproval.delete({ where: { id: approvalId } }).catch(() => undefined);
    }
    if (mandateId) {
      await prisma.mandate.delete({ where: { id: mandateId } }).catch(() => undefined);
    }
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: {
        userId: agentId,
        organizationId: 'org_paradis_immo',
      },
    });
    await prisma.organizationMember.deleteMany({ where: { organizationId: agentOrgId } });
    await prisma.organization.delete({ where: { id: agentOrgId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: tenantId } }).catch(() => undefined);
    await app.close();
  });

  it('owner delegates the property via mandate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/mandates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ propertyId, organizationId: agentOrgId })
      .expect(201);
    expect(res.body.status).toBe('ACTIVE');
    mandateId = res.body.id;
  });

  it('agent creates a draft lease', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        propertyId,
        tenantId,
        startDate: new Date('2026-03-01T00:00:00Z').toISOString(),
        endDate: new Date('2026-08-31T00:00:00Z').toISOString(),
        monthlyRent: 120000,
        deposit: 240000,
        currency: 'XAF',
      })
      .expect(201);
    expect(res.body.status).toBe('DRAFT');
    leaseId = res.body.id;
  });

  it('activation is blocked until LEASE_SIGN is approved', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/leases/${leaseId}/activate`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('LEASE_SIGN');
      });
  });

  it('agent requests LEASE_SIGN approval', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/request-sign`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.actionType).toBe('LEASE_SIGN');
    approvalId = res.body.id;
  });

  it('owner sees the pending approval', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/mandates/pending-approvals')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.some((row: { id: string }) => row.id === approvalId)).toBe(true);
  });

  it('owner approves LEASE_SIGN then agent activates the lease', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/mandates/approvals/${approvalId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ approve: true })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('APPROVED');
      });

    const activated = await request(app.getHttpServer())
      .patch(`/api/v1/leases/${leaseId}/activate`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect(activated.body.status).toBe('ACTIVE');

    const schedule = await request(app.getHttpServer())
      .get(`/api/v1/leases/${leaseId}/schedule`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect(schedule.body.length).toBeGreaterThan(0);
  });
});
