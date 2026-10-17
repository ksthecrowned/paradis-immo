export function isValidMoveInDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return false;
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return date >= today;
}

export function rentalApplicationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    SUBMITTED: 'Envoyée',
    UNDER_REVIEW: 'En cours d’étude',
    SOLVENCY_PENDING: 'Consentement de solvabilité requis',
    ACCEPTED: 'Acceptée · bail à préparer',
    REJECTED: 'Refusée',
    WITHDRAWN: 'Retirée',
  };
  return labels[status] ?? status;
}

export function canWithdrawApplication(status: string): boolean {
  return ['SUBMITTED', 'UNDER_REVIEW', 'SOLVENCY_PENDING'].includes(status);
}
