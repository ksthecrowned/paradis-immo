import { Injectable, Logger } from '@nestjs/common';

const INFOBIP_BASE_URL = process.env.INFOBIP_BASE_URL ?? '';
const INFOBIP_API_KEY = process.env.INFOBIP_API_KEY ?? '';
const INFOBIP_WHATSAPP_SENDER = process.env.INFOBIP_WHATSAPP_SENDER ?? '';

export interface OtpMessage {
  to: string; // E.164 phone
  code: string;
}

/**
 * Sends an OTP over WhatsApp via Infobip.
 *
 * In dev (no INFOBIP_API_KEY set) the code is logged to stdout so the
 * developer can complete the verify flow manually. In production, this hits
 * Infobip's WhatsApp API using a template message.
 */
@Injectable()
export class InfobipOtpService {
  private readonly logger = new Logger(InfobipOtpService.name);

  async sendOtp(message: OtpMessage): Promise<void> {
    if (!INFOBIP_API_KEY || !INFOBIP_BASE_URL || !INFOBIP_WHATSAPP_SENDER) {
      // Dev fallback — never expose codes in production logs.
      this.logger.warn(
        `[dev] WhatsApp OTP for ${message.to}: ${message.code} (Infobip not configured)`,
      );
      return;
    }

    const url = `${INFOBIP_BASE_URL.replace(/\/$/, '')}/whatsapp/1/message/template`;
    const body = {
      messages: [
        {
          from: INFOBIP_WHATSAPP_SENDER,
          to: message.to,
          content: {
            templateName: 'paradis_immo_otp',
            templateData: {
              body: { placeholders: [message.code] },
            },
            language: 'fr',
          },
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
        `Infobip send failed (${res.status}): ${text.slice(0, 200)}`,
      );
      throw new Error(`Infobip send failed: ${res.status}`);
    }

    this.logger.log(`OTP sent to ${message.to} via WhatsApp`);
  }
}