import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { AdminModule } from '../admin/admin.module';
import { ReportsModule } from './reports.module';

describe('Property reports (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ownerId = 'user_reports_owner';
  const visitorId = 'user_reports_visitor';
  const adminId = 'user_reports_admin';
  const propertyId = 'prop_reports_test';
  let organizationId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ReportsModule, AdminModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findFirstOrThrow();
    const quartier = await prisma.quartier.findFirstOrThrow();
    const org = await prisma.organization.findFirstOrThrow({
      where: { countryId: cg.id },
    });
    organizationId = org.id;

    for (const [id, phone] of [
      [ownerId, '+242060000301'],
      [visitorId, '+242060000302'],
      [adminId, '+242060000303'],
    ] as const) {
      await prisma.user.upsert({
        where: { id },
        create: { id, phone, countryId: cg.id },
        update: {},
      });
    }

    const existingRole = await prisma.userRole.findFirst({
      where: { userId: adminId, role: 'PLATFORM_ADMIN' },
    });
    if (!existingRole) {
      await prisma.userRole.create({
        data: { userId: adminId, role: 'PLATFORM_ADMIN' },
      });
    }

    await prisma.property.upsert({
      where: { id: propertyId },
      create: {
        id: propertyId,
        ownerId,
        organizationId,
        title: 'Reports test property',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        status: 'ACTIVE',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'test',
        countryId: cg.id,
      },
      update: { status: 'ACTIVE' },
    });

    await prisma.propertyReport.deleteMany({ where: { propertyId } });
  });

  afterAll(async () => {
    await prisma.propertyReport.deleteMany({ where: { propertyId } });
    await prisma.property.deleteMany({ where: { id: propertyId } });
    await prisma.userRole.deleteMany({ where: { userId: adminId } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, visitorId, adminId] } },
    });
    await app.close();
    await prisma.onModuleDestroy();
  });

  it('creates an anonymous report with deviceId', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/reports`)
      .send({ reason: 'FRAUDULENT', deviceId: 'device-report-1' })
      .expect(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.status).toBe('OPEN');
  });

  it('rejects duplicate open report from same device', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/reports`)
      .send({ reason: 'DUPLICATE', deviceId: 'device-report-1' })
      .expect(409);
  });

  it('requires description when reason is OTHER', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/reports`)
      .send({ reason: 'OTHER', deviceId: 'device-report-2' })
      .expect(400);
  });

  it('creates authenticated report and lists it for admin', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/reports`)
      .set('x-test-user', visitorId)
      .send({
        reason: 'INCORRECT_INFO',
        description: 'Prix faux',
        deviceId: 'ignored',
      })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/reports')
      .query({ status: 'OPEN' })
      .set('x-test-user', adminId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);

    expect(list.body.data.length).toBeGreaterThanOrEqual(2);
    expect(
      list.body.data.some(
        (r: { propertyId: string }) => r.propertyId === propertyId,
      ),
    ).toBe(true);
  });

  it('lets admin dismiss a report', async () => {
    const open = await prisma.propertyReport.findFirstOrThrow({
      where: { propertyId, status: 'OPEN' },
    });
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/reports/${open.id}`)
      .set('x-test-user', adminId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ status: 'DISMISSED', adminNote: 'Pas de fond' })
      .expect(200);
    expect(res.body.data.status).toBe('DISMISSED');
  });
});
