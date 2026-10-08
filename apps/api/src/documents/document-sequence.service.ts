import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Kinds stored in `DocumentSequence`. */
export type DocumentSequenceKind = 'QUITTANCE' | 'RECEIPT';

/**
 * Spec 04 — sequential document numbering, per issuing organization and year:
 *
 * - rent receipts (quittances): `Q-{ORG}-{AAAA}-{000001}`
 * - payment receipts:          `R-{ORG}-{AAAA}-{000001}`
 *
 * The counter lives in `DocumentSequence` and is incremented with a single
 * atomic `upsert ... increment`, so two concurrent issuances can never get
 * the same number and the yearly sequence stays strictly consecutive.
 */
@Injectable()
export class DocumentSequenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reserve the next number for `organizationId`. Must run inside the same
   * transaction that persists the document row, so a reservation is never
   * lost on rollback and never duplicated on retry.
   */
  async nextNumber(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      kind: DocumentSequenceKind;
      prefix: 'Q' | 'R';
      at?: Date;
    },
  ): Promise<string> {
    const at = input.at ?? new Date();
    const year = at.getUTCFullYear();
    const row = await tx.documentSequence.upsert({
      where: {
        organizationId_kind_year: {
          organizationId: input.organizationId,
          kind: input.kind,
          year,
        },
      },
      create: {
        organizationId: input.organizationId,
        kind: input.kind,
        year,
        last: 1,
      },
      update: { last: { increment: 1 } },
    });
    return `${input.prefix}-${input.organizationId.slice(0, 6).toUpperCase()}-${year}-${String(
      row.last,
    ).padStart(6, '0')}`;
  }

  /** Read the current counter without consuming a number (diagnostics/tests). */
  async peek(
    organizationId: string,
    kind: DocumentSequenceKind,
    year = new Date().getUTCFullYear(),
  ): Promise<number> {
    const row = await this.prisma.documentSequence.findUnique({
      where: {
        organizationId_kind_year: { organizationId, kind, year },
      },
    });
    return row?.last ?? 0;
  }
}