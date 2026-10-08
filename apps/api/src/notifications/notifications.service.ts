import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  readAt: string | null;
  createdAt: string;
}

export interface SendInput {
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  /**
   * Optional override. When omitted, WhatsApp is used by default —
   * PUSH only when the user explicitly prefers it *and* has a device
   * token registered. SMS is never used for delivery (spec: WhatsApp).
   */
  channel?: NotificationChannel;
  /** Kept for call-site compatibility; no longer required for delivery. */
  organizationId?: string;
}

/**
 * Orchestrates outbound notifications. Persists a `Notification` row
 * (PENDING → SENT/FAILED) so the UI can show a history of what was sent.
 *
 * Channel resolution (spec): WhatsApp is the default delivery channel.
 * PUSH is only used for users who explicitly prefer it and have a device
 * token. SMS is never used — an SMS preference is delivered via WhatsApp.
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

    const requested =
      input.channel ??
      (user.notificationChannel === NotificationChannel.PUSH && user.fcmToken
        ? NotificationChannel.PUSH
        : NotificationChannel.WHATSAPP);
    // WhatsApp is the default channel — an SMS preference is delivered
    // as a WhatsApp message too (no SMS anywhere, spec: WhatsApp only).
    const channel =
      requested === NotificationChannel.SMS
        ? NotificationChannel.WHATSAPP
        : requested;

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

    if (channel === NotificationChannel.WHATSAPP) {
      if (!user.phone) {
        return this.markFailed(row.id, 'NO_PHONE');
      }
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
      if (!result.ok && result.reason === 'INVALID_TOKEN') {
        await this.prisma.user.update({
          where: { id: input.userId },
          data: { fcmToken: null },
        });
      }
    }

    return result.ok
      ? await this.markSent(row.id)
      : await this.markFailed(row.id, result.reason ?? 'PROVIDER_ERROR');
  }

  /**
   * WhatsApp-only delivery to a raw phone number, used when the recipient has
   * no account yet (e.g. a lease invitation to an `invitedPhone`). No
   * `Notification` row is persisted because it is not attached to a user.
   */
  async sendToPhone(
    phone: string,
    type: string,
    payload: Record<string, unknown>,
    text: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const result = await this.infobip.sendWhatsApp(phone, text);
    const ref = payload.leaseId ? ` (lease ${payload.leaseId})` : '';
    this.logger.log(
      `${type}${ref} -> WhatsApp ${phone}: ${
        result.ok ? 'sent' : `failed (${result.reason})`
      }`,
    );
    return { ok: result.ok, reason: result.reason };
  }

  async listForUser(userId: string): Promise<PublicNotification[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toPublic(r));
  }

  async markRead(userId: string, id: string): Promise<PublicNotification> {
    const row = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
      });
    }
    if (row.readAt) return this.toPublic(row);
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.toPublic(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
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
      case 'RENT_REMINDER_MANUAL':
        return (
          this.stringField(payload, 'message') ||
          `Paradis Immo — votre loyer est en retard : ${this.stringField(
            payload,
            'amount',
          )} ${this.stringField(payload, 'currency', 'XAF')}. Merci de régulariser.`
        );
      case 'LATE_FEE_APPLIED':
        return `Paradis Immo — une pénalité de retard de ${this.stringField(
          payload,
          'amount',
        )} ${this.stringField(
          payload,
          'currency',
          'XAF',
        )} a été appliquée à votre loyer.`;
      case 'LATE_FEE_WAIVED':
        return `Paradis Immo — la pénalité de retard de ${this.stringField(
          payload,
          'amount',
        )} ${this.stringField(
          payload,
          'currency',
          'XAF',
        )} a été annulée par votre gestionnaire.`;
      case 'FORMAL_NOTICE_SENT':
        return `Paradis Immo — mise en demeure : ${this.stringField(
          payload,
          'totalDue',
        )} ${this.stringField(
          payload,
          'currency',
          'XAF',
        )} sont dus pour ${this.stringField(
          payload,
          'propertyTitle',
        )}. Régularisez sans délai.`;
      case 'AMENDMENT_PROPOSED':
        return `Paradis Immo — un avenant (v${this.stringField(
          payload,
          'version',
        )}) vous est proposé, à effet du ${this.stringField(
          payload,
          'effectiveFrom',
        )}. Ouvrez l’app pour le signer.`;
      case 'AMENDMENT_APPLIED':
        return `Paradis Immo — l’avenant v${this.stringField(
          payload,
          'version',
        )} est appliqué : nouveau loyer ${this.stringField(
          payload,
          'monthlyRent',
        )}, à effet du ${this.stringField(payload, 'effectiveFrom')}.`;
      case 'RENT_INDEXATION_PROPOSED':
        return `Paradis Immo — révision annuelle : loyer ${this.stringField(
          payload,
          'previousMonthlyRent',
        )} → ${this.stringField(
          payload,
          'newMonthlyRent',
        )} ${this.stringField(
          payload,
          'currency',
          'XAF',
        )}, à effet du ${this.stringField(
          payload,
          'effectiveFrom',
        )}. Validation requise.`;
      case 'VISIT_CONFIRMED':
        return `Paradis Immo — votre visite est confirmée.`;
      case 'MAINTENANCE_OPENED':
        return `Paradis Immo — votre demande de maintenance a bien été enregistrée (priorité ${this.stringField(
          payload,
          'priority',
        )}).`;
      case 'APPROVAL_PENDING':
        return `Paradis Immo — une action requiert votre approbation.`;
      case 'BUYER_PAYMENT_PROOF_REQUESTED':
        return `Paradis Immo — ${this.stringField(
          payload,
          'organizationName',
          'un vendeur',
        )} demande l’accès à vos preuves de paiements. Ouvrez l’app pour répondre.`;
      case 'SOLVENCY_CHECK_REQUESTED':
        return `Paradis Immo — ${this.stringField(
          payload,
          'organizationName',
          'un logeur',
        )} demande à consulter vos 3 derniers loyers. Ouvrez l’app pour répondre.`;
      case 'LEASE_INVITATION':
        return `Paradis Immo — un bail vous attend pour ${this.stringField(
          payload,
          'propertyTitle',
        )}. Ouvrez l’app pour le consulter et le signer.`;
      case 'LEASE_STARTED':
        return `Paradis Immo — votre bail pour ${this.stringField(
          payload,
          'propertyTitle',
        )} est actif. Bonne installation !`;
      case 'LEASE_TENANT_SIGNED':
        return `Paradis Immo — le locataire a signé le bail de ${this.stringField(
          payload,
          'propertyTitle',
        )}. Il vous reste à signer.`;
      case 'LEASE_LANDLORD_SIGNED':
        return `Paradis Immo — le bailleur a signé le bail de ${this.stringField(
          payload,
          'propertyTitle',
        )}. Il vous reste à signer.`;
      case 'DEPOSIT_DEDUCTION_PROPOSED':
        return `Paradis Immo — une retenue de ${this.stringField(
          payload,
          'amount',
        )} (${this.stringField(payload, 'label')}) est proposée sur votre caution. Vous pouvez la contester sous 15 jours.`;
      case 'DEPOSIT_DEDUCTION_CONTESTED':
        return `Paradis Immo — le locataire conteste une retenue de ${this.stringField(
          payload,
          'amount',
        )} (${this.stringField(payload, 'label')}).`;
      case 'DEPOSIT_SETTLED':
        return `Paradis Immo — restitution de caution : ${this.stringField(
          payload,
          'refundAmount',
        )} ${this.stringField(payload, 'currency', 'XAF')} après retenues de ${this.stringField(
          payload,
          'deducted',
        )}.`;
      case 'DEPOSIT_REFUND_DUE':
        return `Paradis Immo — la restitution de caution est à effectuer avant le ${this.stringField(
          payload,
          'refundDeadline',
        )}.`;
      case 'LEASE_TERMINATION_NOTICE':
        return `Paradis Immo — un congé a été déposé sur votre bail${this.stringField(
          payload,
          'effectiveAt',
        ) ? `, effectif au ${this.stringField(payload, 'effectiveAt')}` : ''}.`;
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
    switch (type) {
      case 'BUYER_PAYMENT_PROOF_REQUESTED':
        return 'Demande de preuve de paiements';
      case 'SOLVENCY_CHECK_REQUESTED':
        return 'Demande de solvabilité';
      case 'LEASE_INVITATION':
        return 'Un bail vous attend';
      case 'LEASE_STARTED':
        return 'Votre bail est actif';
      case 'LEASE_TENANT_SIGNED':
        return 'Le locataire a signé';
      case 'LEASE_LANDLORD_SIGNED':
        return 'Le bailleur a signé';
      case 'DEPOSIT_DEDUCTION_PROPOSED':
        return 'Retenue sur caution';
      case 'DEPOSIT_DEDUCTION_CONTESTED':
        return 'Retenue contestée';
      case 'DEPOSIT_SETTLED':
        return 'Caution restituée';
      case 'DEPOSIT_REFUND_DUE':
        return 'Restitution de caution à faire';
      case 'LEASE_TERMINATION_NOTICE':
        return 'Congé déposé';
      case 'APPLICATION_SUBMITTED':
        return 'Candidature envoyée';
      case 'APPLICATION_ACCEPTED':
        return 'Candidature acceptée';
      case 'APPLICATION_REJECTED':
        return 'Candidature non retenue';
      case 'APPLICATION_WITHDRAWN':
        return 'Candidature retirée';
      case 'RENT_REMINDER_MANUAL':
        return 'Loyer en retard';
      case 'LATE_FEE_APPLIED':
        return 'Pénalité de retard';
      case 'LATE_FEE_WAIVED':
        return 'Pénalité annulée';
      case 'FORMAL_NOTICE_SENT':
        return 'Mise en demeure';
      case 'AMENDMENT_PROPOSED':
        return 'Avenant à signer';
      case 'AMENDMENT_APPLIED':
        return 'Avenant appliqué';
      case 'RENT_INDEXATION_PROPOSED':
        return 'Révision annuelle';
      default:
        return `Paradis Immo · ${type}`;
    }
  }

  private renderPushBody(payload: Record<string, unknown>): string {
    const org = this.stringField(payload, 'organizationName');
    if (org) {
      return `${org} vous demande une réponse.`;
    }
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
      'proofId',
      'saleAgreementId',
      'checkId',
    ]) {
      const value = payload[key];
      if (typeof value === 'string' && value.length > 0) {
        data[key] = value;
      }
    }
    if (!data.propertyId && typeof payload.receiptUrl === 'string') {
      data.screen = 'activity';
    }
    if (type === 'BUYER_PAYMENT_PROOF_REQUESTED') {
      data.screen = 'achats/preuves';
    }
    if (type === 'SOLVENCY_CHECK_REQUESTED') {
      data.screen = 'cahier-loyer/solvency';
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
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
