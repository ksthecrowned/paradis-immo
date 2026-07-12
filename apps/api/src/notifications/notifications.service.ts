import { Injectable, Logger } from '@nestjs/common';
import { Notification, NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InfobipSmsService } from '../messaging/infobip-sms.service';
import { MessagingBillingService } from '../messaging/messaging-billing.service';
import { InfobipService } from './infobip.service';
import { FcmService } from './fcm.service';

export interface PublicNotification {
  id: string;
  userId: string;
  channel: NotificationChannel;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

export interface SendInput {
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  /**
   * Optional override. When omitted, uses `User.notificationChannel`
   * (PUSH default, SMS when explicitly preferred).
   */
  channel?: NotificationChannel;
  /** Required when delivering via SMS (org is billed). */
  organizationId?: string;
}

/**
 * Orchestrates outbound notifications. Persists a `Notification` row
 * (PENDING → SENT/FAILED) so the UI can show a history of what was sent.
 *
 * Preference: `User.notificationChannel = SMS` → Infobip SMS + MessageCharge
 * billed to the managing organization. Otherwise FCM push.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly infobip: InfobipService,
    private readonly sms: InfobipSmsService,
    private readonly messaging: MessagingBillingService,
    private readonly fcm: FcmService,
  ) {}

  async send(input: SendInput): Promise<PublicNotification> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        phone: true,
        fcmToken: true,
        notificationChannel: true,
      },
    });
    if (!user) {
      const row = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          channel: input.channel ?? NotificationChannel.PUSH,
          type: input.type,
          payload: input.payload as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });
      return this.markFailed(row.id, 'USER_NOT_FOUND');
    }

    const channel =
      input.channel ??
      (user.notificationChannel === NotificationChannel.SMS
        ? NotificationChannel.SMS
        : NotificationChannel.PUSH);

    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        channel,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    let result: { ok: boolean; reason?: string; providerMessageId?: string };

    if (channel === NotificationChannel.SMS) {
      if (!input.organizationId) {
        return this.markFailed(row.id, 'MISSING_ORGANIZATION');
      }
      const text = this.renderSmsMessage(input.type, input.payload);
      result = await this.sms.send({ to: user.phone, text });
      if (result.ok) {
        await this.messaging.recordSmsAlert({
          phone: user.phone,
          userId: input.userId,
          organizationId: input.organizationId,
          providerMessageId: result.providerMessageId,
          idempotencyKey: `sms-alert:${row.id}`,
        });
      }
    } else if (channel === NotificationChannel.WHATSAPP) {
      const message = this.renderWhatsAppMessage(input.type, input.payload);
      result = await this.infobip.sendWhatsApp(user.phone, message);
    } else {
      if (!user.fcmToken) {
        return this.markFailed(row.id, 'NO_DEVICE_TOKEN');
      }
      const title = this.renderPushTitle(input.type);
      const body = this.renderPushBody(input.payload);
      const data = this.renderPushData(input.type, input.payload);
      result = await this.fcm.sendPush(user.fcmToken, title, body, data);
    }

    return result.ok
      ? await this.markSent(row.id)
      : await this.markFailed(row.id, result.reason ?? 'PROVIDER_ERROR');
  }

  async listForUser(userId: string): Promise<PublicNotification[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toPublic(r));
  }

  private renderSmsMessage(
    type: string,
    payload: Record<string, unknown>,
  ): string {
    return this.renderWhatsAppMessage(type, payload);
  }

  private renderWhatsAppMessage(
    type: string,
    payload: Record<string, unknown>,
  ): string {
    switch (type) {
      case 'PAYMENT_RECEIPT_READY':
        return `Paradis Immo — votre reçu de paiement est disponible : ${this.stringField(
          payload,
          'receiptUrl',
        )}`;
      case 'RENT_DUE_SOON':
        return `Paradis Immo — rappel : votre loyer de ${this.stringField(
          payload,
          'amount',
        )} ${this.stringField(
          payload,
          'currency',
          'XAF',
        )} arrive à échéance le ${this.stringField(payload, 'dueDate')}.`;
      case 'RENT_OVERDUE':
        return `Paradis Immo — votre loyer est en retard de ${this.stringField(
          payload,
          'daysOverdue',
        )} jour(s). Merci de régulariser.`;
      case 'VISIT_CONFIRMED':
        return `Paradis Immo — votre visite est confirmée.`;
      case 'MAINTENANCE_OPENED':
        return `Paradis Immo — votre demande de maintenance a bien été enregistrée (priorité ${this.stringField(
          payload,
          'priority',
        )}).`;
      case 'APPROVAL_PENDING':
        return `Paradis Immo — une action requiert votre approbation.`;
      default:
        return `Paradis Immo — ${type}`;
    }
  }

  private stringField(
    payload: Record<string, unknown>,
    key: string,
    fallback = '',
  ): string {
    const v = payload[key];
    return typeof v === 'string' ? v : fallback;
  }

  private renderPushTitle(type: string): string {
    return `Paradis Immo · ${type}`;
  }

  private renderPushBody(payload: Record<string, unknown>): string {
    const entries = Object.entries(payload).slice(0, 3);
    return entries
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(' — ');
  }

  private renderPushData(
    type: string,
    payload: Record<string, unknown>,
  ): Record<string, string> {
    const data: Record<string, string> = { type };
    for (const key of [
      'propertyId',
      'paymentId',
      'visitBookingId',
      'bookingId',
      'leaseId',
    ]) {
      const value = payload[key];
      if (typeof value === 'string' && value.length > 0) {
        data[key] = value;
      }
    }
    if (!data.propertyId && typeof payload.receiptUrl === 'string') {
      data.screen = 'activity';
    }
    return data;
  }

  private async markSent(id: string): Promise<PublicNotification> {
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    return this.toPublic(updated);
  }

  private async markFailed(
    id: string,
    _reason: string,
  ): Promise<PublicNotification> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row) {
      throw new Error(`Notification ${id} disappeared mid-send`);
    }
    this.logger.warn(`Notification ${id} delivery failed (${_reason})`);
    return this.toPublic(row);
  }

  private toPublic(n: Notification): PublicNotification {
    return {
      id: n.id,
      userId: n.userId,
      channel: n.channel,
      type: n.type,
      payload: n.payload as Record<string, unknown>,
      status: n.status,
      sentAt: n.sentAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
