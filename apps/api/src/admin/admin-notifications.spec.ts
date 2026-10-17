import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { InfobipService } from '../notifications/infobip.service';
import { FcmService } from '../notifications/fcm.service';
import { AdminModule } from './admin.module';

/**
 * Spec 11/12 — endpoints admin de supervision des envois :
 *  - GET  /admin/notifications/failed
 *  - POST /admin/notifications/:id/retry
 *
 * Auth test : headers `x-test-user` / `x-test-roles` (AppAuthGuard).
 */
describe('Admin notifications failed/retry (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminUserId: string;
  let tenantUserId: string;
  let countryId: string;
  const sendWhatsApp = jest.fn();
  const createdNotificationIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule],
    })
      .overrideProvider(EventPublisher)
      .useValue({ emit: jest.fn() })
      .overrideProvider(InfobipService)
      .useValue({ sendWhatsApp })
      .overrideProvider(FcmService)
      .useValue({ sendPush: jest.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;

    const leftover = await prisma.user.findMany({
      where: {
        phone: { in: ['+242070000211', '+242070000212'] },
      },
      select: { id: true },
    });
    if (leftover.length > 0) {
      const ids = leftover.map((u) => u.id);
      await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }

    const admin = await prisma.user.create({
      data: {
        phone: '+242070000211',
        countryId,
        roles: { create: { role: 'PLATFORM_ADMIN' } },
      },
    });
    adminUserId = admin.id;

    const tenant = await prisma.user.create({
      data: {
        phone: '+242070000212',
        countryId,
        name: 'Notif Retry Tenant',
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;
  });

  afterAll(async () => {
    if (createdNotificationIds.length) {
      await prisma.notification
        .deleteMany({ where: { id: { in: createdNotificationIds } } })
        .catch(() => undefined);
    }
    const ids = [adminUserId, tenantUserId].filter(Boolean);
    if (ids.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
    await prisma.onModuleDestroy();
  });

  beforeEach(() => {
    sendWhatsApp.mockReset();
  });

  async function seedFailed(overrides?: {
    status?: NotificationStatus;
    attempts?: number;
    lastError?: string;
  }) {
    const row = await prisma.notification.create({
      data: {
        userId: tenantUserId,
        channel: NotificationChannel.WHATSAPP,
        type: 'RENT_DUE_SOON',
        payload: { amount: '150000' },
        status: overrides?.status ?? NotificationStatus.FAILED,
        attempts: overrides?.attempts ?? 3,
        lastError: overrides?.lastError ?? 'PROVIDER_DOWN',
        retryAfter: null,
      },
    });
    createdNotificationIds.push(row.id);
    return row;
  }

  it('returns 403 when the caller is not PLATFORM_ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/notifications/failed')
      .set('x-test-user', tenantUserId)
      .set('x-test-roles', 'TENANT')
      .expect(403);
  });

  it('returns 401 when there is no auth', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/notifications/failed')
      .expect(401);
  });

  it('lists FAILED notifications with attempts, lastError and masked phone', async () => {
    const failed = await seedFailed();
    const queued = await seedFailed({
      status: NotificationStatus.QUEUED,
      attempts: 1,
      lastError: 'PROVIDER_DOWN',
    });
    await prisma.notification.update({
      where: { id: queued.id },
      data: { retryAfter: new Date(Date.now() + 60_000) },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/notifications/failed')
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);

    const body = res.body as {
      statusCode: number;
      data: Array<{
        id: string;
        status: string;
        attempts: number;
        lastError: string | null;
        recipient: { phoneMasked: string | null; userId: string };
      }>;
      meta: { total: number; page: number; pageSize: number };
    };

    expect(body.statusCode).toBe(200);
    expect(body.meta.total).toBeGreaterThanOrEqual(2);
    const ids = body.data.map((r) => r.id);
    expect(ids).toContain(failed.id);
    expect(ids).toContain(queued.id);

    const failedRow = body.data.find((r) => r.id === failed.id)!;
    expect(failedRow.status).toBe('FAILED');
    expect(failedRow.attempts).toBe(3);
    expect(failedRow.lastError).toBe('PROVIDER_DOWN');
    expect(failedRow.recipient.userId).toBe(tenantUserId);
    expect(failedRow.recipient.phoneMasked).toMatch(/^\+242\*\*\*\d{3}$/);
    expect(failedRow.recipient.phoneMasked).not.toContain('070000212');
  });

  it('filters by status=FAILED', async () => {
    const failed = await seedFailed();
    await seedFailed({
      status: NotificationStatus.QUEUED,
      attempts: 1,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/notifications/failed?status=FAILED')
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);

    const body = res.body as {
      data: Array<{ id: string; status: string }>;
    };
    expect(body.data.every((r) => r.status === 'FAILED')).toBe(true);
    expect(body.data.some((r) => r.id === failed.id)).toBe(true);
  });

  it('retries a FAILED notification and returns the new status', async () => {
    const failed = await seedFailed();
    sendWhatsApp.mockResolvedValue({
      ok: true,
      providerMessageId: 'wa-admin-retry',
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/notifications/${failed.id}/retry`)
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);

    const body = res.body as {
      statusCode: number;
      data: { id: string; status: string; attempts: number };
    };
    expect(body.statusCode).toBe(200);
    expect(body.data.id).toBe(failed.id);
    expect(body.data.status).toBe('SENT');
    expect(sendWhatsApp).toHaveBeenCalled();

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'notification.retry',
        targetId: failed.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(adminUserId);
  });

  it('returns 404 when retrying an unknown id', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/notifications/does-not-exist/retry')
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(404);
  });

  it('returns 400 when retrying a SENT notification', async () => {
    const sent = await prisma.notification.create({
      data: {
        userId: tenantUserId,
        channel: NotificationChannel.WHATSAPP,
        type: 'PAYMENT_RECEIVED',
        payload: {},
        status: NotificationStatus.SENT,
        attempts: 1,
        sentAt: new Date(),
      },
    });
    createdNotificationIds.push(sent.id);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/notifications/${sent.id}/retry`)
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(400);
  });

  it('returns 403 when a non-admin retries', async () => {
    const failed = await seedFailed();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/notifications/${failed.id}/retry`)
      .set('x-test-user', tenantUserId)
      .set('x-test-roles', 'TENANT')
      .expect(403);
  });
});
