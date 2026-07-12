import { Injectable, Logger } from '@nestjs/common';
import { MagicLinkPurpose } from '@prisma/client';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendMagicLink(
    email: string,
    rawToken: string,
    purpose: MagicLinkPurpose,
  ): Promise<void> {
    const base = process.env.WEB_APP_URL ?? 'http://localhost:3000';
    const url = `${base}/auth/magic?token=${encodeURIComponent(rawToken)}&purpose=${purpose}`;
    this.logger.log(`[dev] Magic link for ${email} (${purpose}): ${url}`);
  }
}
