import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RentReceiptService } from './rent-receipt.service';

@ApiTags('Rent receipts')
@ApiBearerAuth()
@Controller()
@UseGuards(AppAuthGuard)
export class RentReceiptsController {
  constructor(
    private readonly receipts: RentReceiptService,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

  @Get('leases/my/quittances')
  @ApiOperation({ summary: "List the authenticated tenant's rent receipts" })
  async listMine(@CurrentUser() current: AuthenticatedUser) {
    const rows = await this.receipts.listForUser(current.userId);
    return rows.map((receipt) => ({
      id: receipt.id,
      number: receipt.number,
      rentScheduleId: receipt.rentScheduleId,
      issuerOrgId: receipt.issuerOrgId,
      issuedAt: receipt.issuedAt,
    }));
  }

  @Get('rent-schedules/:id/quittance')
  @ApiOperation({ summary: 'Get a signed download URL for a rent receipt' })
  async getDownload(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') rentScheduleId: string,
  ) {
    await this.receipts.assertCanReadSchedule(
      current.userId,
      rentScheduleId,
      (userId, propertyId) =>
        this.agencyAccess.assertCanOperateOnProperty(userId, propertyId),
    );
    return {
      url: await this.receipts.getUrlForSchedule(rentScheduleId),
    };
  }
}
