import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import type { PublicProperty } from '../properties/properties.service';

export interface PublicFavorite {
  id: string;
  propertyId: string;
  createdAt: string;
}

export interface PublicFavoriteWithProperty extends PublicFavorite {
  property: PublicProperty;
}

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly properties: PropertiesService,
  ) {}

  async list(
    userId: string,
    includeProperty = false,
  ): Promise<PublicFavorite[] | PublicFavoriteWithProperty[]> {
    if (!includeProperty) {
      const rows = await this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => this.toPublic(r));
    }

    // Spec 15 B3 — 30 favoris en 1 appel réseau : une seule requête
    // favorites, une seule requête properties (include public) et la
    // sérialisation de PropertiesService réutilisée.
    const [rows, properties] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { property: true },
      }),
    ]);
    const ids = rows.map((r) => r.propertyId);
    const full = await this.prisma.property.findMany({
      where: { id: { in: ids } },
      include: this.properties.publicPropertyInclude(),
    });
    const byId = new Map(full.map((p) => [p.id, p]));
    return rows.map((r) => {
      const p = byId.get(r.propertyId);
      return {
        ...this.toPublic(r),
        property: p ? this.properties.toPublic(p) : (null as never),
      };
    });
  }

  async add(userId: string, propertyId: string): Promise<PublicFavorite> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }

    try {
      const row = await this.prisma.favorite.create({
        data: { userId, propertyId },
      });
      return this.toPublic(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'FAVORITE_EXISTS',
          message: 'Property is already in favorites',
        });
      }
      throw err;
    }
  }

  async remove(userId: string, propertyId: string): Promise<void> {
    const row = await this.prisma.favorite.findUnique({
      where: { userId_propertyId: { userId, propertyId } },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'FAVORITE_NOT_FOUND',
        message: 'Favorite does not exist',
      });
    }
    await this.prisma.favorite.delete({
      where: { userId_propertyId: { userId, propertyId } },
    });
  }

  private toPublic(row: {
    id: string;
    propertyId: string;
    createdAt: Date;
  }): PublicFavorite {
    return {
      id: row.id,
      propertyId: row.propertyId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
