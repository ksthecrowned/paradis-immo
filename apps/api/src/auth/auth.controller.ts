import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService, type AuthDeviceContext } from './auth.service';
import { AdminGoogleDto } from './dto/admin-google.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { LogoutAllDto, LogoutDto } from './dto/logout.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  WebGoogleDto,
  WebLoginDto,
  WebMagicConsumeDto,
  WebRegisterDto,
  WebRoleDto,
} from './dto/web-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Device metadata stored with each refresh token so sessions can be listed
 * and revoked (spec 01). `x-forwarded-for` is only trusted when present —
 * Express is not configured with `trust proxy`, so `req.ip` alone would be
 * the last hop.
 */
/** Best-effort client IP for per-source rate limits (spec 01). */
function clientIpFrom(req: ExpressRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim();
  return forwardedIp || req.ip || undefined;
}

function deviceContextFrom(
  req: ExpressRequest,
  body: { deviceId?: string; deviceName?: string; platform?: 'IOS' | 'ANDROID' | 'WEB' | 'ADMIN' },
): AuthDeviceContext {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim();
  const userAgent = req.headers['user-agent'];
  return {
    deviceId: body.deviceId,
    deviceName: body.deviceName,
    platform: body.platform,
    ipAddress: forwardedIp ?? req.ip ?? undefined,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 300) : undefined,
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @HttpCode(202)
  @ApiOperation({ summary: 'Request a 6-digit OTP via WhatsApp (mobile)' })
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: ExpressRequest) {
    await this.auth.requestOtp({
      ...dto,
      ipAddress: clientIpFrom(req),
    });
    return { message: 'OTP sent' };
  }

  @Post('otp/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify OTP and issue JWT tokens (mobile)' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: ExpressRequest) {
    return this.auth.verifyOtp({
      ...dto,
      device: deviceContextFrom(req, dto),
    });
  }

  @Post('web/register')
  @HttpCode(202)
  @ApiOperation({ summary: 'Start web email signup (magic link)' })
  async webRegister(@Body() dto: WebRegisterDto) {
    return this.auth.registerWeb(dto);
  }

  @Post('web/magic/resend')
  @HttpCode(202)
  @ApiOperation({ summary: 'Resend web email magic link' })
  async webMagicResend(@Body() dto: WebRegisterDto) {
    return this.auth.resendWebMagic(dto);
  }

  @Post('web/magic/consume')
  @HttpCode(200)
  @ApiOperation({ summary: 'Consume magic link, set password, issue JWTs' })
  async webMagicConsume(
    @Body() dto: WebMagicConsumeDto,
    @Req() req: ExpressRequest,
  ) {
    return this.auth.consumeMagic({
      ...dto,
      device: deviceContextFrom(req, dto),
    });
  }

  @Post('web/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Web email + password login' })
  async webLogin(@Body() dto: WebLoginDto, @Req() req: ExpressRequest) {
    return this.auth.loginWeb({
      ...dto,
      device: deviceContextFrom(req, dto),
    });
  }

  @Post('web/google')
  @HttpCode(200)
  @ApiOperation({ summary: 'Web Google ID token login / signup' })
  async webGoogle(@Body() dto: WebGoogleDto, @Req() req: ExpressRequest) {
    return this.auth.loginGoogleWeb({
      ...dto,
      device: deviceContextFrom(req, dto),
    });
  }

  @Post('web/role')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set Owner or Agent role (blocking onboarding)' })
  async webRole(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: WebRoleDto,
    @Req() req: ExpressRequest,
  ) {
    return this.auth.setWebRole(
      current.userId,
      dto.role,
      deviceContextFrom(req, dto),
    );
  }

  /** @deprecated Prefer /auth/web/login — kept for older clients */
  @Post('admin/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Platform admin email/password (deprecated)' })
  async adminLogin(@Body() dto: AdminLoginDto, @Req() req: ExpressRequest) {
    return this.auth.loginAdminPassword({
      ...dto,
      device: deviceContextFrom(req, dto),
    });
  }

  /** @deprecated Prefer /auth/web/google */
  @Post('admin/google')
  @HttpCode(200)
  @ApiOperation({ summary: 'Platform admin Google (deprecated)' })
  async adminGoogle(@Body() dto: AdminGoogleDto, @Req() req: ExpressRequest) {
    return this.auth.loginAdminGoogle({
      ...dto,
      device: deviceContextFrom(req, dto),
    });
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token and issue new pair' })
  async refresh(
    @Body() body: { refreshToken: string; deviceId?: string },
    @Req() req: ExpressRequest,
  ) {
    return this.auth.refresh({
      refreshToken: body.refreshToken,
      device: deviceContextFrom(req, body),
    });
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the presented refresh token (spec 01)' })
  async logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto);
  }

  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke every session of the current user' })
  async logoutAll(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: LogoutAllDto,
  ) {
    return this.auth.logoutAll(current.userId, dto);
  }
}
