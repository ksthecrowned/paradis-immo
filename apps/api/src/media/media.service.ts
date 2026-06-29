import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service, MediaTypeError } from './r2.service';

export interface PresignResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresIn: number;
}

export interface MediaItem {
  id: string;
  url: string;
  type: string;
  position: number;
  propertyId: string;
  createdAt: string;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async presign(
    userId: string,
    propertyId: string,
    input: { filename: string; contentType: string; type: string },
  ): Promise<PresignResult> {
    const property = await this.assertCanWrite(userId, propertyId);
    let mediaType: 'PHOTO' | 'VIDEO';
    try {
      mediaType = this.r2.resolveMediaType(input.contentType);
    } catch (err) {
      if (err instanceof MediaTypeError) {
        throw new BadRequestException({
          code: 'UNSUPPORTED_CONTENT_TYPE',
          message: err.message,
        });
      }
      throw err;
    }
    if (input.type !== mediaType) {
      throw new BadRequestException({
        code: 'MEDIA_TYPE_MISMATCH',
        message: `Declared type "${input.type}" does not match content type "${input.contentType}" (expected ${mediaType})`,
      });
    }
    return this.r2.createPresignedUpload({
      propertyId: property.id,
      filename: input.filename,
      contentType: input.contentType,
    });
  }

  async confirm(
    userId: string,
    propertyId: string,
    input: { url: string; type: MediaType; position?: number },
  ): Promise<MediaItem> {
    await this.assertCanWrite(userId, propertyId);
    try {
      this.r2.validateFileUrl(input.url);
    } catch (err) {
      throw new BadRequestException({
        code: 'INVALID_FILE_URL',
        message: err instanceof Error ? err.message : 'Invalid file URL',
      });
    }

    const created = await this.prisma.propertyMedia.create({
      data: {
        propertyId,
        url: input.url,
        type: input.type,
        position: input.position ?? 0,
      },
    });
    return {
      id: created.id,
      url: created.url,
      type: created.type,
      position: created.position,
      propertyId: created.propertyId,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async list(userId: string | null, propertyId: string): Promise<MediaItem[]> {
    // Read is public for marketplace browsing, but we still verify the property exists.
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, ownerId: true, organizationId: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }

    const rows = await this.prisma.propertyMedia.findMany({
      where: { propertyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((m) => ({
      id: m.id,
      url: m.url,
      type: m.type,
      position: m.position,
      propertyId: m.propertyId,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private async assertCanWrite(
    userId: string,
    propertyId: string,
  ): Promise<{ id: string; ownerId: string; organizationId: string }> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, ownerId: true, organizationId: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    if (property.ownerId === userId) return property;
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: property.organizationId,
        },
      },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'NOT_PROPERTY_OWNER',
        message: 'Only the owner or an org member can manage media',
      });
    }
    return property;
  }
}
