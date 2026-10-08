import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  MemberStatus,
  OrgMemberRole,
  OrganizationRequestType,
  ReviewSourceType,
} from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrgContextGuard } from '../common/guards/org-context.guard';
import { OrganizationContext } from '../common/decorators/org-context.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AgencyService } from './agency.service';

/** Public sign-up form: no account required, no role granted (spec 02). */
class SubmitRequestDto {
  @IsEnum(OrganizationRequestType)
  type!: OrganizationRequestType;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(200)
  email!: string;

  @IsOptional() @IsString() @MaxLength(160) legalName?: string;
  @IsOptional() @IsString() @MaxLength(60) rccm?: string;
  @IsOptional() @IsString() @MaxLength(60) niu?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(120) cityLabel?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

class UpdateAgencyDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(160) tagline?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(120) cityLabel?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) shortName?: string;
  @IsOptional() @IsString() @MaxLength(32) logoColor?: string;
  @IsOptional() @IsInt() @Min(1900) foundedYear?: number;
  @IsOptional() @IsObject() openingHours?: Record<string, unknown>;
  @IsOptional() @IsObject() socialLinks?: Record<string, unknown>;
}

class UpdateMemberDto {
  @IsOptional() @IsEnum(OrgMemberRole) role?: OrgMemberRole;
  @IsOptional() @IsEnum(MemberStatus) status?: MemberStatus;
}

class CreateInvitationDto {
  @IsOptional() @IsString() @Matches(/^\+\d{7,15}$/) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsEnum(OrgMemberRole) role!: OrgMemberRole;
}

class ServiceAreasDto {
  @IsArray()
  @IsString({ each: true })
  quartierIds!: string[];
}

class CreateReviewDto {
  @IsEnum(ReviewSourceType)
  sourceType!: ReviewSourceType;

  @IsString()
  @MaxLength(64)
  sourceId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  comment!: string;
}

@ApiTags('Agencies')
@ApiBearerAuth()
@Controller('organizations')
export class AgencyController {
  constructor(private readonly agency: AgencyService) {}

  @Post('requests')
  @HttpCode(202)
  @ApiOperation({
    summary:
      'Submit the agency / owner sign-up form — admin invites afterwards (spec 02)',
  })
  submitRequest(
    @OptionalUser() me: AuthenticatedUser | null,
    @Body() dto: SubmitRequestDto,
  ) {
    return this.agency.submitRequest({
      ...dto,
      submittedById: me?.userId ?? null,
    });
  }

  @Patch(':orgId')
  @UseGuards(AppAuthGuard, OrgContextGuard)
  @OrganizationContext({ roles: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN] })
  @ApiOperation({ summary: 'Update agency profile / storefront — spec 02' })
  update(
    @CurrentUser() me: AuthenticatedUser,
    @Param('orgId') orgId: string,
    @Body() dto: UpdateAgencyDto,
  ) {
    return this.agency.updateProfile(me.userId, orgId, dto);
  }

  @Post(':orgId/logo')
  @UseGuards(AppAuthGuard, OrgContextGuard)
  @OrganizationContext({ roles: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN] })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload the agency logo — spec 02' })
  uploadLogo(
    @CurrentUser() me: AuthenticatedUser,
    @Param('orgId') orgId: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string } | undefined,
  ) {
    return this.agency.uploadLogo(me.userId, orgId, file!);
  }

  @Put(':orgId/service-areas')
  @UseGuards(AppAuthGuard, OrgContextGuard)
  @OrganizationContext({ roles: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN] })
  @ApiOperation({ summary: 'Set the quartiers this agency covers — spec 02' })
  serviceAreas(
    @CurrentUser() me: AuthenticatedUser,
    @Param('orgId') orgId: string,
    @Body() dto: ServiceAreasDto,
  ) {
    return this.agency.setServiceAreas(me.userId, orgId, dto.quartierIds);
  }

  @Get(':orgId/members')
  @UseGuards(AppAuthGuard, OrgContextGuard)
  @OrganizationContext({ roles: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN, OrgMemberRole.AGENT] })
  @ApiOperation({ summary: 'List agency members — spec 02' })
  members(@CurrentUser() me: AuthenticatedUser, @Param('orgId') orgId: string) {
    return this.agency.listMembers(me.userId, orgId);
  }

  @Patch(':orgId/members/:userId')
  @UseGuards(AppAuthGuard, OrgContextGuard)
  @OrganizationContext({ roles: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN] })
  @ApiOperation({ summary: 'Change a member role / disable them — spec 02' })
  updateMember(
    @CurrentUser() me: AuthenticatedUser,
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.agency.updateMember(me.userId, orgId, targetUserId, dto);
  }

  @Delete(':orgId/members/:userId')
  @UseGuards(AppAuthGuard, OrgContextGuard)
  @OrganizationContext({ roles: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN] })
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a member — spec 02' })
  removeMember(
    @CurrentUser() me: AuthenticatedUser,
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.agency.removeMember(me.userId, orgId, targetUserId);
  }

  @Post(':orgId/leave')
  @UseGuards(AppAuthGuard, OrgContextGuard)
  @OrganizationContext({ roles: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN, OrgMemberRole.AGENT] })
  @HttpCode(200)
  @ApiOperation({ summary: 'Leave an agency — spec 02' })
  leave(@CurrentUser() me: AuthenticatedUser, @Param('orgId') orgId: string) {
    return this.agency.leave(me.userId, orgId);
  }

  @Post(':orgId/reviews')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiOperation({ summary: 'Review an agency after a real interaction — spec 02' })
  createReview(
    @CurrentUser() me: AuthenticatedUser,
    @Param('orgId') orgId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.agency.createReview(me.userId, orgId, dto);
  }

  @Post(':orgId/invitations')
  @UseGuards(AppAuthGuard, OrgContextGuard)
  @OrganizationContext({ roles: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN] })
  @HttpCode(201)
  @ApiOperation({ summary: 'Invite a collaborator by phone or email — spec 02' })
  createInvitation(
    @CurrentUser() me: AuthenticatedUser,
    @Param('orgId') orgId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.agency.createInvitation(me.userId, orgId, dto);
  }

  @Get(':orgId/invitations')
  @UseGuards(AppAuthGuard, OrgContextGuard)
  @OrganizationContext({ roles: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN] })
  @ApiOperation({ summary: 'List invitations — spec 02' })
  listInvitations(
    @CurrentUser() me: AuthenticatedUser,
    @Param('orgId') orgId: string,
  ) {
    return this.agency.listInvitations(me.userId, orgId);
  }

  @Delete(':orgId/invitations/:invId')
  @UseGuards(AppAuthGuard, OrgContextGuard)
  @OrganizationContext({ roles: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN] })
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke an invitation — spec 02' })
  revokeInvitation(
    @CurrentUser() me: AuthenticatedUser,
    @Param('orgId') orgId: string,
    @Param('invId') invId: string,
  ) {
    return this.agency.revokeInvitation(me.userId, orgId, invId);
  }
}

type ReviewRequestAction = 'INVITE' | 'REJECT';

class ReviewRequestDto {
  @IsIn(['INVITE', 'REJECT'])
  action!: ReviewRequestAction;

  @IsOptional() @IsString() @MaxLength(500) rejectionReason?: string;
}

/** Admin review of the public sign-up dossiers (spec 02 / 12). */
@ApiTags('Admin · Organization requests')
@ApiBearerAuth()
@Controller('admin/organization-requests')
@UseGuards(AppAuthGuard, RolesGuard)
@Roles('PLATFORM_ADMIN')
export class AdminOrganizationRequestsController {
  constructor(private readonly agency: AgencyService) {}

  @Get()
  @ApiOperation({ summary: 'List sign-up dossiers — spec 02' })
  list(@Query('status') status?: 'PENDING' | 'INVITED' | 'REJECTED') {
    return this.agency.listRequests(status);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Approve (create org + invitation link) or reject — spec 02',
  })
  review(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewRequestDto,
  ) {
    return this.agency.reviewRequest(me.userId, id, {
      action: dto.action,
      rejectionReason: dto.rejectionReason,
    });
  }
}
