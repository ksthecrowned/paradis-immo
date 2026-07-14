export function validateRequired(value: unknown, label = 'Ce champ'): string | null {
  if (value === null || value === undefined) return `${label} est requis.`;
  if (typeof value === 'string' && value.trim() === '') return `${label} est requis.`;
  if (Array.isArray(value) && value.length === 0) return `${label} est requis.`;
  return null;
}
