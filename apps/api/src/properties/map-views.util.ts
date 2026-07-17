export const KNOWN_MAP_VIEWS = ['neighborhood', 'tour360'] as const;
export type KnownMapView = (typeof KNOWN_MAP_VIEWS)[number];

export function filterMapViews(value: unknown): KnownMapView[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(KNOWN_MAP_VIEWS);
  const out: KnownMapView[] = [];
  for (const item of value) {
    if (typeof item === 'string' && allowed.has(item)) {
      out.push(item as KnownMapView);
    }
  }
  return out;
}
