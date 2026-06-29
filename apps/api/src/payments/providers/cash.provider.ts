import {
  InitiatePayment,
  PaymentSession,
  PaymentStatus,
} from './payment-provider.interface';

/**
 * Cash provider. Cash payments are never "online" — they're initiated by a
 * tenant at the office or via field agent and then validated by the
 * managing agent/owner. This provider immediately puts the payment in
 * `PENDING_VALIDATION`; validation is done by `PaymentsService.validateCashPayment`.
 */
export class CashProvider {
  initiate(params: InitiatePayment): Promise<PaymentSession> {
    // The contract accepts InitiatePayment; nothing to inspect here — the
    // caller (PaymentsService) handles idempotency. Reference the param so
    // the linter doesn't flag it.
    void params;
    return Promise.resolve({
      id: `cash-${Date.now()}`,
      status: 'PENDING_VALIDATION',
      reference: `cash-ref-${Math.random().toString(36).slice(2, 10)}`,
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async handleWebhook(): Promise<never> {
    throw new Error('Cash provider has no webhooks');
  }

  getStatus(): Promise<PaymentStatus> {
    return Promise.resolve('PENDING_VALIDATION');
  }
}
