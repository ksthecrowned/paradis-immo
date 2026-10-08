import { Injectable, Logger } from '@nestjs/common';

/**
 * Infobip WhatsApp provider — the default outbound channel for every
 * notification (spec: WhatsApp, no SMS).
 *
 * In dev (no INFOBIP_* configured) the message is logged and reported as
 * accepted so flows complete without outbound credentials.
 *
 * Processor tests inject a spy of this service — we never hit Infobip
 * from tests.
 */
@Injectable()
export class InfobipService {
  private readonly logger = new Logger(InfobipService.name);

  /** Send a plain text WhatsApp message to a phone number (E.164). */
  async sendWhatsApp(
    phone: string,
    message: string,
  ): Promise<{ ok: boolean; reason?: string; providerMessageId?: string }> {
    const apiKey = process.env.INFOBIP_API_KEY ?? '';
    const baseUrl = process.env.INFOBIP_BASE_URL ?? '';
    const sender = process.env.INFOBIP_WHATSAPP_SENDER ?? '';

    if (!apiKey || !baseUrl || !sender) {
      this.logger.warn(
        `[dev] WhatsApp to ${phone}: ${message.slice(0, 80)} (Infobip not configured)`,
      );
      return { ok: true, providerMessageId: `dev-wa-${Date.now()}` };
    }

    const res = await fetch(
      `${baseUrl.replace(/\/$/, '')}/whatsapp/1/message/general`,
      {
        method: 'POST',
        headers: {
          Authorization: `App ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          from: sender,
          to: phone,
          type: 'text',
          text: { body: message },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `Infobip WhatsApp failed (${res.status}): ${text.slice(0, 200)}`,
      );
      return { ok: false, reason: `INFOBIP_${res.status}` };
    }

    let providerMessageId: string | undefined;
    try {
      const json = (await res.json()) as { messageId?: string };
      providerMessageId = json.messageId;
    } catch {
      /* ignore parse errors */
    }
    this.logger.log(`WhatsApp sent to ${phone}`);
    return { ok: true, providerMessageId };
  }
}
