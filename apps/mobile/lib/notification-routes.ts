export type NotificationDeepLink = {
  pathname: string;
  params?: Record<string, string>;
};

export function resolveNotificationRoute(
  data: Record<string, unknown> | undefined,
): NotificationDeepLink | null {
  if (!data) return null;

  const screen = typeof data.screen === 'string' ? data.screen : undefined;
  if (screen === 'activity') {
    return { pathname: '/activity' };
  }
  if (screen === 'achats/preuves') {
    return { pathname: '/achats/preuves' };
  }
  if (screen === 'cahier-loyer') {
    return { pathname: '/cahier-loyer' };
  }
  if (screen === 'cahier-loyer/solvency') {
    return { pathname: '/cahier-loyer/solvency' };
  }

  const paymentId = data.paymentId;
  if (typeof paymentId === 'string' && paymentId.length > 0) {
    return { pathname: '/payment/[id]', params: { id: paymentId } };
  }

  // Spec 06/11 — a visit push opens the visit detail directly.
  const visitId = data.visitId;
  if (typeof visitId === 'string' && visitId.length > 0) {
    return { pathname: '/visit-detail/[id]', params: { id: visitId } };
  }

  const propertyId = data.propertyId;
  if (typeof propertyId === 'string' && propertyId.length > 0) {
    return { pathname: '/property/[id]', params: { id: propertyId } };
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
