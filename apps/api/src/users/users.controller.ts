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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

class LookupUserQueryDto {
  @IsString()
  @Matches(/^\+\d{7,15}$/, {
    message: 'phone must be E.164 (+country…)',
  })
  phone!: string;
}

class RequestPhoneChangeDto {
  @IsString()
  @Matches(/^\+\d{7,15}$/, { message: 'newPhone must be E.164' })
  newPhone!: string;
}

class ConfirmPhoneChangeDto extends RequestPhoneChangeDto {
  @IsString()
  @MaxLength(8)
  code!: string;
}

class RequestEmailChangeDto {
  @IsString()
  @MaxLength(200)
  email!: string;
}

class ConfirmEmailChangeDto {
  @IsString()
  @MaxLength(400)
  token!: string;
}

class UpdateConsentsDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  termsVersion?: string;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}

/** Best-effort client IP for per-source OTP limits (mirrors auth.controller). */
function clientIp(req: ExpressRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim();
  return forwardedIp || req.ip || undefined;
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AppAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  async getMe(@CurrentUser() current: AuthenticatedUser) {
    return this.users.getMe(current.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update authenticated user profile' })
  async updateMe(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateMeDto,
  ) {
    return this.users.updateMe(current.userId, dto);
  }

  @Get('me/organizations')
  @ApiOperation({ summary: 'List organizations the user belongs to' })
  async myOrganizations(@CurrentUser() current: AuthenticatedUser) {
    return this.users.listMyOrganizations(current.userId);
  }

  @Get('me/sessions')
  @ApiOperation({ summary: 'List active sessions (spec 01)' })
  async sessions(@CurrentUser() current: AuthenticatedUser) {
    return { sessions: await this.users.listSessions(current.userId) };
  }

  @Delete('me/sessions/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke a session (spec 01)' })
  async revokeSession(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.users.revokeSession(current.userId, id);
  }

  @Post('me/phone/request')
  @HttpCode(202)
  @ApiOperation({ summary: 'Send an OTP to a new phone number (spec 01)' })
  async requestPhoneChange(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: RequestPhoneChangeDto,
    @Req() req: ExpressRequest,
  ) {
    return this.users.requestPhoneChange(
      current.userId,
      dto.newPhone,
      clientIp(req),
    );
  }

  @Post('me/phone/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm the new phone number with the OTP (spec 01)' })
  async confirmPhoneChange(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: ConfirmPhoneChangeDto,
  ) {
    return this.users.confirmPhoneChange(
      current.userId,
      dto.newPhone,
      dto.code,
    );
  }

  @Post('me/email')
  @HttpCode(202)
  @ApiOperation({ summary: 'Send a verification magic link (spec 01)' })
  async requestEmailChange(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: RequestEmailChangeDto,
  ) {
    return this.users.requestEmailChange(current.userId, dto.email);
  }

  @Post('me/email/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a new email via magic link (spec 01)' })
  async confirmEmailChange(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: ConfirmEmailChangeDto,
  ) {
    return this.users.confirmEmailChange(current.userId, dto.token);
  }

  @Post('me/consents')
  @HttpCode(200)
  @ApiOperation({ summary: 'Record versioned consents (spec 01)' })
  async updateConsents(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateConsentsDto,
  ) {
    return this.users.updateConsents(current.userId, dto);
  }

  @Post('me/deletion')
  @HttpCode(202)
  @ApiOperation({
    summary:
      'Request account deletion — 409 with blockers if obligations remain (spec 01)',
  })
  async requestDeletion(@CurrentUser() current: AuthenticatedUser) {
    const result = await this.users.requestAccountDeletion(current.userId);
    return {
      message:
        'Suppression programmée. Reconnectez-vous sous 30 jours pour annuler.',
      deletedAt: result.deletedAt.toISOString(),
    };
  }

  @Delete('me/deletion')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a pending account deletion (spec 01)' })
  async cancelDeletion(@CurrentUser() current: AuthenticatedUser) {
    await this.users.cancelAccountDeletion(current.userId);
    return { message: 'Suppression annulée.' };
  }

  @Get('lookup')
  @ApiOperation({
    summary:
      'Lookup a registered user by E.164 phone — org members only, masked name (spec 01)',
  })
  async lookup(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: LookupUserQueryDto,
  ) {
    return this.users.lookupForManager(current.userId, query.phone);
  }
}
