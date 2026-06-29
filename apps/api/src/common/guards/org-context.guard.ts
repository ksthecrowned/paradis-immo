import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgMemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ORG_CONTEXT_KEY,
  ORG_ID_HEADER,
  type OrgContextRequirement,
} from '../decorators/org-context.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Enforces that the authenticated user is a member of the org identified by
 * the request's `x-org-id` header (or `:orgId` route param), and that they hold
 * at least one of the org-member roles declared via `@OrganizationContext(...)`.
 *
 * On success, the resolved org id is stashed on `req.orgId` so downstream
 * handlers (and the `@OrgId()` decorator) can read it without re-parsing.
 *
 * Usage:
 *   @OrganizationContext({ roles: ['AGENT'] })
 *   @UseGuards(JwtAuthGuard, OrgContextGuard)
 *   @Patch('properties/:id')
 *   update(@OrgId() orgId: string, ...) { ... }
 */
@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<
      OrgContextRequirement | undefined
    >(ORG_CONTEXT_KEY, [context.getHandler(), context.getClass()]);

    // No @OrganizationContext declared → only JwtAuthGuard required.
    if (!requirement) return true;

    const req = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      orgId?: string;
      params?: Record<string, string>;
      headers?: Record<string, string | string[]>;
    }>();

    if (!req.user) {
      throw new ForbiddenException({
        code: 'NOT_AUTHENTICATED',
        message:
          'OrgContextGuard requires an authenticated user (use JwtAuthGuard first)',
      });
    }

    const headerValue = req.headers?.[ORG_ID_HEADER];
    const fromHeader = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;
    const orgId = fromHeader || req.params?.orgId || undefined;

    if (!orgId) {
      throw new ForbiddenException({
        code: 'ORG_ID_REQUIRED',
        message: `Header "${ORG_ID_HEADER}" or :orgId route param is required`,
      });
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.userId,
          organizationId: orgId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException({
        code: 'NOT_ORG_MEMBER',
        message: 'User is not a member of the target organization',
      });
    }

    const allowedRoles = new Set<OrgMemberRole>(requirement.roles);
    if (!allowedRoles.has(membership.role)) {
      throw new ForbiddenException({
        code: 'ORG_ROLE_REQUIRED',
        message: `One of these org roles is required: ${requirement.roles.join(', ')}`,
        details: { userRole: membership.role },
      });
    }

    // Stash the resolved orgId for downstream handlers / decorators
    req.orgId = orgId;
    return true;
  }
}
