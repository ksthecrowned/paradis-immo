import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MessagingModule } from '../messaging/messaging.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { InfobipOtpService } from './infobip-otp.service';
import { JwtStrategy } from './jwt.strategy';
import { MagicLinkStore } from './magic-link.store';
import { OtpStore } from './otp.store';

@Module({
  imports: [
    PassportModule,
    MessagingModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-only-change-me',
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpStore,
    MagicLinkStore,
    EmailService,
    InfobipOtpService,
    JwtStrategy,
  ],
  exports: [AuthService, JwtModule, OtpStore],
})
export class AuthModule {}
