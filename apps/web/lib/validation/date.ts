export function validateDate(value: string): string | null {
  if (value === '') return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'Date invalide (format AAAA-MM-JJ attendu).';
  return null;
}

export function validateDateAfter(
  startValue: string,
  endValue: string,
  endLabel = 'La date de fin',
): string | null {
  if (!startValue || !endValue) return null;
  const start = Date.parse(startValue);
  const end = Date.parse(endValue);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (end <= start) return `${endLabel} doit être postérieure à la date de début.`;
  return null;
}
