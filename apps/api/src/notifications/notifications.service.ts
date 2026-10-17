import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InfobipService } from './infobip.service';
import { FcmService } from './fcm.service';

/** Spec 11 P0 — 3 tentatives d'envoi avec backoff avant un FAILED définitif. */
const MAX_SEND_ATTEMPTS = 3;
/**
 * Backoff après le 1er et le 2e échec (spec 11 : 1 min, 5 min ; le 3e échec
 * est définitif).
 */
const RETRY_DELAYS_MS: readonly number[] = [60_000, 300_000];

/** Spec 12 — masque le téléphone destinataire dans la file admin. */
function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length <= 6) return '****';
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

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
  /** Spec 11 P0 — télémétrie de fiabilité (optionnels pour compat clients). */
  attempts?: number;
  lastError?: string | null;
  retryAfter?: string | null;
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

/** Spec 11/12 — row returned by `GET admin/notifications/failed`. */
export interface AdminFailedNotification {
  id: string;
  type: string;
  channel: NotificationChannel;
  status: string;
  attempts: number;
  lastError: string | null;
  retryAfter: string | null;
  createdAt: string;
  sentAt: string | null;
  recipient: {
    userId: string;
    phoneMasked: string | null;
    name: string | null;
  };
  /** Non persisté en schéma aujourd'hui — toujours null pour l'UI. */
  providerMessageId: string | null;
}

export interface AdminFailedListResult {
  data: AdminFailedNotification[];
  meta: { total: number; page: number; pageSize: number };
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

    // Push targets: legacy User.fcmToken + every registered UserDevice
    // (mobile + web). Resolved before channel selection so PUSH preference
    // works when only UserDevice rows exist (web portal).
    const tokens = await this.resolvePushTokens(input.userId, user.fcmToken);

    const requestedChannel =
      input.channel ??
      (user.notificationChannel === NotificationChannel.PUSH && tokens.size > 0
        ? NotificationChannel.PUSH
        : NotificationChannel.WHATSAPP);
    const requested =
      requestedChannel === NotificationChannel.PUSH &&
      user.notificationChannel !== NotificationChannel.PUSH
        ? NotificationChannel.WHATSAPP
        : requestedChannel;
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

    return this.deliverAndRecord(row, input, user, tokens, channel);
  }

  /** Resolves every FCM target: legacy User.fcmToken + registered UserDevice. */
  private async resolvePushTokens(
    userId: string,
    legacyFcmToken: string | null,
  ): Promise<Set<string>> {
    const devices = await this.prisma.userDevice.findMany({
      where: { userId },
      select: { fcmToken: true },
    });
    const tokens = new Set<string>();
    if (legacyFcmToken) tokens.add(legacyFcmToken);
    for (const device of devices) {
      if (device.fcmToken) tokens.add(device.fcmToken);
    }
    return tokens;
  }

  /** One delivery attempt against the resolved channel (shared send/retry). */
  private async deliverAndRecord(
    row: Notification,
    input: SendInput,
    user: {
      phone: string | null;
      fcmToken: string | null;
      notificationChannel: NotificationChannel;
    },
    tokens: Set<string>,
    channel: NotificationChannel,
  ): Promise<PublicNotification> {
    if (channel === NotificationChannel.WHATSAPP) {
      if (!user.phone) {
        return this.markFailed(row.id, 'NO_PHONE');
      }
      const message = this.renderWhatsAppMessage(input.type, input.payload);
      const result = await this.infobip.sendWhatsApp(user.phone, message);
      return this.recordAttempt(row, result);
    }

    // Push goes to EVERY registered device (specs 11/14): the upserted
    // `userDevice` rows plus the legacy `User.fcmToken` column kept for
    // backwards compatibility with older clients.
    const title = this.renderPushTitle(input.type);
    const body = this.renderPushBody(input.payload);
    const data = this.renderPushData(input.type, input.payload);

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
            where: { userId: row.userId, fcmToken: { in: invalid } },
          }),
          ...(user.fcmToken && invalid.includes(user.fcmToken)
            ? [
                this.prisma.user.update({
                  where: { id: row.userId },
                  data: { fcmToken: null },
                }),
              ]
            : []),
        ])
        .catch(() => undefined);
    }
    return this.recordAttempt(
      row,
      anyOk
        ? { ok: true, providerMessageId: messageId }
        : { ok: false, reason: reason ?? 'PROVIDER_ERROR' },
    );
  }

  /**
   * Spec 11 P0 — enregistre une tentative d'envoi. Un échec fournisseur
   * transitoire repart dans la file (status QUEUED) deux fois avec backoff
   * (1 min puis 5 min) ; le 3ᵉ échec est définitif (FAILED + lastError).
   * Les échecs structurels (NO_PHONE, NO_DEVICE_TOKEN) échouent d'emblée :
   * aucune relance ne peut les corriger.
   */
  private async recordAttempt(
    row: Notification,
    result: { ok: boolean; reason?: string; providerMessageId?: string },
  ): Promise<PublicNotification> {
    if (result.ok) return this.markSent(row.id, row.attempts + 1);
    const reason = result.reason ?? 'PROVIDER_ERROR';
    const attempts = row.attempts + 1;
    if (attempts < MAX_SEND_ATTEMPTS) {
      const delay = RETRY_DELAYS_MS[attempts - 1] ?? RETRY_DELAYS_MS[0];
      const retryAfter = new Date(Date.now() + delay);
      const updated = await this.prisma.notification.update({
        where: { id: row.id },
        data: {
          status: NotificationStatus.QUEUED,
          attempts,
          lastError: reason,
          retryAfter,
        },
      });
      this.logger.warn(
        `Notification ${row.id} attempt ${attempts} failed (${reason}) — requeued for ${retryAfter.toISOString()}`,
      );
      return this.toPublic(updated);
    }
    return this.markFailed(row.id, reason, attempts);
  }

  /**
   * Spec 11 P0 — cron : re-délivre les notifications QUEUED dont retryAfter
   * est passé (lot de 50 par minute, triées par échéance).
   */
  @Cron(CronExpression.EVERY_MINUTE, { timeZone: 'Africa/Brazzaville' })
  async retryDueNotifications(): Promise<void> {
    const due = await this.prisma.notification.findMany({
      where: {
        status: NotificationStatus.QUEUED,
        retryAfter: { lte: new Date() },
      },
      orderBy: [{ retryAfter: 'asc' }, { id: 'asc' }],
      take: 50,
      select: { id: true },
    });
    for (const { id } of due) {
      await this.redeliver(id);
    }
  }

  /** Re-sends one queued notification; public so tests can drive retries. */
  async redeliver(id: string): Promise<void> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row || row.status !== NotificationStatus.QUEUED) return;
    if (row.retryAfter && row.retryAfter > new Date()) return;
    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { phone: true, fcmToken: true, notificationChannel: true },
    });
    if (!user) {
      await this.markFailed(row.id, 'USER_NOT_FOUND', row.attempts + 1);
      return;
    }
    const tokens = await this.resolvePushTokens(row.userId, user.fcmToken);
    const requested =
      user.notificationChannel === NotificationChannel.PUSH && tokens.size > 0
        ? NotificationChannel.PUSH
        : NotificationChannel.WHATSAPP;
    await this.deliverAndRecord(
      row,
      {
        userId: row.userId,
        type: row.type,
        payload: (row.payload as Record<string, unknown>) ?? {},
      },
      user,
      tokens,
      requested,
    );
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
    const leaseId =
      typeof payload.leaseId === 'string' ? payload.leaseId : undefined;
    const ref = leaseId ? ` (lease ${leaseId})` : '';
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

  /**
   * Spec 11/12 — file admin des envois en échec ou en backoff (QUEUED).
   * Destinataire masqué ; pas de token FCM ni payload confidentiel.
   */
  async listFailedForAdmin(options?: {
    page?: number;
    pageSize?: number;
    /** `FAILED` | `QUEUED` | omit/`ALL` pour les deux. */
    status?: 'FAILED' | 'QUEUED' | 'ALL';
  }): Promise<AdminFailedListResult> {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 20));
    const statusFilter = options?.status ?? 'ALL';
    const where: Prisma.NotificationWhereInput = {
      status:
        statusFilter === 'FAILED'
          ? NotificationStatus.FAILED
          : statusFilter === 'QUEUED'
            ? NotificationStatus.QUEUED
            : { in: [NotificationStatus.FAILED, NotificationStatus.QUEUED] },
    };
    const [total, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, phone: true, name: true } },
        },
      }),
    ]);
    return {
      data: rows.map((n) => ({
        id: n.id,
        type: n.type,
        channel: n.channel,
        status: n.status,
        attempts: n.attempts,
        lastError: n.lastError,
        retryAfter: n.retryAfter?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
        sentAt: n.sentAt?.toISOString() ?? null,
        recipient: {
          userId: n.user.id,
          phoneMasked: maskPhone(n.user.phone),
          name: n.user.name,
        },
        providerMessageId: null,
      })),
      meta: { total, page, pageSize },
    };
  }

  /**
   * Spec 11/12 — relance manuelle admin.
   * - FAILED : nouveau cycle (attempts remis à 0) puis livraison immédiate.
   * - QUEUED : ignore le backoff et tente maintenant.
   */
  async adminRetry(id: string): Promise<PublicNotification> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification introuvable',
      });
    }
    if (
      row.status !== NotificationStatus.FAILED &&
      row.status !== NotificationStatus.QUEUED
    ) {
      throw new BadRequestException({
        code: 'NOTIFICATION_NOT_RETRYABLE',
        message: `Seules les notifications FAILED ou QUEUED peuvent être relancées (statut actuel : ${row.status})`,
      });
    }

    const dueNow = new Date(Date.now() - 1000);
    if (row.status === NotificationStatus.FAILED) {
      await this.prisma.notification.update({
        where: { id },
        data: {
          status: NotificationStatus.QUEUED,
          attempts: 0,
          lastError: null,
          retryAfter: dueNow,
        },
      });
    } else {
      await this.prisma.notification.update({
        where: { id },
        data: { retryAfter: dueNow },
      });
    }

    await this.redeliver(id);
    const updated = await this.prisma.notification.findUniqueOrThrow({
      where: { id },
    });
    return this.toPublic(updated);
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
        )} » a été modérée (${this.stringField(
          payload,
          'status',
          'statut non précisé',
        )}). Motif : ${this.stringField(payload, 'reason', 'non précisé')}.`;
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
      case 'DISPUTE_OPENED':
        return `Paradis Immo — un paiement a été contesté${
          this.stringField(payload, 'reason')
            ? ` (motif : ${this.stringField(payload, 'reason')})`
            : ''
        }. Ouvrez le portail pour le traiter.`;
      case 'REFUND_DONE':
        return `Paradis Immo — vos ${this.stringField(
          payload,
          'amount',
        )} ${this.stringField(
          payload,
          'currency',
          'XAF',
        )} viennent d'être remboursés.`;
      case 'APPROVAL_DECIDED':
        return `Paradis Immo — votre demande d'approbation (${this.stringField(
          payload,
          'actionType',
          'action',
        )}) a été ${
          payload.decision === 'APPROVED' ? 'approuvée' : 'refusée'
        }.`;
      case 'MANDATE_ACCEPTED':
        return `Paradis Immo — le mandat de gestion sur ${this.stringField(
          payload,
          'propertyId',
          'un bien',
        )} a été accepté.`;
      case 'MANDATE_DECLINED':
        return `Paradis Immo — le mandat de gestion sur ${this.stringField(
          payload,
          'propertyId',
          'un bien',
        )} a été refusé.`;
      case 'MANDATE_TERMINATED':
        return `Paradis Immo — le mandat sur ${this.stringField(
          payload,
          'propertyId',
          'un bien',
        )} est terminé${
          this.stringField(payload, 'effectiveAt')
            ? `, effectif au ${this.stringField(payload, 'effectiveAt')}`
            : ''
        }${
          this.stringField(payload, 'reason')
            ? ` (${this.stringField(payload, 'reason')})`
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
      case 'DISPUTE_OPENED':
        return 'Paiement contesté';
      case 'REFUND_DONE':
        return 'Remboursement effectué';
      case 'APPROVAL_DECIDED':
        return 'Approbation tranchée';
      case 'MANDATE_ACCEPTED':
        return 'Mandat accepté';
      case 'MANDATE_DECLINED':
        return 'Mandat refusé';
      case 'MANDATE_TERMINATED':
        return 'Mandat terminé';
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

  private async markSent(
    id: string,
    attempts?: number,
  ): Promise<PublicNotification> {
    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        // Spec 11 P0 — télémétrie : chaque essai est comptabilisé, y compris
        // celui qui aboutit après relance.
        ...(attempts !== undefined ? { attempts } : {}),
      },
    });
    return this.toPublic(updated);
  }

  private async markFailed(
    id: string,
    reason: string,
    attempts?: number,
  ): Promise<PublicNotification> {
    // Spec 11 — le statut doit refléter l'échec (sinon la ligne reste
    // PENDING à jamais et aucune relance/audit n'est possible).
    const row = await this.prisma.notification
      .update({
        where: { id },
        data: {
          status: NotificationStatus.FAILED,
          ...(attempts !== undefined ? { attempts } : {}),
          lastError: reason,
          retryAfter: null,
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
      attempts: n.attempts,
      lastError: n.lastError,
      retryAfter: n.retryAfter?.toISOString() ?? null,
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
