import { OWNER_NAV, ROUTES, isNavActive } from './routes';

describe('routes', () => {
  it('uses English path segments for owner properties', () => {
    expect(ROUTES.owner.properties).toBe('/owner/properties');
    expect(ROUTES.owner.propertiesAdd).toBe('/owner/properties/add');
    expect(ROUTES.owner.property('abc')).toBe('/owner/properties/abc');
    expect(ROUTES.owner.visitSlots('abc')).toBe('/owner/properties/abc/visit-slots');
  });

  it('keeps French labels in OWNER_NAV', () => {
    expect(OWNER_NAV.find((n) => n.href === ROUTES.owner.properties)?.label).toBe('Biens');
  });

  it('isNavActive matches child paths for non-exact items', () => {
    const properties = OWNER_NAV.find((n) => n.href === ROUTES.owner.properties)!;
    expect(isNavActive('/owner/properties/add', properties)).toBe(true);
    expect(isNavActive('/owner/dashboard', OWNER_NAV[0]!)).toBe(true);
    expect(isNavActive('/owner/properties', OWNER_NAV[0]!)).toBe(false);
  });
});
