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
import {
  assertListingStatusForMode,
  coerceListingStatusForWrite,
  isListingStatusValue,
  resolvePublicListing,
  type ListingStatusValue,
} from './listing-status';

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
  depositMonths: number | null;
  agencyFeeAmount: number | null;
  features: string[];
  listingStatus: ListingStatusValue;
  availableFrom: string | null;
  isFeatured: boolean;
  floor: string | null;
  yearBuilt: number | null;
  condition: string | null;
  lotSize: number | null;
  parkingSpaces: number | null;
  orientation: string | null;
  landTitle: string | null;
  mapViews: string[];
  media: Array<{ id: string; url: string; type: string; position: number }>;
  quartier: {
    id: string;
    name: string;
    arrondissement: {
      id: string;
      name: string;
      city: { id: string; name: string };
    };
  };
  organization: { id: string; name: string; type: string };
  ownerOrg: { id: string; name: string; type: string };
  agent: { id: string; name: string; phone: string | null } | null;
  ownerId: string;
  favoriteCount: number;
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

    // Validate listingStatus against mode (same rules as update).
    const coercedListingStatus = coerceListingStatusForWrite(
      dto.mode,
      dto.listingStatus,
    );
    assertListingStatusForMode(dto.mode, coercedListingStatus);

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
        floor: dto.floor ?? null,
        yearBuilt: dto.yearBuilt ?? null,
        condition: dto.condition ?? null,
        lotSize: dto.lotSize ?? null,
        parkingSpaces: dto.parkingSpaces ?? null,
        orientation: dto.orientation ?? null,
        landTitle: dto.landTitle ?? null,
        features: (dto.features ?? null) as unknown as Prisma.InputJsonValue,
        mapViews: (dto.mapViews ?? null) as unknown as Prisma.InputJsonValue,
        listingStatus: coercedListingStatus,
        availableFrom: dto.availableFrom
          ? new Date(dto.availableFrom)
          : null,
        isFeatured: dto.isFeatured ?? false,
        visitEnabled: dto.visitEnabled ?? false,
        visitType: dto.visitType ?? null,
        visitPrice:
          dto.visitPrice !== undefined
            ? new Prisma.Decimal(dto.visitPrice)
            : null,
        visitDuration: dto.visitDuration ?? null,
        depositMonths: dto.depositMonths ?? null,
        agencyFeeAmount:
          dto.agencyFeeAmount !== undefined
            ? new Prisma.Decimal(dto.agencyFeeAmount)
            : null,
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

    const nextMode = dto.mode ?? existing.mode;
    let nextListingStatus: ListingStatusValue | undefined;
    if (dto.listingStatus !== undefined) {
      nextListingStatus = coerceListingStatusForWrite(
        nextMode,
        dto.listingStatus,
      );
      assertListingStatusForMode(nextMode, nextListingStatus);
    } else if (dto.mode !== undefined && dto.mode === 'RENT_SHORT') {
      nextListingStatus = 'AVAILABLE';
    }

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
        ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
        ...(dto.yearBuilt !== undefined ? { yearBuilt: dto.yearBuilt } : {}),
        ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
        ...(dto.lotSize !== undefined ? { lotSize: dto.lotSize } : {}),
        ...(dto.parkingSpaces !== undefined
          ? { parkingSpaces: dto.parkingSpaces }
          : {}),
        ...(dto.orientation !== undefined
          ? { orientation: dto.orientation }
          : {}),
        ...(dto.landTitle !== undefined ? { landTitle: dto.landTitle } : {}),
        ...(dto.features !== undefined
          ? { features: dto.features as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.mapViews !== undefined
          ? { mapViews: dto.mapViews as unknown as Prisma.InputJsonValue }
          : {}),
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
        ...(dto.depositMonths !== undefined
          ? { depositMonths: dto.depositMonths }
          : {}),
        ...(dto.agencyFeeAmount !== undefined
          ? {
              agencyFeeAmount:
                dto.agencyFeeAmount === null
                  ? null
                  : new Prisma.Decimal(dto.agencyFeeAmount),
            }
          : {}),
        ...(nextListingStatus !== undefined
          ? { listingStatus: nextListingStatus }
          : {}),
        ...(dto.availableFrom !== undefined
          ? {
              availableFrom:
                dto.availableFrom === null
                  ? null
                  : new Date(dto.availableFrom),
            }
          : {}),
        ...(dto.isFeatured !== undefined
          ? { isFeatured: dto.isFeatured }
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

  async publish(userId: string, id: string): Promise<PublicProperty> {
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
    if (
      existing.status !== PropertyStatus.DRAFT &&
      existing.status !== PropertyStatus.PAUSED
    ) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Only DRAFT or PAUSED properties can be published',
      });
    }
    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: PropertyStatus.ACTIVE },
      include: this.publicInclude(),
    });
    return this.toPublic(updated);
  }

  async pause(userId: string, id: string): Promise<PublicProperty> {
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
    if (existing.status !== PropertyStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Only ACTIVE properties can be paused',
      });
    }
    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: PropertyStatus.PAUSED },
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
      organization: {
        include: {
          members: {
            where: { role: 'AGENT' },
            take: 1,
            include: { user: true },
          },
        },
      },
      media: { orderBy: { position: 'asc' } },
      leases: {
        where: { status: 'ACTIVE' },
        orderBy: { endDate: 'asc' },
        take: 1,
        select: { endDate: true },
      },
      _count: { select: { favorites: true } },
    };
  }

  private jsonStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
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
      organization: {
        id: string;
        name: string;
        type: string;
        members?: Array<{
          id: string;
          user: { id: string; name: string | null; phone: string };
        }>;
      };
      media?: Array<{
        id: string;
        url: string;
        type: string;
        position: number;
      }>;
      features?: unknown;
      mapViews?: unknown;
      listingStatus?: string;
      availableFrom?: Date | null;
      isFeatured?: boolean;
      floor?: string | null;
      yearBuilt?: number | null;
      condition?: string | null;
      lotSize?: unknown;
      parkingSpaces?: number | null;
      orientation?: string | null;
      landTitle?: string | null;
      leases?: Array<{ endDate: Date }>;
      _count?: { favorites: number };
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
    const org = {
      id: p.organization.id,
      name: p.organization.name,
      type: p.organization.type,
    };
    const member = p.organization.members?.[0];
    const agent = member
      ? {
          id: member.user.id,
          name: member.user.name ?? 'Agent',
          phone: member.user.phone ?? null,
        }
      : null;
    const media = [...(p.media ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        url: m.url,
        type: m.type,
        position: m.position,
      }));

    const rawStatus = isListingStatusValue(p.listingStatus)
      ? p.listingStatus
      : 'AVAILABLE';
    const resolved = resolvePublicListing({
      mode: p.mode,
      listingStatus: rawStatus,
      availableFrom: p.availableFrom ?? null,
      activeLeaseEndDate: p.leases?.[0]?.endDate ?? null,
    });

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
      depositMonths: p.depositMonths ?? null,
      agencyFeeAmount:
        p.agencyFeeAmount !== null ? Number(p.agencyFeeAmount) : null,
      features: this.jsonStringArray(p.features),
      listingStatus: resolved.listingStatus,
      availableFrom: resolved.availableFrom,
      isFeatured: Boolean(p.isFeatured),
      floor: p.floor ?? null,
      yearBuilt: p.yearBuilt ?? null,
      condition: p.condition ?? null,
      lotSize: p.lotSize != null ? Number(p.lotSize) : null,
      parkingSpaces: p.parkingSpaces ?? null,
      orientation: p.orientation ?? null,
      landTitle: p.landTitle ?? null,
      mapViews: this.jsonStringArray(p.mapViews),
      media,
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
      organization: org,
      ownerOrg: org,
      agent,
      ownerId: p.ownerId,
      favoriteCount: p._count?.favorites ?? 0,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
