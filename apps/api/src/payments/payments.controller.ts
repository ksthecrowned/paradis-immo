import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
// Namespace import keeps the value at runtime (needed by emitDecoratorMetadata)
// while letting `Request` be used purely as a type in the decorated signature.
import type { Request as ExpressRequest } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

class InitiatePaymentDto {
  @Type(() => Number) @IsNumber() amount!: number;
  @IsString() currency!: string;
  @IsIn(['CASH', 'MOBILE_MONEY']) method!: 'CASH' | 'MOBILE_MONEY';
  @IsOptional() @IsIn(['AIRTEL', 'MOMO']) provider?: 'AIRTEL' | 'MOMO';
  @IsOptional() @IsString() phone?: string;
  @IsString() idempotencyKey!: string;
}

class AllocationDto {
  @IsIn(['RENT_SCHEDULE', 'BOOKING', 'VISIT_BOOKING'])
  type!: 'RENT_SCHEDULE' | 'BOOKING' | 'VISIT_BOOKING';
  @IsString() refId!: string;
  @Type(() => Number) @IsNumber() amount!: number;
  @IsOptional() @IsString() rentScheduleId?: string;
}

class ValidatePaymentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations!: AllocationDto[];
}

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('payments')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a payment (cash or mobile money)' })
  initiate(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.payments.initiatePayment({ ...dto, userId: current.userId });
  }

  @Post('payments/:id/validate')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate a cash payment' })
  validate(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ValidatePaymentDto,
  ) {
    return this.payments.validateCashPayment(
      current.userId,
      id,
      dto.allocations,
    );
  }

  @Get('payments/my')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the user's own payments" })
  myPayments(@CurrentUser() current: AuthenticatedUser) {
    return this.payments.listMyPayments(current.userId);
  }

  @Get('payments/pending-validation')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List cash payments awaiting agent validation',
  })
  pendingValidation() {
    return this.payments.listPendingValidation();
  }

  @Get('payments/managed')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List payments on managed properties' })
  managed(@CurrentUser() current: AuthenticatedUser) {
    return this.payments.listManaged(current.userId);
  }

  @Post('payments/webhooks/mobile-money')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mobile money provider webhook' })
  webhook(
    // @ts-expect-error TS1272 — namespaced types in decorated signatures are
    // not supported under nodenext + isolatedModules + emitDecoratorMetadata.
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('x-mobile-money-signature') signature: string,
  ) {
    const raw = (req.rawBody ?? '').toString();
    return this.payments.handleMobileMoneyWebhook(raw, signature);
  }
}
