import { NotificationCategory } from '@prisma/client';

const CATEGORY_PREFIXES: ReadonlyArray<
  readonly [string, NotificationCategory]
> = [
  ['PAYMENT_', NotificationCategory.PAYMENTS],
  ['RENT_', NotificationCategory.PAYMENTS],
  ['PAYOUT_', NotificationCategory.PAYMENTS],
  ['REFUND_', NotificationCategory.PAYMENTS],
  ['DEPOSIT_', NotificationCategory.PAYMENTS],
  ['BUYER_PAYMENT_', NotificationCategory.PAYMENTS],
  ['DISPUTE_', NotificationCategory.PAYMENTS],
  ['VISIT_', NotificationCategory.VISITS],
  ['STAY_', NotificationCategory.STAYS],
  ['BOOKING_', NotificationCategory.STAYS],
  ['SALE_', NotificationCategory.SALES],
  ['SOLVENCY_', NotificationCategory.SALES],
  ['MAINTENANCE_', NotificationCategory.MAINTENANCE],
  ['MESSAGE_', NotificationCategory.MESSAGES],
  ['MANDATE_', NotificationCategory.MANDATES],
  ['APPROVAL_', NotificationCategory.MANDATES],
  ['LEASE_', NotificationCategory.LEASES],
  ['AMENDMENT_', NotificationCategory.LEASES],
  ['SECURITY_', NotificationCategory.ACCOUNT],
  ['ACCOUNT_', NotificationCategory.ACCOUNT],
  ['SEARCH_', NotificationCategory.MARKETING],
];

const CRITICAL_NOTIFICATION_TYPES = new Set([
  'RENT_OVERDUE',
  'PAYMENT_RECEIVED',
  'PAYMENT_RECEIPT_READY',
  'PAYMENT_FAILED',
  'PAYMENT_EXPIRED',
  'SECURITY_ALERT',
]);

export function notificationCategoryForType(
  type: string,
): NotificationCategory | null {
  return (
    CATEGORY_PREFIXES.find(([prefix]) => type.startsWith(prefix))?.[1] ?? null
  );
}

export function isPushPreferenceAllowed(
  type: string,
  payload: Record<string, unknown>,
  categoryPushEnabled: boolean,
): boolean {
  if (
    CRITICAL_NOTIFICATION_TYPES.has(type) ||
    type.startsWith('OTP_') ||
    (type === 'MAINTENANCE_OPENED' && payload.priority === 'URGENT')
  ) {
    return true;
  }
  return categoryPushEnabled;
}
