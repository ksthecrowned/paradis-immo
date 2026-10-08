import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycStatus, OrgMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service, PRIVATE_DOWNLOAD_TTL_SECONDS } from '../media/r2.service';

const ALLOWED_DOCUMENT_TYPES = new Set([
  'ID_CARD',
  'PASSPORT',
  'RCCM',
  'NIU',
]);
const MAX_KYC_BYTES = 15 * 1024 * 1024;
const ORG_MANAGER_ROLES: OrgMemberRole[] = [
  OrgMemberRole.OWNER,
  OrgMemberRole.ADMIN,
];

export interface KycSubmissionItem {
  id: string;
  userId: string | null;
  organizationId: string | null;
  documentType: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** Short-lived signed URL (5 min) — only present to the owner or admin. */
  fileUrl: string | null;
}

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  /** Submit an identity / business document (spec 01 — P1). */
  async submit(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    input: { documentType: string; organizationId?: string },
  ): Promise<KycSubmissionItem> {
    const documentType = input.documentType?.trim().toUpperCase();
    if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) {
      throw new BadRequestException({
        code: 'KYC_DOCUMENT_TYPE_INVALID',
        message: 'documentType must be one of ID_CARD, PASSPORT, RCCM, NIU',
      });
    }
    if (
      !file.mimetype.startsWith('image/') &&
      file.mimetype !== 'application/pdf'
    ) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: 'Les pièces KYC doivent être une image ou un PDF.',
      });
    }
    if (file.buffer.length > MAX_KYC_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'La pièce ne doit pas dépasser 15 Mo.',
      });
    }

    if (input.organizationId) {
      await this.assertOrgManager(userId, input.organizationId);
    }

    const ownerKey = input.organizationId ?? userId;
    const folder = input.organizationId ? 'kyc/org' : 'kyc/user';
    const { key } = await this.r2.uploadPrivateFile({
      folder,
      ownerId: ownerKey,
      filename: file.originalname || 'kyc-document.bin',
      contentType: file.mimetype,
      body: file.buffer,
    });

    const created = await this.prisma.kycSubmission.create({
      data: {
        userId,
        organizationId: input.organizationId ?? null,
        documentType,
        fileKey: key,
        status: KycStatus.PENDING,
      },
    });
    if (!input.organizationId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { kycStatus: KycStatus.PENDING },
      });
    }
    return this.toPublic(created, true);
  }

  /** Every submission the caller owns, directly or through an organization. */
  async mine(userId: string): Promise<KycSubmissionItem[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);
    const rows = await this.prisma.kycSubmission.findMany({
      where: {
        OR: [{ userId }, { organizationId: { in: orgIds } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(rows.map((r) => this.toPublic(r, true)));
  }

  /** Admin queue (spec 12): all submissions, optionally filtered by status. */
  async listForAdmin(status?: KycStatus): Promise<KycSubmissionItem[]> {
    const rows = await this.prisma.kycSubmission.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return Promise.all(rows.map((r) => this.toPublic(r, true)));
  }

  /** Validate or reject a dossier. Only PLATFORM_ADMIN reaches this. */
  async review(
    reviewerId: string,
    id: string,
    input: { status: 'VERIFIED' | 'REJECTED'; rejectionReason?: string },
  ): Promise<KycSubmissionItem> {
    const submission = await this.prisma.kycSubmission.findUnique({
      where: { id },
    });
    if (!submission) {
      throw new NotFoundException({
        code: 'KYC_NOT_FOUND',
        message: 'Dossier KYC introuvable.',
      });
    }
    if (input.status === 'REJECTED' && !input.rejectionReason?.trim()) {
      throw new BadRequestException({
        code: 'KYC_REASON_REQUIRED',
        message: 'Un motif est requis pour rejeter un dossier.',
      });
    }

    const updated = await this.prisma.kycSubmission.update({
      where: { id },
      data: {
        status: input.status as KycStatus,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason:
          input.status === 'REJECTED' ? input.rejectionReason!.trim() : null,
      },
    });

    if (submission.organizationId) {
      await this.prisma.organization.update({
        where: { id: submission.organizationId },
        data: { verified: input.status === 'VERIFIED' },
      });
    } else if (submission.userId) {
      await this.prisma.user.update({
        where: { id: submission.userId },
        data: { kycStatus: input.status as KycStatus },
      });
    }
    return this.toPublic(updated, true);
  }

  private async assertOrgManager(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId, role: { in: ORG_MANAGER_ROLES } },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'ORG_MANAGER_REQUIRED',
        message:
          'Seuls le propriétaire ou un administrateur de l’organisation peuvent soumettre le KYC.',
      });
    }
  }

  private async toPublic(
    row: {
      id: string;
      userId: string | null;
      organizationId: string | null;
      documentType: string;
      fileKey: string;
      status: KycStatus;
      rejectionReason: string | null;
      reviewedAt: Date | null;
      createdAt: Date;
    },
    withUrl: boolean,
  ): Promise<KycSubmissionItem> {
    let fileUrl: string | null = null;
    if (withUrl && row.fileKey) {
      try {
        fileUrl = await this.r2.createPresignedDownload(
          row.fileKey,
          PRIVATE_DOWNLOAD_TTL_SECONDS,
        );
      } catch {
        fileUrl = null;
      }
    }
    return {
      id: row.id,
      userId: row.userId,
      organizationId: row.organizationId,
      documentType: row.documentType,
      status: row.status,
      rejectionReason: row.rejectionReason,
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      fileUrl,
    };
  }
}
