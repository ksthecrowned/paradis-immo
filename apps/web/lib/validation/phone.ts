// Accepts digits, spaces, +, -, parentheses. At least 6 digits.
const PHONE_RE = /^[\d\s+\-()]{6,20}$/;

export function validatePhone(value: string): string | null {
  if (value === '') return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return 'Numéro de téléphone trop court.';
  if (!PHONE_RE.test(value)) return 'Numéro de téléphone invalide.';
  return null;
}
