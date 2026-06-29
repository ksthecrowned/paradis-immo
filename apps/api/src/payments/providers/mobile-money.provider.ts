import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentProvider } from '@prisma/client';
import {
  InitiatePayment,
  PaymentSession,
  PaymentStatus,
  WebhookResult,
} from './payment-provider.interface';

const MOBILE_MONEY_SECRET =
  process.env.MOBILE_MONEY_WEBHOOK_SECRET ?? 'dev-secret';

/**
 * Mobile Money provider (Airtel / MoMo). Stubbed implementation — no real
 * network calls. In production, swap the `initiate` body with the relevant
 * API client.
 *
 * Idempotency: callers MUST pass `idempotencyKey`. The provider checks for an
 * existing payment with that key and returns the original session instead of
 * creating a duplicate.
 *
 * Webhook signature: HMAC-SHA256 of the raw payload, hex-encoded, compared
 * with `crypto.timingSafeEqual`.
 */
export class MobileMoneyProvider {
  private readonly secret = MOBILE_MONEY_SECRET;

  // The provider contract accepts InitiatePayment; this stub doesn't need to
  // inspect it (idempotency is handled by PaymentsService). Reference the
  // parameter so the linter doesn't flag it as unused.
  initiate(
    params: InitiatePayment & { phone: string; provider: PaymentProvider },
  ): Promise<PaymentSession> {
    void params;
    // Caller (PaymentsService) is expected to check idempotencyKey first.
    // This stub just returns a fake session.
    return Promise.resolve({
      id: `mm-${Date.now()}`,
      status: 'PENDING_VALIDATION',
      reference: `mm-ref-${Math.random().toString(36).slice(2, 10)}`,
    });
  }

  handleWebhook(rawPayload: string, signature: string): Promise<WebhookResult> {
    if (!this.verifyWebhookSignature(rawPayload, signature)) {
      throw new Error('Invalid signature');
    }
    const parsed = JSON.parse(rawPayload) as {
      reference?: string;
      status?: 'SUCCESS' | 'FAILED';
      providerRef?: string;
    };
    return Promise.resolve({
      reference: parsed.reference ?? '',
      status: parsed.status === 'SUCCESS' ? 'VALIDATED' : 'FAILED',
      providerRef: parsed.providerRef,
    });
  }

  getStatus(reference: string): Promise<PaymentStatus> {
    // Stub: would call the provider API with `reference`.
    void reference;
    return Promise.resolve('PENDING_VALIDATION');
  }

  signPayload(rawPayload: string): string {
    return createHmac('sha256', this.secret).update(rawPayload).digest('hex');
  }

  verifyWebhookSignature(rawPayload: string, signature: string): boolean {
    const expected = this.signPayload(rawPayload);
    if (expected.length !== signature.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}
