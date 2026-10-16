import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
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

/** Spec 11 — upsert payload for `POST users/me/devices`. */
export interface RegisterDeviceInput {
  deviceId: string;
  fcmToken: string;
  platform: 'IOS' | 'ANDROID' | 'WEB' | 'ADMIN';
  appVersion?: string;
  locale?: string;
}

/** Spec 11 — a registered push target as returned to the client. */
export interface PublicUserDevice {
  deviceId: string;
  platform: string;
  appVersion: string | null;
  locale: string | null;
  lastSeenAt: string;
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
      // Push goes to EVERY registered device (specs 11/14): the upserted
      // `userDevice` rows plus the legacy `User.fcmToken` column kept for
      // backwards compatibility with older clients.
      const title = this.renderPushTitle(input.type);
      const body = this.renderPushBody(input.payload);
      const data = this.renderPushData(input.type, input.payload);

      const devices = await this.prisma.userDevice.findMany({
        where: { userId: input.userId },
        select: { fcmToken: true },
      });
      const tokens = new Set<string>();
      if (user.fcmToken) tokens.add(user.fcmToken);
      for (const device of devices) {
        if (device.fcmToken) tokens.add(device.fcmToken);
      }
      if (tokens.size === 0) {
        return this.markFailed(row.id, 'NO_DEVICE_TOKEN');
      }

      const invalid: string[] = [];
      let anyOk = false;
      let reason: string | undefined;
      let messageId: string | undefined;
      for (const token of tokens) {
        const push = await this.fcm.sendPush(token, title, body, data);
        if (push.ok) {
          anyOk = true;
          messageId = push.messageId;
        } else {
          reason = reason ?? push.reason;
          if (push.reason === 'INVALID_TOKEN') invalid.push(token);
        }
      }
      // Cleanup dead tokens so the queue stops failing on them.
      if (invalid.length > 0) {
        await this.prisma
          .$transaction([
            this.prisma.userDevice.deleteMany({
              where: { userId: input.userId, fcmToken: { in: invalid } },
            }),
            ...(user.fcmToken && invalid.includes(user.fcmToken)
              ? [
                  this.prisma.user.update({
                    where: { id: input.userId },
                    data: { fcmToken: null },
                  }),
                ]
              : []),
          ])
          .catch(() => undefined);
      }
      result = anyOk
        ? { ok: true, providerMessageId: messageId }
        : { ok: false, reason: reason ?? 'PROVIDER_ERROR' };
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
        )} → ${this.stringField(payload, 'newMonthlyRent')} ${this.stringField(
          payload,
          'currency',
          'XAF',
        )}, à effet du ${this.stringField(
          payload,
          'effectiveFrom',
        )}. Validation requise.`;
      case 'VISIT_CONFIRMED':
        return `Paradis Immo — votre visite de ${
          this.stringField(payload, 'propertyTitle') || 'du bien'
        } est confirmée (${this.stringField(payload, 'startAt')}).`;
      case 'VISIT_HOLD':
        return `Paradis Immo — créneau de visite réservé. Vous avez 15 minutes pour payer (jusqu'à ${this.stringField(
          payload,
          'holdExpiresAt',
        )}).`;
      case 'VISIT_CANCELLED':
        return `Paradis Immo — votre visite de ${
          this.stringField(payload, 'propertyTitle') || 'du bien'
        } du ${this.stringField(payload, 'startAt')} est annulée${
          this.stringField(payload, 'reason')
            ? ` (${this.stringField(payload, 'reason')})`
            : ''
        }.`;
      case 'STAY_HOLD':
        return `Paradis Immo — réservation en attente : les dates sont bloquées 15 minutes. Terminez votre paiement avant ${this.stringField(
          payload,
          'holdExpiresAt',
        )}.`;
      case 'MAINTENANCE_OPENED':
        return this.stringField(payload, 'propertyTitle')
          ? `Paradis Immo — un ticket de maintenance a été ouvert sur ${this.stringField(
              payload,
              'propertyTitle',
            )} (priorité ${this.stringField(payload, 'priority')}).`
          : `Paradis Immo — votre demande de maintenance a bien été enregistrée (priorité ${this.stringField(
              payload,
              'priority',
            )}).`;
      case 'PAYMENT_INITIATED':
        return `Paradis Immo — paiement de ${this.stringField(
          payload,
          'amount',
        )} ${this.stringField(
          payload,
          'currency',
          'XAF',
        )} initié : finalisez-le sur votre téléphone avant expiration.`;
      case 'PAYOUT_PAID':
        return `Paradis Immo — reversement de ${this.stringField(
          payload,
          'amount',
        )} XAF envoyé.`;
      case 'PAYOUT_FAILED':
        return `Paradis Immo — le reversement de ${this.stringField(
          payload,
          'amount',
        )} ${this.stringField(
          payload,
          'currency',
          'XAF',
        )} a échoué${this.stringField(payload, 'reason') ? ` : ${this.stringField(payload, 'reason')}` : ''}. Une nouvelle tentative aura lieu.`;
      case 'MANDATE_PROPOSED':
        return `Paradis Immo — une proposition de mandat de gestion vous attend sur ${this.stringField(
          payload,
          'propertyId',
        )}. Ouvrez l’app pour la consulter.`;
      case 'MESSAGE_RECEIVED':
        return `Paradis Immo — vous avez un nouveau message. Ouvrez l’app pour le lire.`;
      case 'SALE_INQUIRY_CREATED':
        return `Paradis Immo — nouvelle demande d’achat sur ${this.stringField(
          payload,
          'propertyTitle',
        )}${this.stringField(payload, 'budget') ? ` (budget ${this.stringField(payload, 'budget')} XAF` : ''}${this.stringField(payload, 'phone') ? `, contact ${this.stringField(payload, 'phone')})` : this.stringField(payload, 'budget') ? ')' : ''}.`;
      case 'LISTING_MODERATED':
        return `Paradis Immo — votre annonce « ${this.stringField(
          payload,
          'propertyTitle',
        )} » a été modérée (${payload.status ?? ''}). Motif : ${this.stringField(payload, 'reason', 'non précisé')}.`;
      case 'SALE_OFFER_RECEIVED':
        return `Paradis Immo — nouvelle offre d’achat de ${this.stringField(
          payload,
          'price',
        )} XAF sur ${this.stringField(payload, 'propertyTitle')}. Ouvrez l’app pour répondre.`;
      case 'SALE_OFFER_FORWARDED':
        return `Paradis Immo — une offre de ${this.stringField(
          payload,
          'price',
        )} XAF sur ${this.stringField(
          payload,
          'propertyTitle',
        )} vous est transmise par votre agence.`;
      case 'SALE_OFFER_DECIDED':
        return `Paradis Immo — votre offre sur ${this.stringField(
          payload,
          'propertyTitle',
        )} a été ${payload.decision === 'ACCEPTED' ? 'acceptée' : 'refusée'}${payload.decision === 'ACCEPTED' ? '. Prochaine étape : le compromis.' : ''}.`;
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
        return `Paradis Immo — un congé a été déposé sur votre bail${
          this.stringField(payload, 'effectiveAt')
            ? `, effectif au ${this.stringField(payload, 'effectiveAt')}`
            : ''
        }.`;
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
    reason: string,
  ): Promise<PublicNotification> {
    // Spec 11 — le statut doit refléter l'échec (sinon la ligne reste
    // PENDING à jamais et aucune relance/audit n'est possible).
    const row = await this.prisma.notification
      .update({
        where: { id },
        data: {
          status: NotificationStatus.FAILED,
          payload: {
            ...(await this.notificationPayload(id)),
            failReason: reason,
          },
        },
      })
      .catch(async (err) => {
        // La ligne a pu disparaître entre-temps (nettoyage) : pas bloquant.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2025'
        ) {
          this.logger.warn(`Notification ${id} disappeared mid-fail`);
          const fallback = await this.prisma.notification.findUnique({
            where: { id },
          });
          if (fallback) return fallback;
        }
        throw err;
      });
    this.logger.warn(`Notification ${id} delivery failed (${reason})`);
    return this.toPublic(row);
  }

  private async notificationPayload(
    id: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.notification.findUnique({
      where: { id },
      select: { payload: true },
    });
    return (row?.payload as Record<string, unknown>) ?? {};
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

  // ------------------------------------------------------------------------
  // Devices — specs 11/14. The push target replaces the legacy
  // `User.fcmToken` column: push is sent to every registered device and the
  // token is claimed on (fcmToken) so a second account installing on the
  // same phone revokes it from the first.
  // ------------------------------------------------------------------------

  async registerDevice(
    userId: string,
    input: RegisterDeviceInput,
  ): Promise<PublicUserDevice> {
    // A token is claimed at most once: if another account already registered
    // this phone, its registration is invalidated first.
    await this.prisma.userDevice.deleteMany({
      where: { fcmToken: input.fcmToken, userId: { not: userId } },
    });

    const row = await this.prisma.userDevice.upsert({
      where: {
        userId_deviceId: { userId, deviceId: input.deviceId },
      },
      create: {
        userId,
        deviceId: input.deviceId,
        fcmToken: input.fcmToken,
        platform: input.platform,
        appVersion: input.appVersion,
        locale: input.locale,
      },
      update: {
        fcmToken: input.fcmToken,
        platform: input.platform,
        appVersion: input.appVersion,
        locale: input.locale,
        lastSeenAt: new Date(),
      },
    });
    return this.deviceToPublic(row);
  }

  async listDevices(userId: string): Promise<PublicUserDevice[]> {
    const rows = await this.prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
    return rows.map((r) => this.deviceToPublic(r));
  }

  /** Deleted on logout (spec 14): the app unregisters its own token. */
  async removeDevice(userId: string, deviceId: string): Promise<void> {
    await this.prisma.userDevice.deleteMany({
      where: { userId, deviceId },
    });
  }

  private deviceToPublic(row: {
    deviceId: string;
    platform: string;
    appVersion: string | null;
    locale: string | null;
    lastSeenAt: Date;
  }): PublicUserDevice {
    return {
      deviceId: row.deviceId,
      platform: row.platform,
      appVersion: row.appVersion,
      locale: row.locale,
      lastSeenAt: row.lastSeenAt.toISOString(),
    };
  }
}
