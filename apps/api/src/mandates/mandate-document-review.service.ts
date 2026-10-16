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
import { PrismaService } from '../prisma/prisma.service';

const DECIDABLE: MandateDocumentReviewStatus[] = [
  MandateDocumentReviewStatus.APPROVED,
  MandateDocumentReviewStatus.NEEDS_CORRECTION,
  MandateDocumentReviewStatus.REJECTED,
];

@Injectable()
export class MandateDocumentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mandate.update({
        where: { id: mandate.id },
        data: {
          documentReviewStatus: input.decision,
          documentReviewReason: reason,
          documentReviewedAt: new Date(),
          documentReviewedById: input.adminUserId,
          ...(input.decision === MandateDocumentReviewStatus.APPROVED
            ? { status: MandateStatus.ACTIVE, acceptedAt: new Date(), acceptedById: input.adminUserId }
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

    return updated;
  }
}
