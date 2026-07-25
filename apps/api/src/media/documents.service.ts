import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from './r2.service';
import { MAX_PHOTO_BYTES } from './media.service';

export interface PropertyDocumentItem {
  id: string;
  propertyId: string;
  type: string;
  url: string;
  name: string;
  createdAt: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async list(propertyId: string): Promise<PropertyDocumentItem[]> {
    await this.requireProperty(propertyId);
    const rows = await this.prisma.propertyDocument.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((d) => this.toPublic(d));
  }

  async upload(
    userId: string,
    propertyId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    input: { type: DocumentType; name?: string },
  ): Promise<PropertyDocumentItem> {
    await this.assertCanWrite(userId, propertyId);
    if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
      throw new BadRequestException({
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: 'Documents must be PDF or image',
      });
    }
    if (file.buffer.length > MAX_PHOTO_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'Le document ne doit pas dépasser 15 Mo.',
      });
    }
    const { url } = await this.r2.uploadPropertyFile({
      propertyId,
      filename: file.originalname || 'document.bin',
      contentType: file.mimetype,
      body: file.buffer,
    });
    const created = await this.prisma.propertyDocument.create({
      data: {
        propertyId,
        type: input.type,
        url,
        name: input.name?.trim() || file.originalname || 'Document',
      },
    });
    return this.toPublic(created);
  }

  async remove(
    userId: string,
    propertyId: string,
    documentId: string,
  ): Promise<void> {
    await this.assertCanWrite(userId, propertyId);
    const doc = await this.prisma.propertyDocument.findFirst({
      where: { id: documentId, propertyId },
    });
    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document does not exist on this property',
      });
    }
    await this.prisma.propertyDocument.delete({ where: { id: documentId } });
    const key = this.r2.keyFromPublicUrl(doc.url);
    if (key) {
      try {
        await this.r2.deleteObject(key);
      } catch {
        // orphan R2 ok for V1
      }
    }
  }

  private toPublic(d: {
    id: string;
    propertyId: string;
    type: string;
    url: string;
    name: string;
    createdAt: Date;
  }): PropertyDocumentItem {
    return {
      id: d.id,
      propertyId: d.propertyId,
      type: d.type,
      url: d.url,
      name: d.name,
      createdAt: d.createdAt.toISOString(),
    };
  }

  private async requireProperty(propertyId: string): Promise<void> {
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
  }

  private async assertCanWrite(
    userId: string,
    propertyId: string,
  ): Promise<void> {
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
    if (property.ownerId === userId) return;
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
        message: 'Only the owner or an org member can manage documents',
      });
    }
  }
}
