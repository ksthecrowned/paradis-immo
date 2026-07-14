const CURRENCY_RE = /^\d+(\.\d{1,2})?$/;

export function validateCurrency(value: string): string | null {
  if (value === '') return null;
  if (!CURRENCY_RE.test(value)) return 'Montant invalide (ex: 150000 ou 150000.50).';
  return null;
}

export function parseCurrency(value: string): number {
  return Number(value) || 0;
}
