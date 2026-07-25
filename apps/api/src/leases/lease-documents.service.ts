import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaseDocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { R2Service } from '../media/r2.service';
import { MAX_PHOTO_BYTES } from '../media/media.service';

export type LeaseDocumentItem = {
  id: string;
  leaseId: string;
  type: string;
  url: string;
  name: string;
  uploadedBy: string;
  createdAt: string;
};

@Injectable()
export class LeaseDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly r2: R2Service,
  ) {}

  async list(
    userId: string,
    leaseId: string,
  ): Promise<LeaseDocumentItem[]> {
    await this.assertCanRead(userId, leaseId);
    const rows = await this.prisma.leaseDocument.findMany({
      where: { leaseId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((d) => this.toPublic(d));
  }

  async upload(
    managerUserId: string,
    leaseId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    input: { type: LeaseDocumentType; name?: string },
  ): Promise<LeaseDocumentItem> {
    await this.assertCanWrite(managerUserId, leaseId);
    this.assertFile(file);
    const { url } = await this.r2.uploadLeaseFile({
      leaseId,
      filename: file.originalname || 'document.bin',
      contentType: file.mimetype,
      body: file.buffer,
    });
    const created = await this.prisma.leaseDocument.create({
      data: {
        leaseId,
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
    leaseId: string,
    documentId: string,
  ): Promise<void> {
    await this.assertCanWrite(managerUserId, leaseId);
    const doc = await this.prisma.leaseDocument.findFirst({
      where: { id: documentId, leaseId },
    });
    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document does not exist on this lease',
      });
    }
    await this.prisma.leaseDocument.delete({ where: { id: documentId } });
    const key = this.r2.keyFromPublicUrl(doc.url);
    if (key) {
      try {
        await this.r2.deleteObject(key);
      } catch {
        // orphan R2 ok
      }
    }
  }

  private async assertCanRead(userId: string, leaseId: string): Promise<void> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: { tenantId: true, propertyId: true },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    if (lease.tenantId === userId) return;
    try {
      await this.agencyAccess.assertCanOperateOnProperty(
        userId,
        lease.propertyId,
      );
    } catch {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Not allowed to view documents for this lease',
      });
    }
  }

  private async assertCanWrite(
    managerUserId: string,
    leaseId: string,
  ): Promise<void> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: { propertyId: true },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(
      managerUserId,
      lease.propertyId,
    );
  }

  private assertFile(file: { buffer: Buffer; mimetype: string }): void {
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
    leaseId: string;
    type: string;
    url: string;
    name: string;
    uploadedBy: string;
    createdAt: Date;
  }): LeaseDocumentItem {
    return {
      id: d.id,
      leaseId: d.leaseId,
      type: d.type,
      url: d.url,
      name: d.name,
      uploadedBy: d.uploadedBy,
      createdAt: d.createdAt.toISOString(),
    };
  }
}
