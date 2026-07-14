type NumericOpts = { min?: number; max?: number };

export function validateNumeric(value: string, opts: NumericOpts = {}): string | null {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 'Veuillez saisir un nombre valide.';
  if (opts.min !== undefined && parsed < opts.min) {
    return `La valeur doit être supérieure ou égale à ${opts.min}.`;
  }
  if (opts.max !== undefined && parsed > opts.max) {
    return `La valeur doit être inférieure ou égale à ${opts.max}.`;
  }
  return null;
}

export function parseNumeric(value: string): number | null {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
