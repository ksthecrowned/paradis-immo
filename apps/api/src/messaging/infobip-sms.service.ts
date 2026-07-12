import { Injectable, Logger } from '@nestjs/common';

const INFOBIP_BASE_URL = process.env.INFOBIP_BASE_URL ?? '';
const INFOBIP_API_KEY = process.env.INFOBIP_API_KEY ?? '';
const INFOBIP_SMS_SENDER = process.env.INFOBIP_SMS_SENDER ?? '';

export interface SmsMessage {
  to: string; // E.164
  text: string;
}

/**
 * Sends operational SMS alerts via Infobip.
 * In dev (no Infobip config) logs and reports ok so billing can be exercised.
 */
@Injectable()
export class InfobipSmsService {
  private readonly logger = new Logger(InfobipSmsService.name);

  async send(
    message: SmsMessage,
  ): Promise<{ ok: boolean; reason?: string; providerMessageId?: string }> {
    if (!INFOBIP_API_KEY || !INFOBIP_BASE_URL || !INFOBIP_SMS_SENDER) {
      this.logger.warn(
        `[dev] SMS to ${message.to}: ${message.text.slice(0, 80)} (Infobip SMS not configured)`,
      );
      return { ok: true, providerMessageId: `dev-sms-${Date.now()}` };
    }

    const url = `${INFOBIP_BASE_URL.replace(/\/$/, '')}/sms/2/text/advanced`;
    const body = {
      messages: [
        {
          from: INFOBIP_SMS_SENDER,
          destinations: [{ to: message.to }],
          text: message.text,
        },
      ],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `App ${INFOBIP_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `Infobip SMS failed (${res.status}): ${text.slice(0, 200)}`,
      );
      return { ok: false, reason: `INFOBIP_${res.status}` };
    }

    let providerMessageId: string | undefined;
    try {
      const json = (await res.json()) as {
        messages?: Array<{ messageId?: string }>;
      };
      providerMessageId = json.messages?.[0]?.messageId;
    } catch {
      /* ignore parse errors */
    }

    this.logger.log(`SMS sent to ${message.to}`);
    return { ok: true, providerMessageId };
  }
}
