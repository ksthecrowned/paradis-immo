import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicCity {
  id: string;
  name: string;
  country: { id: string; code: string; name: string };
}

export interface PublicArrondissement {
  id: string;
  name: string;
  number: number | null;
  cityId: string;
}

export interface PublicQuartier {
  id: string;
  name: string;
  arrondissementId: string;
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCities(countryCode?: string): Promise<PublicCity[]> {
    const cities = await this.prisma.city.findMany({
      where: countryCode
        ? { country: { code: countryCode.toUpperCase() } }
        : undefined,
      include: { country: true },
      orderBy: { name: 'asc' },
    });
    return cities.map((c) => ({
      id: c.id,
      name: c.name,
      country: {
        id: c.country.id,
        code: c.country.code,
        name: c.country.name,
      },
    }));
  }

  async listArrondissements(cityId: string): Promise<PublicArrondissement[]> {
    const arrs = await this.prisma.arrondissement.findMany({
      where: { cityId },
      orderBy: [{ number: 'asc' }, { name: 'asc' }],
    });
    return arrs.map((a) => ({
      id: a.id,
      name: a.name,
      number: a.number,
      cityId: a.cityId,
    }));
  }

  async listQuartiers(arrondissementId: string): Promise<PublicQuartier[]> {
    const quartiers = await this.prisma.quartier.findMany({
      where: { arrondissementId },
      orderBy: { name: 'asc' },
    });
    return quartiers.map((q) => ({
      id: q.id,
      name: q.name,
      arrondissementId: q.arrondissementId,
    }));
  }
}
