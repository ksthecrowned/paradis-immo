import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RespondBuyerPaymentProofDto } from './dto/respond-buyer-payment-proof.dto';
import { BuyerPaymentProofsService } from './buyer-payment-proofs.service';

@ApiTags('Buyer payment proofs')
@ApiBearerAuth()
@Controller('sale-agreements/:id/payment-proofs')
@UseGuards(AppAuthGuard)
export class SaleAgreementPaymentProofsController {
  constructor(private readonly proofs: BuyerPaymentProofsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Request buyer payment proof for a sale agreement' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.proofs.create(current.userId, id);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Latest payment proof for this sale agreement' })
  latest(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.proofs.latestForAgreement(current.userId, id);
  }

  @Get('eligibility')
  @ApiOperation({
    summary: 'Whether the manager can request a payment proof',
  })
  eligibility(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.proofs.eligibility(current.userId, id);
  }
}

@ApiTags('Buyer payment proofs')
@ApiBearerAuth()
@Controller('me/buyer-payment-proofs')
@UseGuards(AppAuthGuard)
export class MeBuyerPaymentProofsController {
  constructor(private readonly proofs: BuyerPaymentProofsService) {}

  @Get()
  @ApiOperation({ summary: 'List payment proof requests for current buyer' })
  list(@CurrentUser() current: AuthenticatedUser) {
    return this.proofs.listForBuyer(current.userId);
  }

  @Post(':id/respond')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept or deny a payment proof request' })
  respond(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RespondBuyerPaymentProofDto,
  ) {
    return this.proofs.respond(current.userId, id, dto.accept);
  }
}
