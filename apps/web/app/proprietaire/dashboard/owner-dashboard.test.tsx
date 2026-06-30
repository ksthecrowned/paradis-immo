/**
 * Dashboard skeleton tests — verify the page renders the four
 * stat cards, the "Add a property" CTA, and the placeholder note
 * when counters are not yet wired.
 *
 * Rendered via `react-dom/server` to avoid jsdom.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { OwnerDashboard } from '@/app/proprietaire/dashboard/owner-dashboard';

describe('OwnerDashboard (skeleton)', () => {
  it('renders the four stat cards', () => {
    const html = renderToStaticMarkup(
      <OwnerDashboard
        counts={{
          properties: 0,
          activeLeases: 0,
          pendingPayments: 0,
          visitRequests: 0,
        }}
      />,
    );
    expect(html).toMatch(/Biens/);
    expect(html).toMatch(/Baux actifs/);
    expect(html).toMatch(/Paiements en attente/);
    expect(html).toMatch(/Demandes de visite/);
  });

  it('shows the placeholder when the properties count is unknown', () => {
    const html = renderToStaticMarkup(
      <OwnerDashboard
        counts={{
          properties: null,
          activeLeases: 0,
          pendingPayments: 0,
          visitRequests: 0,
        }}
      />,
    );
    // The properties card carries the "Bientôt disponible" hint
    // when no owner-scoped properties endpoint exists yet.
    expect(html).toMatch(/Bientôt disponible/);
  });

  it('renders the "Add a property" CTA linking to /proprietaire/biens/nouveau', () => {
    const html = renderToStaticMarkup(
      <OwnerDashboard
        counts={{
          properties: 3,
          activeLeases: 1,
          pendingPayments: 0,
          visitRequests: 2,
        }}
      />,
    );
    expect(html).toMatch(/href="\/proprietaire\/biens\/nouveau"/);
    expect(html).toMatch(/Ajouter un bien/);
  });
});