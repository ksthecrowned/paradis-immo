export function messagingConfig() {
  const fx = Number(process.env.USD_TO_XAF);
  if (!Number.isFinite(fx) || fx <= 0) {
    throw new Error('USD_TO_XAF must be a positive number');
  }
  return {
    fxRate: fx,
    otpFreePerMonth: Number(process.env.OTP_FREE_PER_MONTH ?? 10),
    otpUnitUsd: Number(process.env.OTP_UNIT_USD ?? 0.006),
    smsUnitUsd: Number(process.env.SMS_ALERT_UNIT_USD ?? 0.234),
  };
}

/** Half-up integer XAF for positive amounts. */
export function toXaf(unitUsd: number, fxRate: number): number {
  return Math.round(unitUsd * fxRate);
}

export function billingMonthUtc(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export function phonePayerId(phone: string): string {
  return `phone:${phone}`;
}
