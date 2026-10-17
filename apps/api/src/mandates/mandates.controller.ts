import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MandateScope, MandateStatus } from '@prisma/client';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { MandatesService } from './mandates.service';
import { MandateApprovalService } from './mandate-approval.service';
import { MandateDocumentReviewService } from './mandate-document-review.service';
import { CreateMandateDto } from './dto/create-mandate.dto';
import {
  DeclineMandateDto,
  TerminateMandateDto,
} from './dto/terminate-mandate.dto';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { DecideApprovalDto } from './dto/decide-approval.dto';
import { CounterMandateDto, SignMandateDto } from './dto/mandate-flow.dto';
import { AssignMandateDto } from './dto/assign-mandate.dto';

class ListManagedQueryDto {
  @IsOptional() @IsEnum(MandateStatus) status?: MandateStatus;
  @IsOptional() @IsEnum(MandateScope) scope?: MandateScope;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

class PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

@ApiTags('Mandates')
@ApiBearerAuth()
@Controller('mandates')
@UseGuards(AppAuthGuard)
export class MandatesController {
  constructor(
    private readonly mandates: MandatesService,
    private readonly approvals: MandateApprovalService,
    private readonly documentReview: MandateDocumentReviewService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Propose a mandate to an agency (PROPOSED)' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateMandateDto,
  ) {
    return this.mandates.createMandate(current.userId, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Mandates over my properties (owner)' })
  mine(
    @CurrentUser() current: AuthenticatedUser,
    @Query('status') status?: MandateStatus,
  ) {
    return this.mandates.listMandatesForOwner(
      current.userId,
      status && status in MandateStatus ? status : undefined,
    );
  }

  @Get('managed')
  @ApiOperation({
    summary: 'List mandates for the caller agencies (assignment-aware)',
  })
  managed(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: ListManagedQueryDto,
  ) {
    return this.mandates.listManagedMandates(current.userId, query);
  }

  @Get('pending-approvals')
  @ApiOperation({ summary: 'List pending owner approvals' })
  pending(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.approvals.listPendingForOwner(
      current.userId,
      query.page,
      query.pageSize,
    );
  }

  @Patch('approvals/:id')
  @ApiOperation({
    summary: 'Approve or reject a pending approval (applies its effect)',
  })
  decide(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvals.decideApproval(current.userId, id, dto);
  }

  @Delete('approvals/:id')
  @ApiOperation({ summary: 'Cancel a PENDING approval (requester only)' })
  cancel(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.approvals.cancelApproval(current.userId, id);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Agency gérant accepts the proposal (→ ACTIVE)' })
  accept(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.mandates.acceptMandate(current.userId, id);
  }

  @Post(':id/decline')
  @ApiOperation({
    summary:
      'Decline a pending mandate (gérant for OWNER→agency; owner for AGENCY→client)',
  })
  decline(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DeclineMandateDto,
  ) {
    return this.mandates.declineMandate(current.userId, id, dto.reason);
  }

  @Post(':id/paper-document')
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 16 * 1024 * 1024 } }),
  )
  @ApiOperation({
    summary:
      'Agency ADMIN deposits/replaces the signed paper mandate (external clients)',
  })
  depositPaper(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile()
    file:
      | { buffer: Buffer; originalname: string; mimetype: string }
      | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Multipart field "file" is required',
      });
    }
    return this.documentReview.depositPaperDocument({
      mandateId: id,
      userId: current.userId,
      file,
    });
  }

  @Post(':id/terminate')
  @ApiOperation({
    summary: 'Terminate a mandate with notice, or immediately for cause',
  })
  terminate(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TerminateMandateDto,
  ) {
    return this.mandates.terminateMandate(current.userId, id, dto);
  }

  @Post(':id/counter')
  @ApiOperation({ summary: 'Counter-propose revised conditions (new version)' })
  counter(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CounterMandateDto,
  ) {
    return this.mandates.counterMandate(current.userId, id, dto);
  }

  @Post(':id/sign')
  @ApiOperation({
    summary:
      'OTP signature — omit `code` to receive an SMS, send it to sign; both sides finalize the PDF',
  })
  sign(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SignMandateDto,
  ) {
    return this.mandates.signMandate(current.userId, id, dto);
  }

  @Post(':id/approvals')
  @ApiOperation({ summary: 'Submit an action for owner approval (US 9)' })
  requestApproval(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateApprovalDto,
  ) {
    return this.approvals.createApproval(current.userId, id, dto);
  }

  @Patch(':id/assign')
  @ApiOperation({
    summary: 'Assign (or clear) a field agent on a mandate — gérant only',
  })
  assign(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignMandateDto,
  ) {
    return this.mandates.assignAgent(
      current.userId,
      id,
      dto.agentUserId === undefined ? null : dto.agentUserId,
    );
  }

  @Get(':id/document')
  @ApiOperation({ summary: 'Presigned URL of the signed mandate PDF' })
  document(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.mandates.getSignedDocumentUrl(current.userId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Mandate detail: conditions, versions, approvals' })
  detail(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.mandates.getMandateDetail(current.userId, id);
  }
}
