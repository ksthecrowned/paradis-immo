const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | null {
  if (value === '') return null;
  if (!EMAIL_RE.test(value)) return 'Adresse email invalide.';
  return null;
}
