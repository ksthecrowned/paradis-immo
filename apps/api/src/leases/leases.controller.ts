import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LeasesService } from './leases.service';
import { ArrearsService } from './arrears.service';
import { ArrearsQueryDto, SendReminderDto } from './dto/arrears.dto';
import { EnforcementService } from './enforcement.service';
import { FormalNoticeDto } from './dto/formal-notice.dto';
import { AmendmentsService } from './amendments.service';
import { IndexationService } from './indexation.service';
import { CreateAmendmentDto } from './dto/create-amendment.dto';
import { SignLeaseDto } from './dto/sign-lease.dto';
import { RenewLeaseDto } from './dto/renew-lease.dto';
import { ListLeasesDto } from './dto/list-leases.dto';
import { CreateLeaseDto, UpdateLeaseDto } from './dto/create-lease.dto';
import {
  TerminateLeaseDto,
  WithdrawTerminationDto,
} from './dto/terminate-lease.dto';

@ApiTags('Leases')
@ApiBearerAuth()
@Controller('leases')
@UseGuards(AppAuthGuard)
export class LeasesController {
  constructor(
    private readonly leases: LeasesService,
    private readonly arrears: ArrearsService,
    private readonly enforcement: EnforcementService,
    private readonly amendments: AmendmentsService,
    private readonly indexation: IndexationService,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a draft lease' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateLeaseDto,
  ) {
    return this.leases.createLease(current.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a draft lease' })
  update(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeaseDto,
  ) {
    return this.leases.updateLease(current.userId, id, dto);
  }

  @Get('managed')
  @UseGuards(AppAuthGuard)
  @ApiOperation({
    summary: 'List leases on properties the user owns or manages',
  })
  managed(
    @CurrentUser() current: AuthenticatedUser,
    @Query() filter: ListLeasesDto,
  ) {
    return this.leases.listManaged(current.userId, filter);
  }

  @Get('my')
  @ApiOperation({ summary: "List the authenticated tenant's leases" })
  my(@CurrentUser() current: AuthenticatedUser) {
    return this.leases.listMyLeases(current.userId);
  }

  // Declared before `:id` so the literal paths win over the lease id route.
  @Get('arrears/summary')
  @ApiOperation({ summary: 'Totals per arrears bucket across the portfolio' })
  arrearsSummary(@CurrentUser() current: AuthenticatedUser) {
    return this.arrears.summary(current.userId);
  }

  @Get('arrears')
  @ApiOperation({
    summary: 'Unpaid rent per lease, bucketed by age (0-30 / 31-60 / 60+)',
  })
  arrearsList(
    @CurrentUser() current: AuthenticatedUser,
    @Query() filter: ArrearsQueryDto,
  ) {
    return this.arrears.listArrears(current.userId, filter);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Balance, overdue amount and lines of a lease' })
  balance(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.arrears.getBalance(current.userId, id);
  }

  @Post(':id/reminders')
  @HttpCode(201)
  @ApiOperation({ summary: 'Send a manual dunning message to the tenant' })
  remind(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendReminderDto,
  ) {
    return this.arrears.sendReminder(current.userId, id, dto);
  }

  @Post(':id/formal-notice')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Generate the PDF formal notice (mise en demeure, 15+ days late)',
  })
  formalNotice(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: FormalNoticeDto,
  ) {
    return this.enforcement.sendFormalNotice(current.userId, id, dto);
  }

  @Get(':id/indexations')
  @ApiOperation({ summary: 'List the annual rent revision proposals of a lease' })
  listIndexations(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.indexation.listForLease(current.userId, id);
  }

  @Get(':id/amendments')
  @ApiOperation({ summary: 'List the versioned amendments of a lease' })
  listAmendments(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.amendments.list(current.userId, id);
  }

  @Post(':id/amendments')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create the next amendment version (manager)' })
  createAmendment(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateAmendmentDto,
  ) {
    return this.amendments.create(current.userId, id, dto);
  }

  @Post(':id/amendments/:version/sign')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Sign an amendment by OTP — omit `otpCode` to receive the code',
  })
  signAmendment(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Param('version') version: string,
    @Body() dto: SignLeaseDto,
  ) {
    return this.amendments.sign(
      current.userId,
      id,
      Number(version),
      dto,
    );
  }

  @Get(':id/co-tenants')
  @ApiOperation({ summary: 'List the co-tenants of a lease (colocation)' })
  listCoTenants(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leases.listCoTenants(current.userId, id);
  }

  @Post(':id/renew')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Renew the lease: new term, optional new rent (spec 04 US 11)',
  })
  renewLease(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RenewLeaseDto,
  ) {
    return this.leases.renewLease(current.userId, id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lease by id (manager or tenant)' })
  getOne(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leases.getOne(current.userId, id);
  }

  @Post(':id/request-sign')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Request owner LEASE_SIGN approval (mandated properties)',
  })
  requestSign(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leases.requestLeaseSign(current.userId, id);
  }

  @Post(':id/send-for-signature')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Send a draft lease for signature (invites the tenant)',
  })
  sendForSignature(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leases.sendForSignature(current.userId, id);
  }

  @Post(':id/sign')
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Sign the lease with an OTP — omit `otpCode` to receive the WhatsApp code',
  })
  sign(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SignLeaseDto,
  ) {
    return this.leases.signLease(current.userId, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(201)
  @ApiOperation({ summary: 'Cancel a DRAFT or PENDING_SIGNATURE lease' })
  cancel(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leases.cancelLease(current.userId, id);
  }

  @Post(':id/termination')
  @HttpCode(201)
  @ApiOperation({ summary: 'Give notice (conge) on an active lease' })
  terminate(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TerminateLeaseDto,
  ) {
    return this.leases.requestTermination(current.userId, id, dto);
  }

  @Delete(':id/termination')
  @ApiOperation({ summary: 'Withdraw a notice during the notice period' })
  withdrawTermination(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: WithdrawTerminationDto,
  ) {
    return this.leases.withdrawTermination(current.userId, id);
  }

  @Post(':id/close')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Close the lease (TERMINATED) and release the property',
  })
  close(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.leases.closeLease(current.userId, id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a draft lease (generates rent schedule)' })
  activate(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.leases.activateLease(current.userId, id);
  }

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Get the rent schedule for a lease' })
  schedule(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leases.getSchedule(current.userId, id);
  }
}
