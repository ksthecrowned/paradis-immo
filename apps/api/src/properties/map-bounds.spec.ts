import { BadRequestException } from '@nestjs/common';
import { mapBoundsWhere } from './map-bounds';

describe('map bounds filtering', () => {
  it('builds inclusive latitude and longitude ranges', () => {
    expect(
      mapBoundsWhere({
        minLat: -4.3,
        maxLat: -4.2,
        minLng: 15.1,
        maxLng: 15.3,
      }),
    ).toEqual({
      lat: { gte: -4.3, lte: -4.2 },
      lng: { gte: 15.1, lte: 15.3 },
    });
  });

  it('rejects partial bounds', () => {
    expect(() => mapBoundsWhere({ minLat: -4 })).toThrow(BadRequestException);
  });

  it('rejects reversed bounds', () => {
    expect(() =>
      mapBoundsWhere({
        minLat: -4.2,
        maxLat: -4.3,
        minLng: 15,
        maxLng: 16,
      }),
    ).toThrow(BadRequestException);
  });
});
