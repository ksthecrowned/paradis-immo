import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { GlobalRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Enforces that the authenticated user holds at least one of the global
 * roles declared via `@Roles(...)` on the route handler.
 *
 * This guard is **scoped to global roles only** (TENANT, BUYER, PLATFORM_ADMIN).
 * For organization-scoped roles (OWNER, AGENT, ADMIN within a specific org),
 * use `OrgContextGuard` instead.
 *
 * Pair with `@UseGuards(JwtAuthGuard, RolesGuard)` — `JwtAuthGuard` must
 * run first to populate `req.user`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<GlobalRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true; // No @Roles declared → only auth required
    }

    const req = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();

    if (!req.user) {
      throw new ForbiddenException({
        code: 'NOT_AUTHENTICATED',
        message:
          'RolesGuard requires an authenticated user (use JwtAuthGuard first)',
      });
    }

    const userRoles = new Set(req.user.roles ?? []);
    const allowed = required.some((role) => userRoles.has(role));
    if (!allowed) {
      throw new ForbiddenException({
        code: 'ROLE_REQUIRED',
        message: `One of these roles is required: ${required.join(', ')}`,
        details: { userRoles: Array.from(userRoles) },
      });
    }

    return true;
  }
}
