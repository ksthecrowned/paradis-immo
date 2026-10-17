import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppAuthGuard } from './auth.guard';

function makeContext(status?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () =>
        status ? { user: { userId: 'u', roles: [], status } } : {},
    }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as unknown as ExecutionContext;
}

describe('AppAuthGuard — compte DELETED pendant la fenêtre de récupération (spec 01)', () => {
  let guard: AppAuthGuard;
  let recoveryAllowed: boolean | undefined;
  const reflector = {
    getAllAndOverride: jest.fn(() => recoveryAllowed),
  } as unknown as Reflector;

  beforeAll(() => {
    guard = new AppAuthGuard(reflector);
  });

  it('laisse passer un compte DELETED sur une route marquée @AllowAccountRecovery()', () => {
    recoveryAllowed = true;
    expect(guard.assertDeletedAccountRoute(makeContext('DELETED'))).toBeUndefined();
  });

  it('refuse un compte DELETED sur toute autre route avec 403 ACCOUNT_DELETED', () => {
    recoveryAllowed = false;
    expect(() =>
      guard.assertDeletedAccountRoute(makeContext('DELETED')),
    ).toThrow(ForbiddenException);
    try {
      guard.assertDeletedAccountRoute(makeContext('DELETED'));
    } catch (err) {
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: 'ACCOUNT_DELETED',
      });
    }
  });

  it('laisse un compte ACTIVE accéder aux routes sans marqueur', () => {
    recoveryAllowed = undefined;
    expect(guard.assertDeletedAccountRoute(makeContext('ACTIVE'))).toBeUndefined();
  });

  it('tolère une requête sans utilisateur (laisse le guard passer via le fallback)', () => {
    recoveryAllowed = undefined;
    expect(guard.assertDeletedAccountRoute(makeContext())).toBeUndefined();
  });
});
