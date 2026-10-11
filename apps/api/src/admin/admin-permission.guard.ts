import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { verifyTotp } from './totp';

/**
 * Spec 15 B2 (spec 12 P1) — RBAC admin granulaire.
 * Rôles : SUPER_ADMIN > OPS > FINANCE > READ_ONLY.
 * Le décorateur `@AdminPermission('xxx')` déclare la permission requise ;
 * SUPER_ADMIN passe tout, READ_ONLY ne passe aucune permission de lecture
 * seule (les routes d'écriture lui sont interdites même si taggées lecture).
 */
export const ADMIN_PERMISSIONS: PermissionDef[] = [
  { key: 'users.read', roles: ['SUPER_ADMIN', 'OPS'] },
  { key: 'users.suspend', roles: ['SUPER_ADMIN', 'OPS'] },
  { key: 'orgs.read', roles: ['SUPER_ADMIN', 'OPS'] },
  { key: 'orgs.manage', roles: ['SUPER_ADMIN', 'OPS'] },
  { key: 'kyc.review', roles: ['SUPER_ADMIN', 'OPS'] },
  { key: 'moderation', roles: ['SUPER_ADMIN', 'OPS'] },
  { key: 'finance.read', roles: ['SUPER_ADMIN', 'FINANCE'] },
  { key: 'finance.refund.approve', roles: ['SUPER_ADMIN', 'FINANCE'] },
  { key: 'finance.dispute', roles: ['SUPER_ADMIN', 'FINANCE'] },
  { key: 'finance.payout', roles: ['SUPER_ADMIN', 'FINANCE'] },
  { key: 'finance.reconcile', roles: ['SUPER_ADMIN', 'FINANCE'] },
  { key: 'audit.read', roles: ['SUPER_ADMIN', 'OPS', 'FINANCE'] },
  { key: 'settings.manage', roles: ['SUPER_ADMIN'] },
  { key: 'admins.manage', roles: ['SUPER_ADMIN'] },
  { key: 'stats.read', roles: ['SUPER_ADMIN', 'OPS', 'FINANCE'] },
];

export interface PermissionDef {
  key: string;
  roles: string[];
}

export const ADMIN_PERMISSION_KEY = 'adminPermission';

export const AdminPermission = (permission: string): MethodDecorator & ClassDecorator => {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (propertyKey !== undefined && descriptor) {
      Reflect.defineMetadata(
        ADMIN_PERMISSION_KEY,
        permission,
        descriptor.value,
      );
      return descriptor;
    }
    Reflect.defineMetadata(ADMIN_PERMISSION_KEY, permission, target);
    return target;
  };
};

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const required = this.reflector.get<string>(ADMIN_PERMISSION_KEY, handler);
    const className = context.getClass().name ?? 'unknown';
    const handlerName = handler?.name ?? 'anonymous';
    console.log('[AdminPermissionGuard] canActivate start', { className, handlerName, required });
    if (!required) {
      console.log('[AdminPermissionGuard] pas de permission requise, on laisse passer');
      return true; // pas de permission taggée → RBAC existant
    }

    const req = context.switchToHttp().getRequest() as {
      user?: { userId?: string; roles?: string[] };
    };
    const userId = req.user?.userId;
    if (!userId) {
      throw new ForbiddenException({ code: 'NOT_AUTHENTICATED', message: 'Non authentifié' });
    }

    // Fallback : un GLOBAL ROLE PLATFORM_ADMIN sans AdminProfile = SUPER_ADMIN
    // (compat : les admins pré-RBAC gardent leurs droits).
    const profile = await this.prisma.adminProfile.findUnique({
      where: { userId },
      select: { role: true, totpSecret: true, totpEnabledAt: true },
    });
    let role = profile?.role;
    if (!role) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { roles: { select: { role: true } } },
      });
      const isLegacyAdmin = user?.roles.some((r) => r.role === 'PLATFORM_ADMIN');
      role = isLegacyAdmin ? 'SUPER_ADMIN' : null;
    }
    if (!role) {
      throw new ForbiddenException({
        code: 'ADMIN_PROFILE_REQUIRED',
        message: 'Aucun profil admin pour cet utilisateur',
      });
    }

    const def = ADMIN_PERMISSIONS.find((p) => p.key === required);
    if (!def || !def.roles.includes(role)) {
      throw new ForbiddenException({
        code: 'ADMIN_PERMISSION_DENIED',
        message: `Le rôle ${role} ne couvre pas la permission ${required}`,
      });
    }

    // Spec 15 B2 — 2FA OBLIGATOIRE sur les routes finance : si un TOTP est
    // provisionné (setup fait), un code valide est exigé à chaque appel.
    if (
      profile?.totpEnabledAt &&
      profile.totpSecret &&
      required.startsWith('finance.')
    ) {
      const headers = (req as { headers?: Record<string, string | string[] | undefined> }).headers ?? {};
      const rawCode = headers['x-totp-code'];
      const code = (Array.isArray(rawCode) ? rawCode[0] : rawCode)?.trim();
      if (!code || !verifyTotp(profile.totpSecret, code)) {
        throw new ForbiddenException({
          code: 'TOTP_CODE_REQUIRED',
          message: 'Un code TOTP valide (header x-totp-code) est requis',
        });
      }
    }
    return true;
  }
}
