import type { PaymentStatus as PrismaPaymentStatus } from '@prisma/client';

/** Spec 05 — mirrors the Prisma `PaymentStatus` enum (single source of truth). */
export type PaymentStatus = PrismaPaymentStatus;

export type PaymentProviderName = 'AIRTEL' | 'MOMO';

/** Outcome reported by a mobile money operator (initiate / poll / webhook). */
export type ProviderOutcome = 'VALIDATED' | 'FAILED' | 'EXPIRED' | 'PENDING';

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
