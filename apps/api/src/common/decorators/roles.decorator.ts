import { SetMetadata } from '@nestjs/common';
import type { GlobalRole } from '@prisma/client';

/**
 * Metadata key for the `@Roles` decorator.
 * `RolesGuard` reads this off the route handler to enforce a required
 * set of global roles on the authenticated user.
 */
export const ROLES_KEY = 'paradis-immo:required-roles';

/**
 * Restrict a route to users holding at least one of the given global roles.
 *
 * Usage:
 *   @Roles('PLATFORM_ADMIN')
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Get('admin/stats')
 *
 * Note: this checks **global** roles (TENANT / BUYER / PLATFORM_ADMIN).
 * For organization-scoped roles (OWNER / AGENT / ADMIN inside a specific org),
 * use `@OrganizationContext()` + `OrgContextGuard` instead.
 */
export const Roles = (...roles: GlobalRole[]) => SetMetadata(ROLES_KEY, roles);
