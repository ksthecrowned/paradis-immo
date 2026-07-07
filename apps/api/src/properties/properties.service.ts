import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Property, PropertyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
} from './dto/create-property.dto';
import { FilterPropertiesDto } from './dto/filter-properties.dto';
import { OrganizationsService } from '../organizations/organizations.service';

export interface PublicProperty {
  id: string;
  title: string;
  description: string;
  type: string;
  mode: string;
  status: string;
  price: number;
  currency: string;
  priceUnit: string;
  address: string;
  lat: number | null;
  lng: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  surface: number | null;
  visitEnabled: boolean;
  visitType: string | null;
  visitPrice: number | null;
  visitDuration: number | null;
  quartier: {
    id: string;
    name: string;
    arrondissement: {
      id: string;
      name: string;
      city: { id: string; name: string };
    };
  };
  ownerOrg: { id: string; name: string; type: string };
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedProperties {
  data: PublicProperty[];
  meta: { total: number; limit: number; offset: number };
}

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgs: OrganizationsService,
    private readonly events: EventPublisher,
  ) {}

  // ------------------------------------------------------------------
  // Create
  // ------------------------------------------------------------------

  async create(
    userId: string,
    dto: CreatePropertyDto,
  ): Promise<PublicProperty> {
    // Ensure quartier exists in target country (catches obvious mistakes early)
    const quartier = await this.prisma.quartier.findUnique({
      where: { id: dto.quartierId },
      include: { arrondissement: { include: { city: true } } },
    });
    if (!quartier) {
      throw new NotFoundException({
        code: 'QUARTIER_NOT_FOUND',
        message: 'Quartier does not exist',
      });
    }
    if (quartier.arrondissement.city.countryId !== dto.countryId) {
      throw new BadRequestException({
        code: 'QUARTIER_COUNTRY_MISMATCH',
        message: 'Quartier does not belong to the given country',
      });
    }

    // Auto-create / reuse the user's personal OWNER org
    const ownerOrg = await this.orgs.ensureOwnerOrg(userId, dto.countryId);

    const created = await this.prisma.property.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        mode: dto.mode,
        price: new Prisma.Decimal(dto.price),
        currency: dto.currency,
        priceUnit: dto.priceUnit,
        quartierId: dto.quartierId,
        address: dto.address,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        countryId: dto.countryId,
        ownerId: userId,
        organizationId: ownerOrg.id,
        bedrooms: dto.bedrooms ?? null,
        bathrooms: dto.bathrooms ?? null,
        surface: dto.surface ?? null,
        visitEnabled: dto.visitEnabled ?? false,
        visitType: dto.visitType ?? null,
        visitPrice:
          dto.visitPrice !== undefined
            ? new Prisma.Decimal(dto.visitPrice)
            : null,
        visitDuration: dto.visitDuration ?? null,
      },
      include: this.publicInclude(),
    });

    return this.toPublic(created);
  }

  // ------------------------------------------------------------------
  // Read one / list
  // ------------------------------------------------------------------

  async getOne(id: string): Promise<PublicProperty> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: this.publicInclude(),
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    return this.toPublic(property);
  }

  async list(filter: FilterPropertiesDto): Promise<PaginatedProperties> {
    const limit = filter.limit ?? 20;
    const offset = filter.offset ?? 0;

    const where: Prisma.PropertyWhereInput = {
      ...(filter.mode ? { mode: filter.mode } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.quartierId ? { quartierId: filter.quartierId } : {}),
      ...(filter.arrondissementId
        ? { quartier: { arrondissementId: filter.arrondissementId } }
        : {}),
      ...(filter.cityId
        ? { quartier: { arrondissement: { cityId: filter.cityId } } }
        : {}),
      ...(filter.countryCode
        ? { country: { code: filter.countryCode.toUpperCase() } }
        : {}),
      ...(filter.organizationId
        ? { organizationId: filter.organizationId }
        : {}),
      ...(filter.minPrice !== undefined || filter.maxPrice !== undefined
        ? {
            price: {
              ...(filter.minPrice !== undefined
                ? { gte: new Prisma.Decimal(filter.minPrice) }
                : {}),
              ...(filter.maxPrice !== undefined
                ? { lte: new Prisma.Decimal(filter.maxPrice) }
                : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: this.publicInclude(),
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: rows.map((p) => this.toPublic(p)),
      meta: { total, limit, offset },
    };
  }

  /**
   * List properties owned by the given user. Used by owner / agent dashboards
   * to show "my listings". Honours the same `mode` / `status` filters as the
   * public marketplace list, but is always scoped by `ownerId`.
   */
  async listMine(
    userId: string,
    filter: FilterPropertiesDto,
  ): Promise<PaginatedProperties> {
    const limit = filter.limit ?? 20;
    const offset = filter.offset ?? 0;
    const where: Prisma.PropertyWhereInput = {
      ownerId: userId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.mode ? { mode: filter.mode } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: this.publicInclude(),
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.property.count({ where }),
    ]);
    return {
      data: rows.map((p) => this.toPublic(p)),
      meta: { total, limit, offset },
    };
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------

  async update(
    userId: string,
    id: string,
    dto: UpdatePropertyDto,
  ): Promise<PublicProperty> {
    const existing = await this.prisma.property.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }

    // Enforce: an ACTIVE property cannot switch mode — must be archived first.
    if (
      dto.mode &&
      dto.mode !== existing.mode &&
      existing.status === PropertyStatus.ACTIVE
    ) {
      throw new BadRequestException({
        code: 'MODE_CHANGE_REQUIRES_ARCHIVE',
        message:
          'Cannot change mode on an ACTIVE property. Archive it first, then create a new listing.',
      });
    }

    // RBAC: only the owner of the property (or an AGENT/ADMIN of the managing org) can update.
    await this.assertCanWrite(
      userId,
      existing.ownerId,
      existing.organizationId,
    );

    const updated = await this.prisma.property.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.price !== undefined
          ? { price: new Prisma.Decimal(dto.price) }
          : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.priceUnit !== undefined ? { priceUnit: dto.priceUnit } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
        ...(dto.bedrooms !== undefined ? { bedrooms: dto.bedrooms } : {}),
        ...(dto.bathrooms !== undefined ? { bathrooms: dto.bathrooms } : {}),
        ...(dto.surface !== undefined ? { surface: dto.surface } : {}),
        ...(dto.visitEnabled !== undefined
          ? { visitEnabled: dto.visitEnabled }
          : {}),
        ...(dto.visitType !== undefined ? { visitType: dto.visitType } : {}),
        ...(dto.visitPrice !== undefined
          ? { visitPrice: new Prisma.Decimal(dto.visitPrice) }
          : {}),
        ...(dto.visitDuration !== undefined
          ? { visitDuration: dto.visitDuration }
          : {}),
      },
      include: this.publicInclude(),
    });

    return this.toPublic(updated);
  }

  // ------------------------------------------------------------------
  // Archive
  // ------------------------------------------------------------------

  async archive(userId: string, id: string): Promise<PublicProperty> {
    const existing = await this.prisma.property.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    await this.assertCanWrite(
      userId,
      existing.ownerId,
      existing.organizationId,
    );

    if (existing.status === PropertyStatus.ARCHIVED) {
      return this.getOne(id);
    }

    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: PropertyStatus.ARCHIVED },
      include: this.publicInclude(),
    });
    return this.toPublic(updated);
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private async assertCanWrite(
    userId: string,
    ownerId: string,
    organizationId: string,
  ): Promise<void> {
    if (ownerId === userId) return;
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'NOT_PROPERTY_OWNER',
        message:
          'Only the property owner or a member of the managing organization can modify this property',
      });
    }
  }

  private publicInclude(): Prisma.PropertyInclude {
    return {
      quartier: {
        include: {
          arrondissement: {
            include: { city: true },
          },
        },
      },
      organization: true,
    };
  }

  private toPublic(
    p: Property & {
      quartier: {
        id: string;
        name: string;
        arrondissement?: {
          id: string;
          name: string;
          city?: { id: string; name: string };
        };
      };
      organization: { id: string; name: string; type: string };
    },
  ): PublicProperty {
    const arr = p.quartier.arrondissement;
    if (!arr) {
      throw new Error(
        'PropertiesService.toPublic: quartier.arrondissement missing — include chain broken',
      );
    }
    const city = arr.city;
    if (!city) {
      throw new Error(
        'PropertiesService.toPublic: arrondissement.city missing — include chain broken',
      );
    }
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      type: p.type,
      mode: p.mode,
      status: p.status,
      price: Number(p.price),
      currency: p.currency,
      priceUnit: p.priceUnit,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      surface: p.surface,
      visitEnabled: p.visitEnabled,
      visitType: p.visitType,
      visitPrice: p.visitPrice !== null ? Number(p.visitPrice) : null,
      visitDuration: p.visitDuration,
      quartier: {
        id: p.quartier.id,
        name: p.quartier.name,
        arrondissement: {
          id: arr.id,
          name: arr.name,
          city: {
            id: city.id,
            name: city.name,
          },
        },
      },
      ownerOrg: {
        id: p.organization.id,
        name: p.organization.name,
        type: p.organization.type,
      },
      ownerId: p.ownerId,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
