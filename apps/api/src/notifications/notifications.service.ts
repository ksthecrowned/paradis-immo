import { Injectable, Logger } from '@nestjs/common';
import { Notification, NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  channel: NotificationChannel;
  type: string;
  payload: Record<string, unknown>;
}

/**
 * Orchestrates outbound notifications. Persists a `Notification` row
 * (PENDING → SENT/FAILED) so the UI can show a history of what was sent.
 *
 * Channel dispatch is delegated to the provider-specific service
 * (InfobipService for WhatsApp, FcmService for push). The MVP runs
 * both providers in stub mode unless their env vars are set.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly infobip: InfobipService,
    private readonly fcm: FcmService,
  ) {}

  async send(input: SendInput): Promise<PublicNotification> {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        channel: input.channel,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    let result: { ok: boolean; reason?: string };
    if (input.channel === NotificationChannel.WHATSAPP) {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { phone: true },
      });
      if (!user) {
        const failed = await this.markFailed(row.id, 'USER_NOT_FOUND');
        return failed;
      }
      const message = this.renderWhatsAppMessage(input.type, input.payload);
      result = await this.infobip.sendWhatsApp(user.phone, message);
    } else {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { fcmToken: true },
      });
      if (!user?.fcmToken) {
        const failed = await this.markFailed(row.id, 'NO_DEVICE_TOKEN');
        return failed;
      }
      const title = this.renderPushTitle(input.type);
      const body = this.renderPushBody(input.payload);
      result = await this.fcm.sendPush(user.fcmToken, title, body);
    }

    const updated = result.ok
      ? await this.markSent(row.id)
      : await this.markFailed(row.id, result.reason ?? 'PROVIDER_ERROR');
    return updated;
  }

  async listForUser(userId: string): Promise<PublicNotification[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toPublic(r));
  }

  /**
   * Builds a short human-readable WhatsApp message from a notification
   * type + payload. Templates live here for the MVP — they can be moved
   * to a templating system later.
   */
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
    // We still surface the row but with status PENDING (provider didn't
    // accept delivery). A retry job can pick it up later.
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
