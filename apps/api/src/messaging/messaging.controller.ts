import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MessagePayerType } from '@prisma/client';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingBillingService } from './messaging-billing.service';

export type PublicMessageCharge = {
  id: string;
  channel: string;
  recipientPhone: string;
  amountXaf: number;
  unitUsd: string;
  fxRate: string;
  billingMonth: string;
  occurredAt: string;
  status: string;
};

export type OrgMessagingBalance = {
  organizationId: string;
  openBalanceXaf: number;
  charges: PublicMessageCharge[];
};

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('messaging')
@UseGuards(AppAuthGuard)
export class MessagingController {
  constructor(
    private readonly messaging: MessagingBillingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('org/:organizationId/balance')
  @ApiOperation({
    summary: 'Open SMS messaging balance for an organization',
  })
  async orgBalance(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
  ): Promise<OrgMessagingBalance> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization does not exist',
      });
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: current.userId,
          organizationId,
        },
      },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'NOT_ORG_MEMBER',
        message: 'User is not a member of the target organization',
      });
    }

    const openBalanceXaf = await this.messaging.openBalanceXaf(
      MessagePayerType.ORGANIZATION,
      organizationId,
    );
    const rows = await this.messaging.listOpenCharges(
      MessagePayerType.ORGANIZATION,
      organizationId,
    );

    return {
      organizationId,
      openBalanceXaf,
      charges: rows.map((c) => ({
        id: c.id,
        channel: c.channel,
        recipientPhone: c.recipientPhone,
        amountXaf: c.amountXaf,
        unitUsd: c.unitUsd.toString(),
        fxRate: c.fxRate.toString(),
        billingMonth: c.billingMonth,
        occurredAt: c.occurredAt.toISOString(),
        status: c.status,
      })),
    };
  }
}
