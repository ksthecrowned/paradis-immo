import type { AgencyReview } from '@/lib/map-organization';

export type PublicOrganizationReview = {
  id: string;
  organizationId: string;
  authorName: string;
  propertyTitle: string | null;
  body: string;
  rating: number;
  createdAt: string;
};

export function formatReviewCreatedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days < 1) return 'Aujourd’hui';
  if (days === 1) return 'Hier';
  if (days < 14) return `Il y a ${days} j`;
  if (days < 45) return `Il y a ${Math.round(days / 7)} sem.`;
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function mapOrganizationReview(
  row: PublicOrganizationReview,
): AgencyReview {
  return {
    id: row.id,
    agencyId: row.organizationId,
    authorName: row.authorName,
    propertyTitle: row.propertyTitle ?? 'Bien',
    body: row.body,
    rating: row.rating,
    createdLabel: formatReviewCreatedLabel(row.createdAt),
  };
}
