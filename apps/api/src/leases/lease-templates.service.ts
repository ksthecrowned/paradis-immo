import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import type {
  CreateLeaseTemplateDto,
  UpdateLeaseTemplateDto,
} from './dto/lease-template.dto';

export interface PublicLeaseTemplate {
  id: string;
  organizationId: string;
  name: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
}

/**
 * Spec 04 P2 — modèles de bail.
 *
 * An agency keeps reusable contract bodies. Exactly one template can be the
 * default: setting a new one clears the flag on the others, so the lease
 * creation screen always has a single pre-selected model.
 */
@Injectable()
export class LeaseTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

  async list(
    userId: string,
    organizationId: string,
  ): Promise<PublicLeaseTemplate[]> {
    await this.agencyAccess.assertIsAgencyGerant(userId, organizationId);
    const rows = await this.prisma.leaseTemplate.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toPublic(row));
  }

  async create(
    userId: string,
    organizationId: string,
    dto: CreateLeaseTemplateDto,
  ): Promise<PublicLeaseTemplate> {
    await this.agencyAccess.assertIsAgencyGerant(userId, organizationId);
    const existing = await this.prisma.leaseTemplate.findFirst({
      where: { organizationId, name: dto.name },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'LEASE_TEMPLATE_NAME_TAKEN',
        message: 'A template with this name already exists in the agency',
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.leaseTemplate.updateMany({
          where: { organizationId },
          data: { isDefault: false },
        });
      }
      return tx.leaseTemplate.create({
        data: {
          organizationId,
          name: dto.name,
          body: dto.body,
          isDefault: dto.isDefault ?? false,
        },
      });
    });
    return this.toPublic(created);
  }

  async update(
    userId: string,
    organizationId: string,
    templateId: string,
    dto: UpdateLeaseTemplateDto,
  ): Promise<PublicLeaseTemplate> {
    await this.agencyAccess.assertIsAgencyGerant(userId, organizationId);
    const template = await this.requireTemplate(organizationId, templateId);

    if (
      dto.name &&
      dto.name !== template.name &&
      (await this.prisma.leaseTemplate.findFirst({
        where: { organizationId, name: dto.name, id: { not: template.id } },
        select: { id: true },
      }))
    ) {
      throw new ConflictException({
        code: 'LEASE_TEMPLATE_NAME_TAKEN',
        message: 'A template with this name already exists in the agency',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.leaseTemplate.updateMany({
          where: { organizationId, id: { not: template.id } },
          data: { isDefault: false },
        });
      }
      return tx.leaseTemplate.update({
        where: { id: template.id },
        data: {
          name: dto.name ?? template.name,
          body: dto.body ?? template.body,
          isDefault: dto.isDefault ?? template.isDefault,
        },
      });
    });
    return this.toPublic(updated);
  }

  async remove(
    userId: string,
    organizationId: string,
    templateId: string,
  ): Promise<void> {
    await this.agencyAccess.assertIsAgencyGerant(userId, organizationId);
    const template = await this.requireTemplate(organizationId, templateId);
    await this.prisma.leaseTemplate.delete({ where: { id: template.id } });
  }

  private async requireTemplate(organizationId: string, templateId: string) {
    const template = await this.prisma.leaseTemplate.findFirst({
      where: { id: templateId, organizationId },
    });
    if (!template) {
      throw new NotFoundException({
        code: 'LEASE_TEMPLATE_NOT_FOUND',
        message: 'Lease template does not exist in this organization',
      });
    }
    return template;
  }

  private toPublic(row: {
    id: string;
    organizationId: string;
    name: string;
    body: string;
    isDefault: boolean;
    createdAt: Date;
  }): PublicLeaseTemplate {
    return {
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      body: row.body,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
    };
  }
}