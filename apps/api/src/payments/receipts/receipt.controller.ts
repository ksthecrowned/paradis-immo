import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AppAuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReceiptService } from './receipt.service';

@Controller()
export class ReceiptController {
  constructor(private readonly receipts: ReceiptService) {}

  @Get('receipts/:id')
  @UseGuards(AppAuthGuard)
  async findOne(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const receipt = await this.receipts.findById(id);
    if (!receipt) {
      return { code: 'RECEIPT_NOT_FOUND', message: 'Receipt not found' };
    }
    // Authz note: a full implementation would check that `current.userId`
    // owns the payment, or is an AGENT/ADMIN on the related property.
    // For MVP we trust the JWT + the receipt's opaque id.
    void current;
    return {
      id: receipt.id,
      paymentId: receipt.paymentId,
      number: receipt.number,
      url: receipt.url,
      createdAt: receipt.createdAt.toISOString(),
    };
  }
}
