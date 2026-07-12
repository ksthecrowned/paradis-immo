import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  cert,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

export type FcmSendResult = {
  ok: boolean;
  reason?: string;
  messageId?: string;
};

/**
 * Firebase Cloud Messaging sender (firebase-admin).
 * Requires `FCM_CREDENTIALS` = path to service-account JSON or raw JSON.
 * No silent success when unconfigured.
 */
@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private messaging: Messaging | null = null;

  onModuleInit(): void {
    this.messaging = this.initMessaging();
  }

  /** Exposed for tests. */
  setMessagingForTests(messaging: Messaging | null): void {
    this.messaging = messaging;
  }

  async sendPush(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<FcmSendResult> {
    if (!this.messaging) {
      this.logger.error(
        '[FCM] not configured — set FCM_CREDENTIALS to a Firebase service-account JSON',
      );
      return { ok: false, reason: 'NOT_CONFIGURED' };
    }

    try {
      const messageId = await this.messaging.send({
        token: deviceToken,
        notification: { title, body },
        data: data ?? {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      });
      return { ok: true, messageId };
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      const invalid =
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token') ||
        code.includes('invalid-argument');

      this.logger.warn(
        `[FCM] send failed (${code || 'unknown'}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );

      return {
        ok: false,
        reason: invalid ? 'INVALID_TOKEN' : 'PROVIDER_ERROR',
      };
    }
  }

  private initMessaging(): Messaging | null {
    const raw = process.env.FCM_CREDENTIALS?.trim();
    if (!raw) {
      this.logger.warn('[FCM] FCM_CREDENTIALS missing — push disabled');
      return null;
    }

    try {
      const serviceAccount = this.parseCredentials(raw);
      let app: App;
      if (getApps().length > 0) {
        app = getApps()[0]!;
      } else {
        app = initializeApp({
          credential: cert(serviceAccount),
        });
      }
      this.logger.log('[FCM] firebase-admin initialized');
      return getMessaging(app);
    } catch (err) {
      this.logger.error(
        `[FCM] failed to initialize: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  private parseCredentials(raw: string): {
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
    [key: string]: unknown;
  } {
    if (raw.startsWith('{')) {
      return JSON.parse(raw) as Record<string, unknown>;
    }

    const filePath = path.isAbsolute(raw)
      ? raw
      : path.resolve(process.cwd(), raw);
    const contents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(contents) as Record<string, unknown>;
  }
}
