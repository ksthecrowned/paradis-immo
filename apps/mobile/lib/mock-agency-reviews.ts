import type { AgencyReview } from '@/lib/map-organization';

/** Seed org UUIDs from apps/api SEED_IDS — reviews stay mock this pass. */
const ORG_PARADIS = '7beb9e56-cd2b-4235-befe-e0aa5f2b3b4b';
const ORG_COTE = '6bb0b69e-7450-4ccb-95bf-6257688c455d';

const MOCK_AGENCY_REVIEWS: AgencyReview[] = [
  {
    id: 'rev-pi-1',
    agencyId: ORG_PARADIS,
    authorName: 'Patricia K.',
    propertyTitle: 'Villa Whispering Pines',
    body: 'Accompagnement clair du premier contact à la visite. Équipe réactive et professionnelle.',
    rating: 5,
    createdLabel: 'Il y a 2 semaines',
  },
  {
    id: 'rev-pi-2',
    agencyId: ORG_PARADIS,
    authorName: 'Marc T.',
    propertyTitle: 'Appartement Centre-ville',
    body: 'Très bon suivi pour la location. Les créneaux de visite étaient bien organisés.',
    rating: 5,
    createdLabel: 'Il y a 1 mois',
  },
  {
    id: 'rev-pi-3',
    agencyId: ORG_PARADIS,
    authorName: 'Nadia B.',
    propertyTitle: 'Maison Tié-Tié',
    body: 'Agence sérieuse, informations transparentes sur le bien et le quartier.',
    rating: 4,
    createdLabel: 'Il y a 2 mois',
  },
  {
    id: 'rev-cs-1',
    agencyId: ORG_COTE,
    authorName: 'Hervé L.',
    propertyTitle: 'Maison Tié-Tié',
    body: 'Bon accueil pour une location journalière. Je recommande.',
    rating: 5,
    createdLabel: 'Il y a 3 semaines',
  },
];

export function listAgencyReviews(agencyId: string): AgencyReview[] {
  return MOCK_AGENCY_REVIEWS.filter((review) => review.agencyId === agencyId);
}

export type { AgencyReview };
