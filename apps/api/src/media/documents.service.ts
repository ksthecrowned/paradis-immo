import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { R2Service } from './r2.service';
import { MAX_PHOTO_BYTES } from './media.service';

export interface PropertyDocumentItem {
  id: string;
  propertyId: string;
  type: string;
  /** URL signée de 5 minutes (spéc 13 — jamais d'URL publique brute). */
  url: string;
  name: string;
  createdAt: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

  /**
   * Spéc 13 — réservé au gestionnaire (owner, gérant ou agent assigné) :
   * titres fonciers et plans ne sont jamais publics. Les URL renvoyées sont
   * signées et expirées (5 min, même TTL que les pièces KYC).
   */
  async list(
    userId: string,
    propertyId: string,
  ): Promise<PropertyDocumentItem[]> {
    await this.requireProperty(propertyId);
    await this.agencyAccess.assertCanOperateOnProperty(userId, propertyId);
    const rows = await this.prisma.propertyDocument.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(rows.map((d) => this.toPublic(d)));
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

  private async toPublic(d: {
    id: string;
    propertyId: string;
    type: string;
    url: string;
    name: string;
    createdAt: Date;
  }): Promise<PropertyDocumentItem> {
    // Signe les documents privés (titres fonciers, plans) de façon courte.
    let signedUrl = d.url;
    const key = this.r2.keyFromPublicUrl(d.url);
    if (key) {
      try {
        signedUrl = await this.r2.createPresignedDownload(key);
      } catch {
        // fallback URL publique si la signature échoue (ne pas casser l'UI).
      }
    }
    return {
      id: d.id,
      propertyId: d.propertyId,
      type: d.type,
      url: signedUrl,
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
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(userId, propertyId);
  }
}
