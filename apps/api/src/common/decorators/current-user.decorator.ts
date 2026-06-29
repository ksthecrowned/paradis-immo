import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  roles: string[];
}

/**
 * Require an authenticated user. Throws if the route does not have
 * `req.user` populated (i.e. `JwtAuthGuard` / `AppAuthGuard` missing or
 * not yet executed).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!req.user) {
      throw new Error(
        'CurrentUser used on a route without JwtAuthGuard (or no req.user)',
      );
    }
    return req.user;
  },
);

/**
 * Optional variant: returns the authenticated user if present, or `null`.
 * Use on routes that have conditional auth (e.g. public read endpoints
 * that personalize when authenticated, but still serve anonymous traffic).
 */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | null => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    return req.user ?? null;
  },
);
