import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Optional-auth guard. Populates `req.user` when valid credentials are
 * present, but never rejects the request — anonymous traffic passes through.
 *
 * In production, tries the Passport JWT strategy; in tests, reads the
 * `x-test-user` / `x-test-roles` headers when present. Pair the route with
 * the `@OptionalUser()` decorator.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  private readonly jwtGuard = new (class extends PassportAuthGuard('jwt') {
    handleRequest<TUser = unknown>(_err: unknown, user: unknown): TUser {
      return (user || null) as TUser;
    }
  })();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      const req = context.switchToHttp().getRequest<{
        user?: AuthenticatedUser;
        headers: Record<string, string | string[]>;
      }>();
      const rawUser = req.headers['x-test-user'];
      const userId = Array.isArray(rawUser) ? rawUser[0] : rawUser;
      if (userId) {
        const rawRoles = req.headers['x-test-roles'];
        const rolesHeader = Array.isArray(rawRoles) ? rawRoles[0] : rawRoles;
        const roles = rolesHeader
          ? rolesHeader.split(',').map((r) => r.trim()).filter(Boolean)
          : ['TENANT'];
        req.user = { userId, roles };
      }
      return true;
    }
    try {
      await this.jwtGuard.canActivate(context);
    } catch {
      // Anonymous requests are allowed.
    }
    return true;
  }
}
