import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../media/r2.service';

const EXPORT_TTL_DAYS = 7;
const EXPORT_URL_TTL_SECONDS = 15 * 60;

export interface DataExportStatus {
  id: string;
  status: string;
  expiresAt: string | null;
  url: string | null;
  createdAt: string;
}

/**
 * Builds and stores a full personal-data export (spec 01 — P2).
 *
 * The payload is generated synchronously (the MVP dataset is small enough) and
 * uploaded to private R2 storage; the client polls the status endpoint and
 * receives a short-lived signed URL once ready.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async request(userId: string): Promise<DataExportStatus> {
    const job = await this.prisma.dataExportRequest.create({
      data: { userId, status: 'PENDING' },
    });

    try {
      const payload = await this.buildPayload(userId);
      const body = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
      const { key } = await this.r2.uploadPrivateFile({
        folder: 'exports',
        ownerId: userId,
        filename: `paradis-immo-export-${job.id}.json`,
        contentType: 'application/json',
        body,
      });
      const expiresAt = new Date(
        Date.now() + EXPORT_TTL_DAYS * 24 * 60 * 60 * 1000,
      );
      const updated = await this.prisma.dataExportRequest.update({
        where: { id: job.id },
        data: { status: 'READY', fileKey: key, expiresAt },
      });
      return this.toStatus(updated);
    } catch (err) {
      this.logger.error(
        `Data export ${job.id} failed for user ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      const failed = await this.prisma.dataExportRequest.update({
        where: { id: job.id },
        data: { status: 'FAILED' },
      });
      return this.toStatus(failed);
    }
  }

  async get(userId: string, id: string): Promise<DataExportStatus> {
    const job = await this.prisma.dataExportRequest.findFirst({
      where: { id, userId },
    });
    if (!job) {
      throw new NotFoundException({
        code: 'EXPORT_NOT_FOUND',
        message: 'Demande d’export introuvable.',
      });
    }
    if (
      job.status !== 'READY' ||
      !job.fileKey ||
      (job.expiresAt && job.expiresAt < new Date())
    ) {
      return this.toStatus(job);
    }
    const url = await this.r2.createPresignedDownload(
      job.fileKey,
      EXPORT_URL_TTL_SECONDS,
    );
    return { ...this.toStatus(job), url };
  }

  /** Everything we hold about the user, in a portable JSON document. */
  private async buildPayload(userId: string) {
    const [user, orgs, leases, bookings, payments, notifications, favorites] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            phone: true,
            email: true,
            name: true,
            status: true,
            kycStatus: true,
            notificationChannel: true,
            termsVersion: true,
            termsAcceptedAt: true,
            marketingOptIn: true,
            createdAt: true,
            roles: { select: { role: true } },
          },
        }),
        this.prisma.organizationMember.findMany({
          where: { userId },
          select: {
            role: true,
            organization: { select: { id: true, name: true, type: true } },
          },
        }),
        this.prisma.lease.findMany({
          where: { tenantId: userId },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            monthlyRent: true,
            currency: true,
            status: true,
          },
        }),
        this.prisma.booking.findMany({
          where: { userId },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            totalPrice: true,
            currency: true,
            status: true,
          },
        }),
        this.prisma.payment.findMany({
          where: { userId },
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            status: true,
            reference: true,
            createdAt: true,
          },
        }),
        this.prisma.notification.findMany({
          where: { userId },
          select: { id: true, type: true, channel: true, createdAt: true },
        }),
        this.prisma.favorite.findMany({
          where: { userId },
          select: { propertyId: true, createdAt: true },
        }),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      profile: user,
      organizations: orgs.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        type: m.organization.type,
        memberRole: m.role,
      })),
      leases,
      bookings,
      payments,
      notifications,
      favorites,
    };
  }

  private toStatus(job: {
    id: string;
    status: string;
    expiresAt: Date | null;
    createdAt: Date;
  }): DataExportStatus {
    return {
      id: job.id,
      status: job.status,
      expiresAt: job.expiresAt ? job.expiresAt.toISOString() : null,
      url: null,
      createdAt: job.createdAt.toISOString(),
    };
  }
}
