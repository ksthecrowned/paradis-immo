import { filterMapViews } from './map-views.util';

describe('filterMapViews', () => {
  it('drops streetView and unknown values', () => {
    expect(
      filterMapViews(['neighborhood', 'streetView', 'tour360', 'nope']),
    ).toEqual(['neighborhood', 'tour360']);
  });

  it('returns [] for non-arrays', () => {
    expect(filterMapViews(null)).toEqual([]);
    expect(filterMapViews('neighborhood')).toEqual([]);
  });
});
