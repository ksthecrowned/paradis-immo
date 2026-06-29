import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Test-only auth guard. In production, use `JwtAuthGuard` which validates
 * a Bearer token issued by `AuthService`.
 *
 * Reads:
 *   - `x-test-user`   → user id
 *   - `x-test-roles`  → comma-separated list of global roles
 *
 * If the `NODE_ENV` is anything other than `test`, this guard always rejects.
 *
 * Used by e2e specs that want to exercise authenticated paths without
 * going through the OTP → JWT dance.
 */
@Injectable()
export class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV !== 'test') {
      throw new UnauthorizedException({
        code: 'TEST_AUTH_DISABLED',
        message: 'TestAuthGuard can only run under NODE_ENV=test',
      });
    }
    const req = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      headers: Record<string, string | string[]>;
    }>();

    const userId = pickHeader(req.headers['x-test-user']);
    if (!userId) {
      throw new UnauthorizedException({
        code: 'TEST_USER_REQUIRED',
        message: 'Test request must include x-test-user header',
      });
    }

    const rolesHeader = pickHeader(req.headers['x-test-roles']);
    const roles = rolesHeader
      ? rolesHeader
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean)
      : ['TENANT'];

    req.user = { userId, roles };
    return true;
  }
}

function pickHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}
