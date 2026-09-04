import { describe, expect, test } from 'bun:test';
import {
  formatReviewCreatedLabel,
  mapOrganizationReview,
} from './organization-reviews-map';

describe('organization reviews', () => {
  test('maps API review to UI shape', () => {
    const view = mapOrganizationReview({
      id: 'r1',
      organizationId: 'org1',
      authorName: 'Patricia K.',
      propertyTitle: 'Villa',
      body: 'Top',
      rating: 5,
      createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    });
    expect(view.agencyId).toBe('org1');
    expect(view.authorName).toBe('Patricia K.');
    expect(view.createdLabel).toContain('j');
  });

  test('formatReviewCreatedLabel today', () => {
    expect(formatReviewCreatedLabel(new Date().toISOString())).toBe(
      'Aujourd’hui',
    );
  });
});
