import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { AdminGoogleDto } from './dto/admin-google.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @HttpCode(202)
  @ApiOperation({ summary: 'Request a 6-digit OTP via WhatsApp (mobile)' })
  async requestOtp(@Body() dto: RequestOtpDto) {
    await this.auth.requestOtp(dto);
    return { message: 'OTP sent' };
  }

  @Post('otp/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify OTP and issue JWT tokens (mobile)' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
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
  async webMagicConsume(@Body() dto: WebMagicConsumeDto) {
    return this.auth.consumeMagic(dto);
  }

  @Post('web/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Web email + password login' })
  async webLogin(@Body() dto: WebLoginDto) {
    return this.auth.loginWeb(dto);
  }

  @Post('web/google')
  @HttpCode(200)
  @ApiOperation({ summary: 'Web Google ID token login / signup' })
  async webGoogle(@Body() dto: WebGoogleDto) {
    return this.auth.loginGoogleWeb(dto);
  }

  @Post('web/role')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set Owner or Agent role (blocking onboarding)' })
  async webRole(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: WebRoleDto,
  ) {
    return this.auth.setWebRole(current.userId, dto.role);
  }

  /** @deprecated Prefer /auth/web/login — kept for older clients */
  @Post('admin/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Platform admin email/password (deprecated)' })
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.loginAdminPassword(dto);
  }

  /** @deprecated Prefer /auth/web/google */
  @Post('admin/google')
  @HttpCode(200)
  @ApiOperation({ summary: 'Platform admin Google (deprecated)' })
  async adminGoogle(@Body() dto: AdminGoogleDto) {
    return this.auth.loginAdminGoogle(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token and issue new pair' })
  async refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body);
  }
}
