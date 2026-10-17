import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export interface MapBoundsInput {
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
}

export function mapBoundsWhere(
  bounds: MapBoundsInput,
): Prisma.PropertyWhereInput {
  const values = [bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng];
  if (values.every((value) => value === undefined)) return {};
  if (
    bounds.minLat === undefined ||
    bounds.maxLat === undefined ||
    bounds.minLng === undefined ||
    bounds.maxLng === undefined
  ) {
    throw new BadRequestException({
      code: 'INCOMPLETE_MAP_BOUNDS',
      message: 'All four map bounds are required',
    });
  }
  const { minLat, maxLat, minLng, maxLng } = bounds;
  if (
    minLat > maxLat ||
    minLng > maxLng ||
    minLat < -90 ||
    maxLat > 90 ||
    minLng < -180 ||
    maxLng > 180
  ) {
    throw new BadRequestException({
      code: 'INVALID_MAP_BOUNDS',
      message: 'Map bounds are outside valid latitude or longitude ranges',
    });
  }
  return {
    lat: { gte: minLat, lte: maxLat },
    lng: { gte: minLng, lte: maxLng },
  };
}
