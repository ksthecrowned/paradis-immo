import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
// Namespace import keeps the value at runtime (needed by emitDecoratorMetadata)
// while letting `Request` be used purely as a type in the decorated signature.
import type { Request as ExpressRequest, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

class PaymentTargetDto {
  @IsIn(['RENT_SCHEDULE', 'SALE_INSTALLMENT', 'BOOKING', 'VISIT_BOOKING'])
  type!: 'RENT_SCHEDULE' | 'SALE_INSTALLMENT' | 'BOOKING' | 'VISIT_BOOKING';

  @IsString()
  id!: string;
}

class InitiatePaymentDto {
  /** Spec 05 — cible { type, id } ; les champs plats restent acceptés (mobile). */
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentTargetDto)
  target?: PaymentTargetDto;

  /** Optionnel : avec une cible le montant est calculé côté serveur. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;
  @IsIn(['CASH', 'MOBILE_MONEY']) method!: 'CASH' | 'MOBILE_MONEY';
  @IsOptional() @IsIn(['AIRTEL', 'MOMO']) provider?: 'AIRTEL' | 'MOMO';
  @IsOptional() @IsString() phone?: string;
  @IsString() idempotencyKey!: string;
  @IsOptional() @IsString() rentScheduleId?: string;
  @IsOptional() @IsString() saleInstallmentId?: string;
  @IsOptional() @IsString() visitBookingId?: string;
}

class QuoteQueryDto {
  @IsIn(['RENT_SCHEDULE', 'SALE_INSTALLMENT', 'BOOKING', 'VISIT_BOOKING'])
  targetType!: 'RENT_SCHEDULE' | 'SALE_INSTALLMENT' | 'BOOKING' | 'VISIT_BOOKING';

  @IsString()
  targetId!: string;
}

class RecordCashPaymentDto {
  @ValidateIf((o: RecordCashPaymentDto) => !o.saleInstallmentId)
  @IsString()
  rentScheduleId?: string;

  @ValidateIf((o: RecordCashPaymentDto) => !o.rentScheduleId)
  @IsString()
  saleInstallmentId?: string;

  @IsString() idempotencyKey!: string;
  @IsOptional() @Type(() => Number) @IsNumber() amount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() note?: string;
}

class AllocationDto {
  @IsIn(['RENT_SCHEDULE', 'BOOKING', 'VISIT_BOOKING', 'SALE_INSTALLMENT'])
  type!: 'RENT_SCHEDULE' | 'BOOKING' | 'VISIT_BOOKING' | 'SALE_INSTALLMENT';
  @IsString() refId!: string;
  @Type(() => Number) @IsNumber() amount!: number;
  @IsOptional() @IsString() rentScheduleId?: string;
}

class CreateRefundDto {
  /** Optionnel : défaut = solde restant (payé − déjà remboursé). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsString() reason!: string;
  @IsIn(['PROVIDER', 'CASH']) method!: 'PROVIDER' | 'CASH';
  @IsOptional() @IsString() proofKey?: string;
}

class DecideRefundDto {
  @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT';
  @IsOptional() @IsString() comment?: string;
}

class OpenDisputeDto {
  @IsIn(['NOT_CREDITED', 'DUPLICATE', 'WRONG_AMOUNT', 'OTHER'])
  reason!: 'NOT_CREDITED' | 'DUPLICATE' | 'WRONG_AMOUNT' | 'OTHER';

  @IsString() description!: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceKeys?: string[];
}

class ResolveDisputeDto {
  @IsIn(['AWAITING_MANAGER', 'RESOLVED_ACCEPTED', 'RESOLVED_REJECTED'])
  status!: 'AWAITING_MANAGER' | 'RESOLVED_ACCEPTED' | 'RESOLVED_REJECTED';

  @IsOptional() @IsString() resolution?: string;
}

class ValidatePaymentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations!: AllocationDto[];
}

/** Spec 05 — client IP behind a proxy (first entry of x-forwarded-for). */
function clientIp(headers: Record<string, string>): string | undefined {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return headers['x-real-ip'];
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

  @Post('payments/record-cash')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Record a cash rent payment on behalf of a tenant (create + validate)',
  })
  recordCash(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: RecordCashPaymentDto,
  ) {
    return this.payments.recordCashPayment(current.userId, dto);
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
  myPayments(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.payments.listMyPayments(current.userId, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      status: query.status,
      method: query.method,
      from: query.from,
      to: query.to,
    });
  }

  @Get('payments/pending-validation')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'List cash payments awaiting validation on managed properties',
  })
  pendingValidation(@CurrentUser() current: AuthenticatedUser) {
    return this.payments.listPendingValidation(current.userId);
  }

  @Get('payments/managed')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List payments on managed properties' })
  managed(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.payments.listManagedPayments({
      userId: current.userId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      status: query.status,
      method: query.method,
      propertyId: query.propertyId,
      from: query.from,
      to: query.to,
    });
  }

  @Get('payments/managed/export.csv')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export CSV des paiements du portefeuille géré' })
  async managedExportCsv(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: ListPaymentsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.payments.exportManagedCsv(current.userId, {
      status: query.status,
      method: query.method,
      propertyId: query.propertyId,
      from: query.from,
      to: query.to,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="paiements.csv"',
    );
    return csv;
  }

  @Get('payments/quote')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Quote a target: amount due, partial allowed, partial minimum',
  })
  quote(@CurrentUser() current: AuthenticatedUser, @Query() query: QuoteQueryDto) {
    return this.payments.quote(current.userId, query.targetType, query.targetId);
  }

  @Get('payments/:id/status')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Payment status — polls the provider when still INITIATED',
  })
  status(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.payments.getPaymentStatus(current.userId, id);
  }

  @Post('payments/:id/cancel')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an INITIATED payment (payer only)' })
  cancel(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.payments.cancelPayment(current.userId, id);
  }

  /** Spec 05 P1 — le payeur conteste un paiement (30 jours). */
  @Post('payments/:id/disputes')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open a dispute on a payment (payer, 30 days)' })
  openDispute(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: OpenDisputeDto,
  ) {
    return this.payments.openDispute(current.userId, id, dto);
  }

  /** Spec 05 P1 — gestionnaire / admin : rembourser (partiel ou total). */
  @Post('payments/:id/refunds')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refund a payment (manager or platform admin)' })
  createRefund(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateRefundDto,
  ) {
    return this.payments.createRefund(current.userId, id, dto);
  }

  @Get('disputes/managed')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Litiges du périmètre (admin : tous)' })
  managedDisputes(@CurrentUser() current: AuthenticatedUser) {
    return this.payments.listManagedDisputes(current.userId);
  }

  @Patch('disputes/:id')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Answer / resolve a dispute (manager or admin)' })
  resolveDispute(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.payments.resolveDispute(current.userId, id, dto);
  }

  @Patch('refunds/:id')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve or reject a refund above the threshold' })
  decideRefund(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecideRefundDto,
  ) {
    return this.payments.decideRefund(current.userId, id, dto);
  }

  @Get('payments/:id')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a payment by id' })
  getOne(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.payments.getOne(current.userId, id);
  }

  @Get('payments/:id/timeline')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Timeline du paiement : événements, remboursements, litiges',
  })
  timeline(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.payments.getTimeline(current.userId, id);
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

  /** Spec 05 P0 — adaptateur Airtel (signature + allowlist IP propres). */
  @Post('payments/webhooks/airtel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Airtel Money webhook adapter' })
  airtelWebhook(
    // @ts-expect-error TS1272 — see webhook() above.
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers() headers: Record<string, string>,
  ) {
    const raw = (req.rawBody ?? '').toString();
    const signature = headers['x-airtel-signature'] ?? headers['x-mobile-money-signature'];
    return this.payments.handleProviderWebhook(
      'AIRTEL',
      raw,
      signature,
      clientIp(headers),
    );
  }

  /** Spec 05 P0 — adaptateur MTN MoMo (signature + allowlist IP propres). */
  @Post('payments/webhooks/momo')
  @HttpCode(200)
  @ApiOperation({ summary: 'MTN MoMo Collection webhook adapter' })
  momoWebhook(
    // @ts-expect-error TS1272 — see webhook() above.
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers() headers: Record<string, string>,
  ) {
    const raw = (req.rawBody ?? '').toString();
    const signature = headers['x-momo-signature'] ?? headers['x-mobile-money-signature'];
    return this.payments.handleProviderWebhook(
      'MOMO',
      raw,
      signature,
      clientIp(headers),
    );
  }
}
