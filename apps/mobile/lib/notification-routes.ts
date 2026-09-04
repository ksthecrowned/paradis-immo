export type NotificationDeepLink = {
  pathname: string;
  params?: Record<string, string>;
};

export function resolveNotificationRoute(
  data: Record<string, unknown> | undefined,
): NotificationDeepLink | null {
  if (!data) return null;

  const propertyId = data.propertyId;
  if (typeof propertyId === 'string' && propertyId.length > 0) {
    return { pathname: '/property/[id]', params: { id: propertyId } };
  }

  const paymentId = data.paymentId;
  if (typeof paymentId === 'string' && paymentId.length > 0) {
    return { pathname: '/payment/[id]', params: { id: paymentId } };
  }

  if (data.screen === 'activity') {
    return { pathname: '/activity' };
  }
  if (data.screen === 'achats/preuves') {
    return { pathname: '/achats/preuves' };
  }
  if (data.screen === 'cahier-loyer/solvency') {
    return { pathname: '/cahier-loyer/solvency' };
  }

  const type = data.type;
  if (type === 'RENT_DUE_SOON' || type === 'RENT_OVERDUE') {
    return { pathname: '/(tabs)/locations' };
  }
  if (type === 'VISIT_CONFIRMED' || type === 'PAYMENT_RECEIPT_READY') {
    return { pathname: '/activity' };
  }
  if (type === 'BUYER_PAYMENT_PROOF_REQUESTED') {
    return { pathname: '/achats/preuves' };
  }
  if (type === 'SOLVENCY_CHECK_REQUESTED') {
    return { pathname: '/cahier-loyer/solvency' };
  }

  return null;
}
