import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { TestAuthGuard } from './test-auth.guard';

/**
 * Composite auth guard. In production (`NODE_ENV !== 'test'`), delegates to
 * the Passport JWT strategy and validates the Bearer token. In tests,
 * delegates to `TestAuthGuard` and reads the `x-test-user` / `x-test-roles`
 * headers.
 *
 * Using a single guard keeps `@UseGuards(AppAuthGuard)` declarations uniform
 * across routes — no need to swap guards per environment.
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

  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'test') {
      return new TestAuthGuard().canActivate(context);
    }
    return this.jwtGuard.canActivate(context) as boolean;
  }
}
