import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { OrgMemberRole } from '@prisma/client';

/**
 * Metadata key for the `@OrganizationContext` decorator.
 * `OrgContextGuard` reads this off the route handler.
 */
export const ORG_CONTEXT_KEY = 'paradis-immo:org-context';

/**
 * Header used by clients (web dashboards) to indicate which organization
 * the user is currently acting on behalf of.
 *
 * Example: an owner delegates management to Paradis Immo via a `Mandate`.
 * When the web app switches to "agent view", it sends `x-org-id: org_paradis_immo`
 * and the API checks the user is an `AGENT` member of that org.
 */
export const ORG_ID_HEADER = 'x-org-id';

export interface OrgContextRequirement {
  /**
   * Required organization-member role(s). The user must hold at least one
   * of these roles in the target org.
   */
  roles: OrgMemberRole[];
}

/**
 * Restrict a route to users who are members of the org identified by the
 * `x-org-id` request header (or the `:orgId` route param), holding at least
 * one of the required organization-member roles.
 *
 * Pair with `OrgContextGuard`. Use the `@OrgId()` param decorator inside the
 * handler to access the resolved org id.
 *
 * Usage:
 *   @OrganizationContext({ roles: ['AGENT'] })
 *   @UseGuards(JwtAuthGuard, OrgContextGuard)
 *   @Patch('leases/:id/activate')
 *   activate(@OrgId() orgId: string, @Param('id') id: string) { ... }
 */
export const OrganizationContext = (requirement: OrgContextRequirement) =>
  SetMetadata(ORG_CONTEXT_KEY, requirement);

/**
 * Resolve the organization id the current request is scoped to.
 *
 * Reads from, in order: `x-org-id` header, `:orgId` route param, then the
 * value stashed on `req.orgId` by `OrgContextGuard`.
 *
 * Throws if no org id is present.
 */
export const OrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{
      orgId?: string;
      params?: Record<string, string>;
      headers?: Record<string, string | string[]>;
    }>();

    const fromRequest = req.orgId;
    if (fromRequest) return fromRequest;

    const fromParam = req.params?.orgId;
    if (fromParam) return fromParam;

    const fromHeader = req.headers?.[ORG_ID_HEADER];
    const value = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader;
    if (value) return value;

    throw new ForbiddenException({
      code: 'ORG_ID_REQUIRED',
      message: `Request must include an organization id (header "${ORG_ID_HEADER}" or :orgId param)`,
    });
  },
);
