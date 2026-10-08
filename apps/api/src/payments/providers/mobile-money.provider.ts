import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PaymentProvider as PaymentProviderName } from '@prisma/client';
import {
  InitiatePayment,
  PaymentSession,
  PaymentStatus,
  ProviderOutcome,
} from './payment-provider.interface';

/**
 * Spec 05 P0 — encaissements Airtel Money et MTN MoMo.
 *
 * Contrats réels (portés depuis AuraSpot) :
 * - MTN MoMo Collection API : POST /collection/token/ (Basic), POST
 *   /collection/v1_0/requesttopay (202 attendu), GET
 *   /collection/v1_0/requesttopay/{ref} → SUCCESSFUL | FAILED | REJECTED |
 *   TIMEOUT | PENDING.
 * - Airtel Money : POST /auth/oauth2/token (client_credentials), POST
 *   /merchant/v1/payments/ (subscriber msisdn national + transaction.id), GET
 *   /standard/v1/payments/{id} → TS succès, TF échec, TE expiré, TIP/TA en
 *   cours.
 *
 * Sans identifiants (dev / tests) on retombe sur un sandbox stub : mêmes
 * sessions INITIATED, aucun appel réseau ; le statut final vient alors du
 * webhook générique ou expire via le cron. En production, renseigner
 * AIRTEL_CLIENT_ID/AIRTEL_CLIENT_SECRET (resp. MOMO_COLLECTION_SUBSCRIPTION_KEY,
 * MOMO_API_USER, MOMO_API_KEY) pour activer l'intégration réelle.
 *
 * Webhooks : allowlist IP (AIRTEL_WEBHOOK_IPS / MOMO_WEBHOOK_IPS, séparées
 * par virgule) + signature HMAC du fournisseur (AIRTEL_WEBHOOK_SECRET /
 * MOMO_WEBHOOK_SECRET, repli MOBILE_MONEY_WEBHOOK_SECRET, puis 'dev-secret').
 * Le statut final est toujours relu sur l'API du fournisseur (le payload ne
 * sert qu'à retrouver la transaction).
 */

const TRAILING_SLASH_RE = /\/$/;
const DASH_RE = /-/g;
const HTTP_TIMEOUT_MS = 15_000;

export class MobileMoneyError extends Error {}

type CachedToken = { value: string; expiresAt: number };
const tokens = new Map<PaymentProviderName, CachedToken>();

function cachedToken(provider: PaymentProviderName): string | null {
  const token = tokens.get(provider);
  // Renew one minute before expiry.
  return token && token.expiresAt - 60_000 > Date.now() ? token.value : null;
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface AirtelConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  country: string;
  currency: string;
}

function airtelConfig(): AirtelConfig | null {
  const clientId = env('AIRTEL_CLIENT_ID');
  const clientSecret = env('AIRTEL_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  return {
    baseUrl: (env('AIRTEL_BASE_URL') ?? 'https://openapiuat.airtel.africa').replace(
      TRAILING_SLASH_RE,
      '',
    ),
    clientId,
    clientSecret,
    country: env('AIRTEL_COUNTRY') ?? 'CG',
    currency: env('AIRTEL_CURRENCY') ?? 'XAF',
  };
}

interface MomoConfig {
  baseUrl: string;
  targetEnvironment: string;
  subscriptionKey: string;
  apiUser: string;
  apiKey: string;
  currency: string;
}

function momoConfig(): MomoConfig | null {
  const subscriptionKey = env('MOMO_COLLECTION_SUBSCRIPTION_KEY');
  const apiUser = env('MOMO_API_USER');
  const apiKey = env('MOMO_API_KEY');
  if (!subscriptionKey || !apiUser || !apiKey) return null;
  const targetEnvironment = env('MOMO_TARGET_ENVIRONMENT') ?? 'sandbox';
  return {
    baseUrl: (env('MOMO_BASE_URL') ?? 'https://sandbox.momodeveloper.mtn.com').replace(
      TRAILING_SLASH_RE,
      '',
    ),
    targetEnvironment,
    subscriptionKey,
    apiUser,
    apiKey,
    currency: env('MOMO_CURRENCY') ?? (targetEnvironment === 'sandbox' ? 'EUR' : 'XAF'),
  };
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

async function momoToken(config: MomoConfig): Promise<string> {
  const cached = cachedToken('MOMO');
  if (cached) return cached;
  const basic = Buffer.from(`${config.apiUser}:${config.apiKey}`).toString('base64');
  const res = await fetch(`${config.baseUrl}/collection/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Ocp-Apim-Subscription-Key': config.subscriptionKey,
    },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new MobileMoneyError(`MoMo token refusé (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokens.set('MOMO', {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

async function airtelToken(config: AirtelConfig): Promise<string> {
  const cached = cachedToken('AIRTEL');
  if (cached) return cached;
  const res = await fetch(`${config.baseUrl}/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'client_credentials',
    }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new MobileMoneyError(`Airtel token refusé (${res.status})`);
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number | string;
  };
  tokens.set('AIRTEL', {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  });
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Phone helpers — the operator APIs disagree on the msisdn format.
// ---------------------------------------------------------------------------

function toMsisdn(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** 242061234567 → 061234567 (Airtel subscriber.msisdn expects national). */
function toNational(phone: string): string {
  const msisdn = toMsisdn(phone);
  return msisdn.startsWith('242') ? msisdn.slice(3) : msisdn;
}

// ---------------------------------------------------------------------------
// Provider API calls (live)
// ---------------------------------------------------------------------------

async function momoRequestToPay(
  config: MomoConfig,
  input: { reference: string; externalId: string; amount: number; phone: string; callbackUrl?: string },
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await momoToken(config)}`,
    'X-Reference-Id': input.reference,
    'X-Target-Environment': config.targetEnvironment,
    'Ocp-Apim-Subscription-Key': config.subscriptionKey,
    'Content-Type': 'application/json',
  };
  if (input.callbackUrl) headers['X-Callback-Url'] = input.callbackUrl;

  const res = await fetch(`${config.baseUrl}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      amount: String(input.amount),
      currency: config.currency,
      externalId: input.externalId,
      payer: { partyIdType: 'MSISDN', partyId: toMsisdn(input.phone) },
      payerMessage: 'Paradis Immo',
      payeeNote: 'Paradis Immo',
    }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (res.status !== 202) {
    throw new MobileMoneyError(`MoMo a refusé la demande (${res.status})`);
  }
}

async function momoStatus(config: MomoConfig, reference: string): Promise<ProviderOutcome> {
  const res = await fetch(`${config.baseUrl}/collection/v1_0/requesttopay/${reference}`, {
    headers: {
      Authorization: `Bearer ${await momoToken(config)}`,
      'X-Target-Environment': config.targetEnvironment,
      'Ocp-Apim-Subscription-Key': config.subscriptionKey,
    },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new MobileMoneyError(`Statut MoMo indisponible (${res.status})`);
  const data = (await res.json()) as { status?: string };
  if (data.status === 'SUCCESSFUL') return 'VALIDATED';
  if (data.status === 'FAILED' || data.status === 'REJECTED') return 'FAILED';
  if (data.status === 'TIMEOUT') return 'EXPIRED';
  return 'PENDING';
}

async function airtelRequestToPay(
  config: AirtelConfig,
  input: { reference: string; externalId: string; amount: number; phone: string },
): Promise<void> {
  const token = await airtelToken(config);
  const res = await fetch(`${config.baseUrl}/merchant/v1/payments/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Country': config.country,
      'X-Currency': config.currency,
      'Content-Type': 'application/json',
      Accept: '*/*',
    },
    body: JSON.stringify({
      // Shown to the payer; letters and digits only.
      reference: `ParadisImmo${input.externalId.replace(DASH_RE, '').slice(0, 12)}`,
      subscriber: {
        country: config.country,
        currency: config.currency,
        msisdn: toNational(input.phone),
      },
      transaction: {
        amount: input.amount,
        country: config.country,
        currency: config.currency,
        id: input.reference,
      },
    }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => null)) as {
    status?: { success?: boolean; message?: string };
  } | null;
  if (!(res.ok && data?.status?.success)) {
    throw new MobileMoneyError(
      `Airtel a refusé la demande (${data?.status?.message ?? res.status})`,
    );
  }
}

async function airtelStatus(config: AirtelConfig, reference: string): Promise<ProviderOutcome> {
  const token = await airtelToken(config);
  const res = await fetch(`${config.baseUrl}/standard/v1/payments/${reference}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Country': config.country,
      'X-Currency': config.currency,
      Accept: '*/*',
    },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new MobileMoneyError(`Statut Airtel indisponible (${res.status})`);
  const data = (await res.json()) as {
    data?: { transaction?: { status?: string } };
  };
  const status = data.data?.transaction?.status;
  if (status === 'TS') return 'VALIDATED';
  if (status === 'TF') return 'FAILED';
  if (status === 'TE') return 'EXPIRED';
  return 'PENDING';
}

// ---------------------------------------------------------------------------
// Public provider
// ---------------------------------------------------------------------------

export interface WebhookVerification {
  valid: boolean;
  reason: string | null;
}

export interface ParsedWebhook {
  /** Our transaction reference (Airtel `transaction.id`, MoMo `externalId`). */
  providerRef: string | null;
  outcome: ProviderOutcome;
}

export class MobileMoneyProvider {
  /** True when real operator credentials are configured for this provider. */
  isConfigured(provider: PaymentProviderName): boolean {
    return provider === 'MOMO' ? momoConfig() !== null : airtelConfig() !== null;
  }

  // -- Generic HMAC (legacy route + tests) ---------------------------------

  private get secret(): string {
    return env('MOBILE_MONEY_WEBHOOK_SECRET') ?? 'dev-secret';
  }

  signPayload(rawPayload: string): string {
    return createHmac('sha256', this.secret).update(rawPayload).digest('hex');
  }

  verifyWebhookSignature(rawPayload: string, signature: string): boolean {
    const expected = this.signPayload(rawPayload);
    if (expected.length !== signature.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  /**
   * Spec 05 — per-provider webhook verification: IP allowlist first, then the
   * provider's own HMAC signature (secret env, fallback to the generic one so
   * dev/test setups keep working).
   */
  verifyProviderWebhook(
    provider: PaymentProviderName,
    rawPayload: string,
    signature: string | undefined,
    ip: string | undefined,
  ): WebhookVerification {
    const allowlist = env(provider === 'MOMO' ? 'MOMO_WEBHOOK_IPS' : 'AIRTEL_WEBHOOK_IPS');
    if (allowlist) {
      const allowed = allowlist.split(',').map((entry) => entry.trim()).filter(Boolean);
      if (!ip || !allowed.includes(ip)) {
        return { valid: false, reason: 'IP_NOT_ALLOWED' };
      }
    }
    const providerSecret =
      env(provider === 'MOMO' ? 'MOMO_WEBHOOK_SECRET' : 'AIRTEL_WEBHOOK_SECRET') ??
      this.secret;
    if (!signature) return { valid: false, reason: 'SIGNATURE_MISSING' };
    const expected = createHmac('sha256', providerSecret)
      .update(rawPayload)
      .digest('hex');
    if (expected.length !== signature.length) return { valid: false, reason: 'BAD_SIGNATURE' };
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
      ? { valid: true, reason: null }
      : { valid: false, reason: 'BAD_SIGNATURE' };
  }

  /** Extracts (reference, outcome) from a provider-specific webhook payload. */
  parseWebhook(provider: PaymentProviderName, rawPayload: string): ParsedWebhook {
    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(rawPayload) as Record<string, unknown>;
    } catch {
      body = null;
    }

    if (provider === 'MOMO') {
      const externalId =
        (typeof body?.externalId === 'string' ? body.externalId : null) ??
        (typeof body?.referenceId === 'string' ? body.referenceId : null);
      const status = typeof body?.status === 'string' ? body.status : undefined;
      return { providerRef: externalId, outcome: mapMomoStatus(status) };
    }

    const transaction = (body?.transaction ?? null) as Record<string, unknown> | null;
    const id =
      (typeof transaction?.id === 'string' ? transaction.id : null) ??
      (typeof body?.id === 'string' ? body.id : null);
    const statusCode =
      (typeof transaction?.status_code === 'string' ? transaction.status_code : null) ??
      (typeof transaction?.status === 'string' ? transaction.status : null);
    return { providerRef: id, outcome: mapAirtelStatus(statusCode) };
  }

  /** Legacy generic webhook contract: { reference, providerRef?, status }. */
  parseGenericWebhook(rawPayload: string): ParsedWebhook {
    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(rawPayload) as Record<string, unknown>;
    } catch {
      body = null;
    }
    const reference =
      (typeof body?.reference === 'string' ? body.reference : null) ??
      (typeof body?.providerRef === 'string' ? body.providerRef : null);
    const status = typeof body?.status === 'string' ? body.status : undefined;
    const outcome: ProviderOutcome =
      status === 'SUCCESS' || status === 'SUCCESSFUL' || status === 'TS'
        ? 'VALIDATED'
        : status === 'FAILED' || status === 'TF' || status === 'REJECTED'
          ? 'FAILED'
          : status === 'TE' || status === 'TIMEOUT'
            ? 'EXPIRED'
            : 'PENDING';
    return { providerRef: reference, outcome };
  }

  /**
   * Spec 05 P0 — starts the USSD push. Falls back to the sandbox stub when the
   * operator credentials are absent (dev / tests): same INITIATED session,
   * no network call, final status comes from the webhook or the expiry cron.
   */
  async initiate(
    params: InitiatePayment & {
      phone: string;
      provider: PaymentProviderName;
      reference?: string;
      callbackUrl?: string;
    },
  ): Promise<PaymentSession> {
    const reference = params.reference ?? `mm-ref-${randomUUID()}`;
    const amount = Number(params.amount);
    const provider = params.provider;

    const momo = momoConfig();
    const airtel = airtelConfig();
    if (provider === 'MOMO' && momo) {
      await momoRequestToPay(momo, {
        reference,
        externalId: params.idempotencyKey,
        amount,
        phone: params.phone,
        callbackUrl: params.callbackUrl,
      });
    } else if (provider === 'AIRTEL' && airtel) {
      await airtelRequestToPay(airtel, {
        reference,
        externalId: params.idempotencyKey,
        amount,
        phone: params.phone,
      });
    } else {
      // Sandbox stub — no credentials configured.
      return {
        id: `mm-${Date.now()}`,
        status: 'INITIATED',
        reference,
        providerRef: reference,
      };
    }

    return {
      id: reference,
      status: 'INITIATED',
      reference,
      providerRef: reference,
    };
  }

  /**
   * Polls the operator. The stub always reports PENDING, which lets the
   * expiry cron close stale payments exactly like production does.
   */
  async getStatus(provider: PaymentProviderName, reference: string): Promise<ProviderOutcome> {
    const momo = momoConfig();
    const airtel = airtelConfig();
    try {
      if (provider === 'MOMO' && momo) return await momoStatus(momo, reference);
      if (provider === 'AIRTEL' && airtel) return await airtelStatus(airtel, reference);
    } catch {
      // Network / operator outage: keep the payment pending rather than
      // failing real money; the next poll or the webhook will decide.
      return 'PENDING';
    }
    return 'PENDING';
  }
}

function mapMomoStatus(status: string | null | undefined): ProviderOutcome {
  if (status === 'SUCCESSFUL') return 'VALIDATED';
  if (status === 'FAILED' || status === 'REJECTED') return 'FAILED';
  if (status === 'TIMEOUT') return 'EXPIRED';
  return 'PENDING';
}

function mapAirtelStatus(status: string | null | undefined): ProviderOutcome {
  if (status === 'TS' || status === 'SUCCESS') return 'VALIDATED';
  if (status === 'TF' || status === 'FAILED') return 'FAILED';
  if (status === 'TE' || status === 'EXPIRED') return 'EXPIRED';
  return 'PENDING';
}
