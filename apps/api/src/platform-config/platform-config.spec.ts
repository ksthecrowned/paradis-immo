import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsController } from '../notifications/notifications.controller';
import { UserDevicesController } from '../notifications/notifications.controller';
import { NotificationsService } from '../notifications/notifications.service';
import { FcmService } from '../notifications/fcm.service';
import { InfobipService } from '../notifications/infobip.service';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';

/**
 * Specs 11/12/14 — device registration and the public bootstrap config.
 *
 * - `POST /notifications/devices` claims a token, revoking its use by another
 *   account; re-registering the same deviceId refreshes the row.
 * - `DELETE /notifications/devices/:deviceId` unregisters (logout path).
 * - `GET /app/config` is PUBLIC and returns active announcements strictly
 *   bounded by their window, plus a per-platform `minVersion`.
 */
describe('Devices + AppConfig (specs 11/12/14)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let otherUserId: string;
  let countryId: string;
  const stamp = Date.now();
  const TOKEN_A = `token-A-${stamp}`;
  const TOKEN_B = `token-B-${stamp}`;
  const DEVICE_ID = `dev-${stamp}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController, UserDevicesController, PlatformConfigController],
      providers: [
        NotificationsService,
        PlatformConfigService,
        PrismaService,
        { provide: FcmService, useValue: { sendPush: jest.fn() } },
        { provide: InfobipService, useValue: { sendSms: jest.fn(), sendWhatsApp: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!country) throw new Error('Run seed first');
    countryId = country.id;

    const phone1 = `+242092${String(stamp % 10000000).padStart(7, '0')}`;
    const phone2 = `+242093${String((stamp + 1) % 10000000).padStart(7, '0')}`;
    await prisma.user.deleteMany({ where: { phone: { in: [phone1, phone2] } } });

    const u1 = await prisma.user.create({
      data: { phone: phone1, countryId, roles: { create: { role: 'TENANT' } } },
    });
    userId = u1.id;
    const u2 = await prisma.user.create({
      data: { phone: phone2, countryId, roles: { create: { role: 'TENANT' } } },
    });
    otherUserId = u2.id;
  });

  afterAll(async () => {
    const userIds = [userId, otherUserId].filter(Boolean);
    if (userIds.length) {
      await prisma.userDevice.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.systemAnnouncement.deleteMany({
      where: { title: { startsWith: `SpecCfg ${stamp}` } },
    });
    // Restore the conservative default policy row mutated by tests.
    await prisma.appVersionPolicy.updateMany({
      where: { platform: 'ANDROID' },
      data: { minVersion: '0.0.0', latestVersion: '0.0.0' },
    });
    await app.close();
    await prisma.onModuleDestroy();
  });

  it('POST /notifications/devices registers a device (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/notifications/devices')
      .set('x-test-user', userId)
      .send({
        deviceId: DEVICE_ID,
        fcmToken: TOKEN_A,
        platform: 'ANDROID',
        appVersion: '1.2.3',
        locale: 'fr',
      })
      .expect(201);

    expect(res.body.deviceId).toBe(DEVICE_ID);
    expect(res.body.platform).toBe('ANDROID');
    expect(res.body.lastSeenAt).toBeTruthy();
    // fcmToken is never echoed back.
    expect(JSON.stringify(res.body)).not.toContain(TOKEN_A);
  });

  it('re-registering the same deviceId refreshes instead of duplicating', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/notifications/devices')
      .set('x-test-user', userId)
      .send({
        deviceId: DEVICE_ID,
        fcmToken: TOKEN_B,
        platform: 'ANDROID',
        appVersion: '1.2.4',
      })
      .expect(201);

    const rows = await prisma.userDevice.findMany({
      where: { userId, deviceId: DEVICE_ID },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].fcmToken).toBe(TOKEN_B);
    expect(rows[0].appVersion).toBe('1.2.4');

    // The old token row was replaced (no leftover TOKEN_A row).
    const oldTokenRows = await prisma.userDevice.findMany({
      where: { fcmToken: TOKEN_A },
    });
    expect(oldTokenRows).toHaveLength(0);
  });

  it('claims a token already used by another account', async () => {
    // otherUserId steals TOKEN_B (simulates reinstall with another account).
    await request(app.getHttpServer())
      .post('/api/v1/notifications/devices')
      .set('x-test-user', otherUserId)
      .send({ deviceId: DEVICE_ID, fcmToken: TOKEN_B, platform: 'IOS' })
      .expect(201);

    const mine = await prisma.userDevice.findMany({ where: { userId } });
    expect(mine).toHaveLength(0);
    const theirs = await prisma.userDevice.findMany({
      where: { userId: otherUserId },
    });
    expect(theirs).toHaveLength(1);
  });

  it('GET /notifications/devices lists only my devices', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications/devices')
      .set('x-test-user', userId)
      .expect(200);
    expect(res.body).toHaveLength(0);
  });

  it('DELETE /notifications/devices/:deviceId unregisters (logout)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/notifications/devices/${DEVICE_ID}`)
      .set('x-test-user', otherUserId)
      .expect(204);

    const rows = await prisma.userDevice.findMany({
      where: { userId: otherUserId },
    });
    expect(rows).toHaveLength(0);
  });

  it('documented alias: POST users/me/devices + DELETE users/me/devices/:id', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users/me/devices')
      .set('x-test-user', userId)
      .send({
        deviceId: DEVICE_ID,
        fcmToken: TOKEN_A,
        platform: 'ANDROID',
      })
      .expect(201);

    const mine = await prisma.userDevice.findMany({ where: { userId } });
    expect(mine).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/api/v1/users/me/devices/${DEVICE_ID}`)
      .set('x-test-user', userId)
      .expect(204);
    expect(
      await prisma.userDevice.findMany({ where: { userId } }),
    ).toHaveLength(0);
  });

  it('GET /app/config is public with version policy from the migration seed', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/app/config')
      .expect(200);

    expect(res.body.versions.android.minVersion).toBe('0.0.0');
    expect(res.body.versions.ios).toBeTruthy();
    expect(Array.isArray(res.body.announcements)).toBe(true);
    expect(Array.isArray(res.body.announcements) && res.body.announcements.length).toBe(0);
  });

  it('GET /app/config returns only announcements inside their window', async () => {
    const base = `SpecCfg ${stamp}`;
    await prisma.systemAnnouncement.create({
      data: {
        title: `${base} active`,
        body: 'Maintenance planifiée',
        audience: 'ALL',
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 3_600_000),
        active: true,
      },
    });
    // Future: not yet visible.
    await prisma.systemAnnouncement.create({
      data: {
        title: `${base} future`,
        body: 'À venir',
        startsAt: new Date(Date.now() + 86_400_000),
        active: true,
      },
    });
    // Ended: no longer visible.
    await prisma.systemAnnouncement.create({
      data: {
        title: `${base} ended`,
        body: 'Terminée',
        startsAt: new Date(Date.now() - 7_200_000),
        endsAt: new Date(Date.now() - 3_600_000),
        active: true,
      },
    });
    // Inactive: hidden even inside its window.
    await prisma.systemAnnouncement.create({
      data: {
        title: `${base} inactive`,
        body: 'Désactivée',
        startsAt: new Date(Date.now() - 60_000),
        active: false,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/app/config')
      .expect(200);

    const titles = res.body.announcements.map(
      (a: { title: string }) => a.title,
    );
    expect(titles).toContain(`${base} active`);
    expect(titles).not.toContain(`${base} future`);
    expect(titles).not.toContain(`${base} ended`);
    expect(titles).not.toContain(`${base} inactive`);
  });

  it('GET /app/config reflects the per-platform minVersion policy', async () => {
    await prisma.appVersionPolicy.update({
      where: { platform: 'ANDROID' },
      data: { minVersion: '2.0.0', latestVersion: '2.3.1' },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/app/config')
      .expect(200);
    expect(res.body.versions.android.minVersion).toBe('2.0.0');
    expect(res.body.versions.android.latestVersion).toBe('2.3.1');
  });
});
