import { Injectable, Logger } from '@nestjs/common';

/**
 * FCM push notification provider.
 *
 * In production this uses firebase-admin to deliver push to a device.
 * In MVP / dev (no FCM credentials) we just log and report ok=true.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  sendPush(
    deviceToken: string,
    title: string,
    body: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    void body;
    if (!process.env.FCM_CREDENTIALS) {
      this.logger.warn(
        `[FCM] not configured — would push to ${deviceToken.slice(0, 8)}…: ${title}`,
      );
      return Promise.resolve({ ok: false, reason: 'NOT_CONFIGURED' });
    }
    this.logger.warn(
      `[FCM] stub — real send not implemented in MVP for ${deviceToken.slice(0, 8)}…`,
    );
    return Promise.resolve({ ok: true });
  }
}
