import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { InfobipService } from './infobip.service';
import { FcmService } from './fcm.service';
import { NotificationsService } from './notifications.service';

/**
 * Spec 11 P0 — fiabilisation de l'envoi : un échec fournisseur transitoire
 * reprogramme l'envoi (QUEUED + retryAfter, backoff 1 min / 5 min) ; la 3ᵉ
 * tentative échouée clôt en FAILED (lastError, retryAfter null).
 */
describe('NotificationsService — cycle de relance (spec 11 P0)', () => {
  let notifications: NotificationsService;
  let prisma: PrismaService;
  let userId: string;
  const sendWhatsApp = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        PrismaService,
        { provide: InfobipService, useValue: { sendWhatsApp: sendWhatsApp } },
        { provide: FcmService, useValue: { sendPush: jest.fn() } },
      ],
    }).compile();
    notifications = moduleRef.get(NotificationsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country = await prisma.country.findFirstOrThrow();
    const phone = '+242078888891';
    await prisma.user
      .deleteMany({ where: { phone } })
      .catch(() => undefined);
    const user = await prisma.user.create({
      data: { phone, countryId: country.id, name: 'Spec Retry' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (userId) {
      await prisma.notification.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.onModuleDestroy();
  });

  it('reprogramme un échec transitoire puis réussit à la relance', async () => {
    sendWhatsApp.mockResolvedValueOnce({
      ok: false,
      reason: 'PROVIDER_DOWN',
    });

    const first = await notifications.send({
      userId,
      type: 'RENT_DUE_SOON',
      payload: { amount: '150000', dueDate: '2026-11-01' },
    });
    expect(first.status).toBe('QUEUED');
    expect(first.attempts).toBe(1);
    expect(first.lastError).toBe('PROVIDER_DOWN');

    const row = await prisma.notification.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(row.status).toBe('QUEUED');
    expect(row.attempts).toBe(1);
    expect(row.retryAfter!.getTime()).toBeGreaterThan(Date.now() + 50_000);

    // Le fournisseur est de retour avant l'échéance du backoff : la relance
    // est provoquée volontairement en avançant retryAfter dans le passé (le
    // cron seul attend l'échéance réelle).
    sendWhatsApp.mockResolvedValue({ ok: true, providerMessageId: 'wa-ok' });
    await prisma.notification.update({
      where: { id: first.id },
      data: { retryAfter: new Date(Date.now() - 1000) },
    });
    await notifications.redeliver(first.id);

    const sent = await prisma.notification.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(sent.status).toBe('SENT');
    expect(sent.attempts).toBe(2);
    expect(sent.sentAt).not.toBeNull();
    expect(sendWhatsApp).toHaveBeenCalledTimes(2);
  });

  it('clôt en FAILED après la 3ᵉ tentative échouée', async () => {
    sendWhatsApp.mockResolvedValue({
      ok: false,
      reason: 'PROVIDER_DOWN',
    });

    const first = await notifications.send({
      userId,
      type: 'RENT_OVERDUE',
      payload: { daysOverdue: '3' },
    });
    expect(first.status).toBe('QUEUED');

    // Essai 2 (backoff forcé dans le passé pour piloter la relance).
    await prisma.notification.update({
      where: { id: first.id },
      data: { retryAfter: new Date(Date.now() - 1000) },
    });
    await notifications.redeliver(first.id);
    let row = await prisma.notification.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(row.status).toBe('QUEUED');
    expect(row.attempts).toBe(2);

    // Essai 3 — échec définitif.
    await prisma.notification.update({
      where: { id: first.id },
      data: { retryAfter: new Date(Date.now() - 1000) },
    });
    await notifications.redeliver(first.id);
    row = await prisma.notification.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(row.status).toBe('FAILED');
    expect(row.attempts).toBe(3);
    expect(row.lastError).toBe('PROVIDER_DOWN');
    expect(row.retryAfter).toBeNull();

    // Une notification FAILED definitive n'est plus relancée.
    await notifications.redeliver(first.id);
    row = await prisma.notification.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(row.status).toBe('FAILED');
  });

  it('le cron relance uniquement les QUEUED dont la deadline est passée', async () => {
    sendWhatsApp.mockResolvedValueOnce({ ok: false, reason: 'PROVIDER_DOWN' });
    const created = await notifications.send({
      userId,
      type: 'RENT_OVERDUE',
      payload: { daysOverdue: '7' },
    });
    expect(created.status).toBe('QUEUED');

    sendWhatsApp.mockResolvedValue({ ok: true, providerMessageId: 'wa-ok' });
    await prisma.notification.update({
      where: { id: created.id },
      data: { retryAfter: new Date(Date.now() - 1000) },
    });
    await notifications.retryDueNotifications();

    const sent = await prisma.notification.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(sent.status).toBe('SENT');
  });
});
