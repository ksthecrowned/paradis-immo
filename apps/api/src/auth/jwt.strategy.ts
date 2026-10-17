import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  roles: string[];
}

export interface JwtUser {
  userId: string;
  roles: string[];
  status: string | null;
  deletedAt: Date | null;
  anonymizedAt: Date | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-only-change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    // A suspended account must not keep using a still-valid access token:
    // every authenticated route answers 403 (spec 01). A DELETED account is
    // NOT rejected here — it must be able to sign back in and cancel during
    // the 30-day recovery window; `AppAuthGuard` restricts it to routes
    // marked with `@AllowAccountRecovery()` and `UsersService` enforces the
    // window server-side.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, deletedAt: true, anonymizedAt: true },
    });
    if (user && user.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Ce compte est suspendu.',
      });
    }
    return {
      userId: payload.sub,
      roles: payload.roles,
      status: user?.status ?? null,
      deletedAt: user?.deletedAt ?? null,
      anonymizedAt: user?.anonymizedAt ?? null,
    };
  }
}
