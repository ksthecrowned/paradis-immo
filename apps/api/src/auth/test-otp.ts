/**
 * Fixed OTP overrides for demo / store-review accounts.
 * No SMS is sent; the stored code is always the value below.
 */
export const FIXED_OTP_BY_PHONE: Readonly<Record<string, string>> = {
  '+242065152373': '123456',
};

export function fixedOtpFor(phone: string): string | undefined {
  return FIXED_OTP_BY_PHONE[phone];
}

export function isFixedOtpPhone(phone: string): boolean {
  return phone in FIXED_OTP_BY_PHONE;
}
