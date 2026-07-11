import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReceiptService } from './receipt.service';

@ApiTags('Receipts')
@ApiBearerAuth()
@Controller()
export class ReceiptController {
  constructor(private readonly receipts: ReceiptService) {}

  @Get('receipts/:id')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Get a payment receipt' })
  async findOne(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const receipt = await this.receipts.findByIdForUser(id, current.userId);
    if (!receipt) {
      throw new NotFoundException({
        code: 'RECEIPT_NOT_FOUND',
        message: 'Receipt not found',
      });
    }
    return receipt;
  }

  @Get('payments/:paymentId/receipt')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Get the receipt for a validated payment' })
  async findByPayment(
    @CurrentUser() current: AuthenticatedUser,
    @Param('paymentId') paymentId: string,
  ) {
    const receipt = await this.receipts.findByPaymentIdForUser(
      paymentId,
      current.userId,
    );
    if (!receipt) {
      throw new NotFoundException({
        code: 'RECEIPT_NOT_FOUND',
        message: 'No receipt for this payment yet',
      });
    }
    return receipt;
  }
}
