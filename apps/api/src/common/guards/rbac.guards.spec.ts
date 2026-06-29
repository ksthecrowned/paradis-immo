import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { OrgMemberRole, OrganizationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventPublisher } from '../../events/event.publisher';
import { RolesGuard } from './roles.guard';
import { OrgContextGuard } from './org-context.guard';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

function makeCtx(
  user: AuthenticatedUser | null,
  headers: Record<string, string> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, headers }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({}),
    switchToWs: () => ({}),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    guard = new RolesGuard(reflector);
  });

  it('allows when user has any of the required global roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['PLATFORM_ADMIN'] as unknown);
    const ctx = makeCtx({ userId: 'u1', roles: ['PLATFORM_ADMIN', 'TENANT'] });
    expect(() => guard.canActivate(ctx)).not.toThrow();
  });

  it('rejects when user lacks every required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['PLATFORM_ADMIN'] as unknown);
    const ctx = makeCtx({ userId: 'u1', roles: ['TENANT'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('passes through when no @Roles metadata is set (only JwtAuthGuard required)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = makeCtx({ userId: 'u1', roles: ['TENANT'] });
    expect(() => guard.canActivate(ctx)).not.toThrow();
  });

  it('rejects when there is no authenticated user', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['TENANT'] as unknown);
    const ctx = makeCtx(null);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

describe('OrgContextGuard', () => {
  let guard: OrgContextGuard;
  let reflector: Reflector;
  let prisma: PrismaService;
  let ownerUserId: string;
  let agentUserId: string;
  let outsiderUserId: string;
  let countryId: string;
  const orgHeader = 'x-org-id';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;

    await prisma.user.deleteMany({
      where: {
        phone: { in: ['+242071111111', '+242072222222', '+242073333333'] },
      },
    });

    const owner = await prisma.user.create({
      data: {
        phone: '+242071111111',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;

    const agent = await prisma.user.create({
      data: {
        phone: '+242072222222',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    agentUserId = agent.id;

    const outsider = await prisma.user.create({
      data: {
        phone: '+242073333333',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    outsiderUserId = outsider.id;

    // Clean up any leftover orgs from previous runs
    await prisma.organizationMember.deleteMany({
      where: {
        userId: { in: [ownerUserId, agentUserId] },
        organization: {
          type: { in: [OrganizationType.OWNER, OrganizationType.AGENCY] },
        },
      },
    });

    // Paradis Immo AGENT member for agentUserId
    const paradis = await prisma.organization.findUniqueOrThrow({
      where: { id: 'org_paradis_immo' },
    });
    await prisma.organizationMember.create({
      data: {
        userId: agentUserId,
        organizationId: paradis.id,
        role: OrgMemberRole.AGENT,
      },
    });
  });

  afterAll(async () => {
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [ownerUserId, agentUserId, outsiderUserId] } },
    });
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, agentUserId, outsiderUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerUserId, agentUserId, outsiderUserId] } },
    });
    await prisma.onModuleDestroy();
  });

  beforeEach(() => {
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    guard = new OrgContextGuard(reflector, prisma);
  });

  it('passes through when no @OrganizationContext metadata is set', async () => {
    const ctx = makeCtx({ userId: ownerUserId, roles: ['TENANT'] });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects unauthenticated requests', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ roles: ['OWNER'] });
    const ctx = makeCtx(null, { [orgHeader]: 'org_some' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when x-org-id header is missing', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ roles: ['OWNER'] });
    const ctx = makeCtx({ userId: ownerUserId, roles: ['TENANT'] }, {});
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows OWNER member to access OWNER-only context', async () => {
    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Owner Org Inline ${Date.now()}`,
        type: OrganizationType.OWNER,
        countryId,
        members: { create: { userId: ownerUserId, role: OrgMemberRole.OWNER } },
      },
    });
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ roles: ['OWNER'] });
    const ctx = makeCtx(
      { userId: ownerUserId, roles: ['TENANT'] },
      { [orgHeader]: ownerOrg.id },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await prisma.organizationMember.deleteMany({
      where: { organizationId: ownerOrg.id },
    });
    await prisma.organization.delete({ where: { id: ownerOrg.id } });
  });

  it('rejects user without membership in the target org', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ roles: ['AGENT'] });
    const ctx = makeCtx(
      { userId: outsiderUserId, roles: ['TENANT'] },
      { [orgHeader]: 'org_paradis_immo' },
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when user has membership but with wrong role', async () => {
    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Owner Org WrongRole ${Date.now()}`,
        type: OrganizationType.OWNER,
        countryId,
        members: { create: { userId: ownerUserId, role: OrgMemberRole.OWNER } },
      },
    });
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ roles: ['AGENT'] });
    const ctx = makeCtx(
      { userId: ownerUserId, roles: ['TENANT'] },
      { [orgHeader]: ownerOrg.id },
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await prisma.organizationMember.deleteMany({
      where: { organizationId: ownerOrg.id },
    });
    await prisma.organization.delete({ where: { id: ownerOrg.id } });
  });

  it('allows AGENT member to access AGENT-only context on Paradis Immo', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ roles: ['AGENT'] });
    const ctx = makeCtx(
      { userId: agentUserId, roles: ['TENANT'] },
      { [orgHeader]: 'org_paradis_immo' },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
