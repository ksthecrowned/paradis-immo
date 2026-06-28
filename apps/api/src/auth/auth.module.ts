import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InfobipOtpService } from './infobip-otp.service';
import { JwtStrategy } from './jwt.strategy';
import { OtpStore } from './otp.store';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-only-change-me',
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpStore, InfobipOtpService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}