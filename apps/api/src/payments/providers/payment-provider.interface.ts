export type PaymentStatus =
  'INITIATED' | 'PENDING_VALIDATION' | 'VALIDATED' | 'FAILED' | 'DISPUTED';

export type PaymentProviderName = 'AIRTEL' | 'MOMO';

export interface InitiatePayment {
  userId: string;
  amount: string | number;
  currency: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentSession {
  id: string;
  status: PaymentStatus;
  reference: string;
  providerRef?: string;
}

export interface WebhookResult {
  reference: string;
  status: PaymentStatus;
  providerRef?: string;
}

export interface PaymentProvider {
  initiate(params: InitiatePayment): Promise<PaymentSession>;
  handleWebhook(payload: unknown): Promise<WebhookResult>;
  getStatus(reference: string): Promise<PaymentStatus>;
}
