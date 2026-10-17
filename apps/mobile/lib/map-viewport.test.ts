import { describe, expect, it } from 'bun:test';
import { viewportToPropertyFilters } from './map-viewport';

describe('map viewport filters', () => {
  it('converts map region edges to server filters and carries the city filter', () => {
    expect(
      viewportToPropertyFilters(
        {
          latitude: -4.26,
          longitude: 15.24,
          latitudeDelta: 0.12,
          longitudeDelta: 0.1,
        },
        'Brazzaville',
      ),
    ).toEqual({
      minLat: -4.32,
      maxLat: -4.2,
      minLng: 15.19,
      maxLng: 15.29,
      cityName: 'Brazzaville',
    });
  });

  it('clamps bounds at the supported geographic limits', () => {
    expect(
      viewportToPropertyFilters({
        latitude: 89.9,
        longitude: -179.9,
        latitudeDelta: 1,
        longitudeDelta: 1,
      }),
    ).toEqual({
      minLat: 89.4,
      maxLat: 90,
      minLng: -180,
      maxLng: -179.4,
    });
  });
});
