import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { TestAuthGuard } from './test-auth.guard';
import { ACCOUNT_RECOVERY_METADATA_KEY } from '../decorators/account-recovery.decorator';

/**
 * Composite auth guard. In production (`NODE_ENV !== 'test'`), delegates to
 * the Passport JWT strategy and validates the Bearer token. In tests,
 * delegates to `TestAuthGuard` and reads the `x-test-user` / `x-test-roles`
 * headers.
 *
 * Using a single guard keeps `@UseGuards(AppAuthGuard)` declarations uniform
 * across routes — no need to swap guards per environment.
 *
 * The JWT strategy only rejects `SUSPENDED`. A `DELETED` account passes
 * through (spec 01 recovery window) and this guard blocks every route except
 * the ones explicitly marked with `@AllowAccountRecovery()` — so the user can
 * re-sign-in and cancel their pending deletion, while the rest of the API
 * keeps answering 403 `ACCOUNT_DELETED`.
 */
@Injectable()
export class AppAuthGuard implements CanActivate {
  private readonly jwtGuard = new (class extends PassportAuthGuard('jwt') {
    handleRequest<TUser = unknown>(err: unknown, user: unknown): TUser {
      if (err || !user) {
        throw new UnauthorizedException({
          code: 'NOT_AUTHENTICATED',
          message: 'Bearer token is missing or invalid',
        });
      }
      return user as TUser;
    }
  })();

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return new TestAuthGuard().canActivate(context);
    }
    const ok = await this.jwtGuard.canActivate(context);
    this.assertDeletedAccountRoute(context);
    return ok !== false;
  }

  /**
   * A DELETED account may only reach routes explicitly marked with
   * `@AllowAccountRecovery()`. Window expiry and anonymization are enforced
   * in `UsersService.cancelAccountDeletion`, never client-side.
   */
  assertDeletedAccountRoute(context: ExecutionContext): void {
    const request = context.switchToHttp().getRequest<{
      user?: { status?: string };
    }>();
    if (request?.user?.status !== 'DELETED') return;
    const recovery = this.reflector.getAllAndOverride<boolean>(
      ACCOUNT_RECOVERY_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (recovery) return;
    throw new ForbiddenException({
      code: 'ACCOUNT_DELETED',
      message: 'Ce compte a été supprimé.',
    });
  }
}
