import {
  NotificationCategory,
  NotificationChannel,
  type Notification,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from './fcm.service';
import { InfobipService } from './infobip.service';
import {
  isPushPreferenceAllowed,
  notificationCategoryForType,
} from './notification-preferences';
import { NotificationsService } from './notifications.service';

function createService(categoryPushEnabled: boolean) {
  const createdAt = new Date('2026-10-17T00:00:00Z');
  let stored: Notification = {
    id: 'notification-id',
    userId: 'user-id',
    channel: NotificationChannel.PUSH,
    type: '',
    payload: {},
    status: 'PENDING',
    sentAt: null,
    readAt: null,
    createdAt,
    attempts: 0,
    lastError: null,
    retryAfter: null,
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        phone: '+242060000001',
        fcmToken: 'fcm-token',
        notificationChannel: NotificationChannel.PUSH,
      }),
    },
    userDevice: { findMany: jest.fn().mockResolvedValue([]) },
    notificationPreference: {
      findUnique: jest.fn().mockResolvedValue({ push: categoryPushEnabled }),
    },
    notification: {
      create: jest.fn(async ({ data }: { data: Partial<Notification> }) => {
        stored = { ...stored, ...data } as Notification;
        return stored;
      }),
      update: jest.fn(async ({ data }: { data: Partial<Notification> }) => {
        stored = { ...stored, ...data } as Notification;
        return stored;
      }),
    },
  };
  const infobip = { sendWhatsApp: jest.fn().mockResolvedValue({ ok: true }) };
  const fcm = { sendPush: jest.fn().mockResolvedValue({ ok: true }) };
  const service = new NotificationsService(
    prisma as unknown as PrismaService,
    infobip as unknown as InfobipService,
    fcm as unknown as FcmService,
  );
  return { service, infobip, fcm };
}

describe('notification category push preferences', () => {
  it.each([
    ['RENT_DUE_SOON', NotificationCategory.PAYMENTS],
    ['VISIT_CONFIRMED', NotificationCategory.VISITS],
    ['BOOKING_CANCELLED', NotificationCategory.STAYS],
    ['SALE_OFFER_CREATED', NotificationCategory.SALES],
    ['MAINTENANCE_OPENED', NotificationCategory.MAINTENANCE],
    ['MESSAGE_CREATED', NotificationCategory.MESSAGES],
    ['APPROVAL_REQUESTED', NotificationCategory.MANDATES],
    ['LEASE_STARTED', NotificationCategory.LEASES],
    ['SECURITY_ALERT', NotificationCategory.ACCOUNT],
    ['SEARCH_ALERT', NotificationCategory.MARKETING],
  ])('maps %s to its category', (type, category) => {
    expect(notificationCategoryForType(type)).toBe(category);
  });

  it('keeps critical notifications enabled when a category is disabled', () => {
    expect(isPushPreferenceAllowed('RENT_OVERDUE', {}, false)).toBe(true);
    expect(
      isPushPreferenceAllowed(
        'MAINTENANCE_OPENED',
        { priority: 'URGENT' },
        false,
      ),
    ).toBe(true);
    expect(isPushPreferenceAllowed('SALE_INQUIRY_CREATED', {}, false)).toBe(
      false,
    );
  });

  it('routes a disabled category away from push', async () => {
    const { service, infobip, fcm } = createService(false);
    const notification = await service.send({
      userId: 'user-id',
      type: 'SALE_INQUIRY_CREATED',
      payload: {},
    });
    expect(notification.channel).toBe(NotificationChannel.WHATSAPP);
    expect(infobip.sendWhatsApp).toHaveBeenCalledTimes(1);
    expect(fcm.sendPush).not.toHaveBeenCalled();
  });

  it('keeps critical payment alerts on push despite a disabled category', async () => {
    const { service, infobip, fcm } = createService(false);
    const notification = await service.send({
      userId: 'user-id',
      type: 'PAYMENT_FAILED',
      payload: {},
    });
    expect(notification.channel).toBe(NotificationChannel.PUSH);
    expect(fcm.sendPush).toHaveBeenCalledTimes(1);
    expect(infobip.sendWhatsApp).not.toHaveBeenCalled();
  });
});
