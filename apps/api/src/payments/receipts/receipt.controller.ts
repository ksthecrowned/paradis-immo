import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
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
    try {
      return await this.receipts.findByIdForUser(id, current.userId);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new NotFoundException({
          code: 'RECEIPT_NOT_FOUND',
          message: 'Receipt not found',
        });
      }
      throw err;
    }
  }
}
