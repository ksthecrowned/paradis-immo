import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantDocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { R2Service } from '../media/r2.service';
import { MAX_PHOTO_BYTES } from '../media/media.service';

export type TenantDocumentItem = {
  id: string;
  userId: string;
  type: string;
  url: string;
  name: string;
  uploadedBy: string;
  createdAt: string;
};

@Injectable()
export class TenantDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly r2: R2Service,
  ) {}

  async listForManagedTenant(
    managerUserId: string,
    tenantUserId: string,
  ): Promise<TenantDocumentItem[]> {
    await this.assertManagerCanAccessTenant(managerUserId, tenantUserId);
    const rows = await this.prisma.tenantDocument.findMany({
      where: { userId: tenantUserId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((d) => this.toPublic(d));
  }

  async listMine(tenantUserId: string): Promise<TenantDocumentItem[]> {
    const rows = await this.prisma.tenantDocument.findMany({
      where: { userId: tenantUserId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((d) => this.toPublic(d));
  }

  async upload(
    managerUserId: string,
    tenantUserId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    input: { type: TenantDocumentType; name?: string },
  ): Promise<TenantDocumentItem> {
    await this.assertManagerCanAccessTenant(managerUserId, tenantUserId);
    this.assertFile(file);
    const { url } = await this.r2.uploadTenantFile({
      userId: tenantUserId,
      filename: file.originalname || 'document.bin',
      contentType: file.mimetype,
      body: file.buffer,
    });
    const created = await this.prisma.tenantDocument.create({
      data: {
        userId: tenantUserId,
        type: input.type,
        url,
        name: input.name?.trim() || file.originalname || 'Document',
        uploadedBy: managerUserId,
      },
    });
    return this.toPublic(created);
  }

  async remove(
    managerUserId: string,
    tenantUserId: string,
    documentId: string,
  ): Promise<void> {
    await this.assertManagerCanAccessTenant(managerUserId, tenantUserId);
    const doc = await this.prisma.tenantDocument.findFirst({
      where: { id: documentId, userId: tenantUserId },
    });
    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document does not exist for this tenant',
      });
    }
    await this.prisma.tenantDocument.delete({ where: { id: documentId } });
    const key = this.r2.keyFromPublicUrl(doc.url);
    if (key) {
      try {
        await this.r2.deleteObject(key);
      } catch {
        // orphan R2 ok
      }
    }
  }

  private async assertManagerCanAccessTenant(
    managerUserId: string,
    tenantUserId: string,
  ): Promise<void> {
    const propertyIds =
      await this.agencyAccess.listOperablePropertyIds(managerUserId);
    if (propertyIds.length === 0) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Locataire introuvable sur vos biens',
      });
    }
    const lease = await this.prisma.lease.findFirst({
      where: {
        tenantId: tenantUserId,
        propertyId: { in: propertyIds },
      },
      select: { id: true },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Locataire introuvable sur vos biens',
      });
    }
  }

  private assertFile(file: {
    buffer: Buffer;
    mimetype: string;
  }): void {
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
  }

  private toPublic(d: {
    id: string;
    userId: string;
    type: string;
    url: string;
    name: string;
    uploadedBy: string;
    createdAt: Date;
  }): TenantDocumentItem {
    return {
      id: d.id,
      userId: d.userId,
      type: d.type,
      url: d.url,
      name: d.name,
      uploadedBy: d.uploadedBy,
      createdAt: d.createdAt.toISOString(),
    };
  }
}
