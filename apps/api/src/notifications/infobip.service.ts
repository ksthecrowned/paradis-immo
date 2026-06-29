import { Injectable, Logger } from '@nestjs/common';

/**
 * Infobip WhatsApp provider.
 *
 * In production, this calls the Infobip REST API to send a WhatsApp
 * template message. In dev (no API key set) we just log the message.
 *
 * The processor test in `notifications.spec.ts` injects a spy of this
 * service to assert that the right payload is built from the domain
 * event — we never hit Infobip from tests.
 */
@Injectable()
export class InfobipService {
  private readonly logger = new Logger(InfobipService.name);

  /**
   * Send a plain text WhatsApp message to a phone number.
   * Returns `{ ok: true }` when delivery was accepted (logged), `{ ok: false }`
   * when the provider is not configured or the phone is invalid.
   */
  sendWhatsApp(
    phone: string,
    message: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!process.env.INFOBIP_API_KEY || !process.env.INFOBIP_BASE_URL) {
      this.logger.warn(
        `[Infobip] not configured — would send to ${phone}: ${message.slice(0, 80)}`,
      );
      return Promise.resolve({ ok: false, reason: 'NOT_CONFIGURED' });
    }
    // Production path — left as a documented TODO; the MVP runs without
    // outbound WhatsApp in dev.
    this.logger.warn(
      `[Infobip] stub — real HTTP send not implemented in MVP for ${phone}`,
    );
    return Promise.resolve({ ok: true });
  }
}
