import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MandateDocumentReviewStatus,
  MandateStatus,
  PropertyStatus,
} from '@prisma/client';
import { AuditLogService } from '../common/audit-log.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { R2Service } from '../media/r2.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from './agency-access.service';

const DECIDABLE: MandateDocumentReviewStatus[] = [
  MandateDocumentReviewStatus.APPROVED,
  MandateDocumentReviewStatus.NEEDS_CORRECTION,
  MandateDocumentReviewStatus.REJECTED,
];

const DEPOSITABLE: MandateDocumentReviewStatus[] = [
  MandateDocumentReviewStatus.PENDING,
  MandateDocumentReviewStatus.NEEDS_CORRECTION,
];

const MAX_PAPER_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);

@Injectable()
export class MandateDocumentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly r2: R2Service,
    private readonly events: EventPublisher,
  ) {}

  async listPending(page = 1, pageSize = 20) {
    const take = Math.min(100, Math.max(1, pageSize));
    const skip = (Math.max(1, page) - 1) * take;
    const where = {
      documentReviewStatus: {
        in: [
          MandateDocumentReviewStatus.PENDING,
          MandateDocumentReviewStatus.NEEDS_CORRECTION,
        ],
      },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.mandate.count({ where }),
      this.prisma.mandate.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take,
        select: {
          id: true,
          status: true,
          documentReviewStatus: true,
          documentVersion: true,
          signedDocumentKey: true,
          createdAt: true,
          propertyId: true,
          organizationId: true,
          property: { select: { id: true, title: true, status: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
    ]);
    return { data: rows, meta: { total, page: Math.max(1, page), pageSize: take } };
  }

  /**
   * Agency ADMIN deposits or replaces the signed paper mandate (ADR-0001).
   * Resubmission after NEEDS_CORRECTION returns the review status to PENDING.
   */
  async depositPaperDocument(input: {
    mandateId: string;
    userId: string;
    file: { buffer: Buffer; originalname: string; mimetype: string };
  }) {
    const mime = input.file.mimetype?.toLowerCase() ?? '';
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_CONTENT_TYPE',
        message: 'Le mandat papier doit être un PDF ou une image JPEG/PNG.',
      });
    }
    if (!input.file.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Multipart field "file" is required',
      });
    }
    if (input.file.buffer.length > MAX_PAPER_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'Le document ne doit pas dépasser 15 Mo.',
      });
    }

    const mandate = await this.prisma.mandate.findUnique({
      where: { id: input.mandateId },
      select: {
        id: true,
        propertyId: true,
        organizationId: true,
        documentReviewStatus: true,
        documentVersion: true,
        signedDocumentKey: true,
        status: true,
      },
    });
    if (!mandate) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_FOUND',
        message: 'Mandate not found',
      });
    }
    if (mandate.documentReviewStatus === MandateDocumentReviewStatus.NOT_APPLICABLE) {
      throw new BadRequestException({
        code: 'NOT_PAPER_MANDATE',
        message: 'This mandate has no paper document review queue',
      });
    }
    if (mandate.documentReviewStatus === MandateDocumentReviewStatus.APPROVED) {
      throw new BadRequestException({
        code: 'DOCUMENT_ALREADY_APPROVED',
        message: 'Approved paper mandates cannot be replaced here',
      });
    }
    if (mandate.documentReviewStatus === MandateDocumentReviewStatus.REJECTED) {
      throw new BadRequestException({
        code: 'DOCUMENT_REJECTED',
        message: 'Rejected paper mandates cannot be resubmitted',
      });
    }
    if (!DEPOSITABLE.includes(mandate.documentReviewStatus)) {
      throw new BadRequestException({
        code: 'DOCUMENT_NOT_DEPOSITABLE',
        message: 'Paper document can only be deposited while PENDING or NEEDS_CORRECTION',
      });
    }

    await this.agencyAccess.assertIsAgencyGerant(
      input.userId,
      mandate.organizationId,
    );

    const uploaded = await this.r2.uploadPrivateFile({
      folder: 'mandates/paper',
      ownerId: mandate.organizationId,
      filename: input.file.originalname || 'mandate.pdf',
      contentType: mime,
      body: input.file.buffer,
    });

    const nextVersion = mandate.documentVersion + 1;
    const updated = await this.prisma.mandate.update({
      where: { id: mandate.id },
      data: {
        signedDocumentKey: uploaded.key,
        documentVersion: nextVersion,
        documentReviewStatus: MandateDocumentReviewStatus.PENDING,
        documentReviewReason: null,
        documentReviewedAt: null,
        documentReviewedById: null,
      },
    });

    await this.audit.record({
      actorId: input.userId,
      actorType: 'USER',
      action: 'MANDATE_PAPER_DEPOSITED',
      targetType: 'Mandate',
      targetId: mandate.id,
      before: {
        documentVersion: mandate.documentVersion,
        documentReviewStatus: mandate.documentReviewStatus,
      },
      after: {
        documentVersion: nextVersion,
        documentReviewStatus: MandateDocumentReviewStatus.PENDING,
      },
    });

    await this.events.emit(DOMAIN_EVENTS.MANDATE_DOCUMENT_DEPOSITED, {
      mandateId: updated.id,
      propertyId: updated.propertyId,
      organizationId: updated.organizationId,
      documentVersion: nextVersion,
    });

    return {
      id: updated.id,
      documentVersion: updated.documentVersion,
      documentReviewStatus: updated.documentReviewStatus,
      signedDocumentKey: updated.signedDocumentKey,
    };
  }

  async decide(input: {
    mandateId: string;
    adminUserId: string;
    decision: MandateDocumentReviewStatus;
    reason: string;
  }) {
    if (!DECIDABLE.includes(input.decision)) {
      throw new BadRequestException({
        code: 'INVALID_REVIEW_DECISION',
        message: 'Decision must be APPROVED, NEEDS_CORRECTION or REJECTED',
      });
    }
    const reason = input.reason?.trim();
    if (!reason) {
      throw new BadRequestException({
        code: 'REVIEW_REASON_REQUIRED',
        message: 'A reason is required for every document review decision',
      });
    }

    const mandate = await this.prisma.mandate.findUnique({
      where: { id: input.mandateId },
      select: {
        id: true,
        propertyId: true,
        organizationId: true,
        documentReviewStatus: true,
        documentVersion: true,
        signedDocumentKey: true,
        status: true,
      },
    });
    if (!mandate) {
      throw new NotFoundException({
        code: 'MANDATE_NOT_FOUND',
        message: 'Mandate not found',
      });
    }
    if (
      mandate.documentReviewStatus === MandateDocumentReviewStatus.NOT_APPLICABLE
    ) {
      throw new BadRequestException({
        code: 'NOT_PAPER_MANDATE',
        message: 'This mandate has no paper document review queue',
      });
    }
    if (!mandate.signedDocumentKey) {
      throw new BadRequestException({
        code: 'DOCUMENT_MISSING',
        message: 'No paper document has been deposited for this mandate',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mandate.update({
        where: { id: mandate.id },
        data: {
          documentReviewStatus: input.decision,
          documentReviewReason: reason,
          documentReviewedAt: new Date(),
          documentReviewedById: input.adminUserId,
          ...(input.decision === MandateDocumentReviewStatus.APPROVED
            ? {
                status: MandateStatus.ACTIVE,
                acceptedAt: new Date(),
                acceptedById: input.adminUserId,
              }
            : {}),
          ...(input.decision === MandateDocumentReviewStatus.REJECTED
            ? { status: MandateStatus.DECLINED }
            : {}),
        },
      });

      await tx.mandateDocumentReviewDecision.create({
        data: {
          mandateId: mandate.id,
          decision: input.decision,
          reason,
          documentKey: mandate.signedDocumentKey,
          documentVersion: mandate.documentVersion,
          decidedById: input.adminUserId,
        },
      });

      if (input.decision === MandateDocumentReviewStatus.REJECTED) {
        await tx.property.update({
          where: { id: mandate.propertyId },
          data: { status: PropertyStatus.PAUSED },
        });
      }

      return row;
    });

    await this.audit.record({
      actorId: input.adminUserId,
      actorType: 'ADMIN',
      action: 'MANDATE_DOCUMENT_REVIEW',
      targetType: 'Mandate',
      targetId: mandate.id,
      before: { documentReviewStatus: mandate.documentReviewStatus },
      after: {
        documentReviewStatus: input.decision,
        reason,
      },
    });

    await this.events.emit(DOMAIN_EVENTS.MANDATE_DOCUMENT_REVIEWED, {
      mandateId: updated.id,
      propertyId: updated.propertyId,
      organizationId: updated.organizationId,
      decision: input.decision as
        | 'APPROVED'
        | 'NEEDS_CORRECTION'
        | 'REJECTED',
    });

    return updated;
  }
}
