import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../media/r2.service';

export interface ImportReconciliationInput {
  provider: string;
  csv: string;
  periodStart: Date;
  periodEnd: Date;
}

interface ParsedRow {
  providerRef: string;
  amount: Prisma.Decimal;
}

interface RunLine {
  providerRef: string | null;
  paymentId: string | null;
  kind: 'MISSING_IN_DB' | 'MISSING_AT_PROVIDER' | 'AMOUNT_MISMATCH';
  amountProvider: Prisma.Decimal | null;
  amountDb: Prisma.Decimal | null;
}

export interface ReconciliationRunPublic {
  id: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  summary: Record<string, unknown>;
  createdById: string;
  createdAt: string;
  lines: Array<{
    id: string;
    providerRef: string | null;
    paymentId: string | null;
    kind: string;
    amountProvider: string | null;
    amountDb: string | null;
    resolved: boolean;
  }>;
}

/**
 * Spec 05 P2 — rapprochement : import d'un relevé fournisseur (CSV
 * `providerRef,amount,date`), mise en regard des paiements de la base et
 * liste des écarts :
 * - `MISSING_IN_DB` : ligne fournisseur sans paiement correspondant ;
 * - `MISSING_AT_PROVIDER` : paiement de la période non présent au relevé ;
 * - `AMOUNT_MISMATCH` : même `providerRef`, montants différents.
 */
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  /** Public for direct invocation from tests. */
  parseCsv(csv: string): ParsedRow[] {
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_CSV',
        message: 'The statement file is empty',
      });
    }
    const first = lines[0].toLowerCase();
    if (first.startsWith('providerref') || first.startsWith('reference')) {
      lines.shift();
    }
    if (lines.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_CSV',
        message: 'The statement file has no data row',
      });
    }

    const rows: ParsedRow[] = [];
    lines.forEach((line, i) => {
      const [providerRef, amountRaw] = line.split(',').map((c) => c.trim());
      const amount = Number(amountRaw);
      if (!providerRef || !Number.isFinite(amount)) {
        throw new BadRequestException({
          code: 'INVALID_CSV',
          message: `Invalid row ${i + 1}: expected providerRef,amount,date`,
        });
      }
      rows.push({
        providerRef,
        amount: new Prisma.Decimal(amount),
      });
    });
    return rows;
  }

  async importRun(
    input: ImportReconciliationInput,
    createdById: string,
  ): Promise<ReconciliationRunPublic> {
    if (input.periodEnd < input.periodStart) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        message: 'periodEnd must be after periodStart',
      });
    }
    const rows = this.parseCsv(input.csv);

    const payments = await this.prisma.payment.findMany({
      where: { providerRef: { not: null } },
      select: {
        id: true,
        providerRef: true,
        amount: true,
        createdAt: true,
      },
      take: 10000,
    });
    const byRef = new Map(
      payments
        .filter((p) => p.providerRef !== null)
        .map((p) => [p.providerRef as string, p]),
    );

    const lines: RunLine[] = [];
    const matchedRefs = new Set<string>();
    let matched = 0;
    let missingInDb = 0;
    let amountMismatch = 0;

    for (const row of rows) {
      const payment = byRef.get(row.providerRef);
      if (!payment) {
        missingInDb += 1;
        lines.push({
          providerRef: row.providerRef,
          paymentId: null,
          kind: 'MISSING_IN_DB',
          amountProvider: row.amount,
          amountDb: null,
        });
        continue;
      }
      matchedRefs.add(row.providerRef);
      if (!payment.amount.eq(row.amount)) {
        amountMismatch += 1;
        lines.push({
          providerRef: row.providerRef,
          paymentId: payment.id,
          kind: 'AMOUNT_MISMATCH',
          amountProvider: row.amount,
          amountDb: payment.amount,
        });
      } else {
        matched += 1;
      }
    }

    let missingAtProvider = 0;
    for (const payment of payments) {
      if (!payment.providerRef || matchedRefs.has(payment.providerRef)) {
        continue;
      }
      if (
        payment.createdAt < input.periodStart ||
        payment.createdAt > input.periodEnd
      ) {
        continue;
      }
      missingAtProvider += 1;
      lines.push({
        providerRef: payment.providerRef,
        paymentId: payment.id,
        kind: 'MISSING_AT_PROVIDER',
        amountProvider: null,
        amountDb: payment.amount,
      });
    }

    const summary = {
      provider: input.provider,
      rows: rows.length,
      matched,
      missingInDb,
      missingAtProvider,
      amountMismatch,
      periodStart: input.periodStart.toISOString(),
      periodEnd: input.periodEnd.toISOString(),
    };

    let fileKey = `inline/${randomUUID()}`;
    try {
      const uploaded = await this.r2.uploadPrivateFile({
        folder: 'reconciliation',
        ownerId: createdById,
        filename: `releve-${input.provider.toLowerCase()}.csv`,
        contentType: 'text/csv',
        body: Buffer.from(input.csv, 'utf8'),
      });
      fileKey = uploaded.key;
    } catch {
      // R2 indisponible en local : la clé inline permet au moins de tracer
      // que le fichier n'est pas archivé.
    }

    const run = await this.prisma.reconciliationRun.create({
      data: {
        provider: input.provider,
        fileKey,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        summary: summary as Prisma.InputJsonValue,
        createdById,
      },
    });
    if (lines.length > 0) {
      await this.prisma.reconciliationLine.createMany({
        data: lines.map((l) => ({
          runId: run.id,
          providerRef: l.providerRef,
          paymentId: l.paymentId,
          kind: l.kind,
          amountProvider: l.amountProvider,
          amountDb: l.amountDb,
          resolved: false,
        })),
      });
    }

    return this.toPublic(run, lines);
  }

  async getRun(id: string): Promise<ReconciliationRunPublic> {
    const run = await this.prisma.reconciliationRun.findUnique({
      where: { id },
      include: { lines: { orderBy: { kind: 'asc' }, take: 1000 } },
    });
    if (!run) {
      throw new NotFoundException({
        code: 'RECONCILIATION_RUN_NOT_FOUND',
        message: 'Reconciliation run not found',
      });
    }
    return this.toPublic(run, run.lines);
  }

  private toPublic(
    run: {
      id: string;
      provider: string;
      periodStart: Date;
      periodEnd: Date;
      summary: Prisma.JsonValue;
      createdById: string;
      createdAt: Date;
    },
    lines: Array<{
      id?: string;
      providerRef: string | null;
      paymentId: string | null;
      kind: string;
      amountProvider: Prisma.Decimal | null;
      amountDb: Prisma.Decimal | null;
      resolved?: boolean;
    }>,
  ): ReconciliationRunPublic {
    return {
      id: run.id,
      provider: run.provider,
      periodStart: run.periodStart.toISOString(),
      periodEnd: run.periodEnd.toISOString(),
      summary: (run.summary ?? {}) as Record<string, unknown>,
      createdById: run.createdById,
      createdAt: run.createdAt.toISOString(),
      lines: lines.map((l, i) => ({
        id: l.id ?? `tmp-${i}`,
        providerRef: l.providerRef,
        paymentId: l.paymentId,
        kind: l.kind,
        amountProvider: l.amountProvider?.toString() ?? null,
        amountDb: l.amountDb?.toString() ?? null,
        resolved: l.resolved ?? false,
      })),
    };
  }
}
