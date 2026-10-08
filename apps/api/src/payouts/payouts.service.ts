import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OrgMemberRole, PayoutAccount, PaymentProvider, Prisma, PayoutStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';

export interface RequestPayoutInput {
  payoutAccountId?: string;
}

export interface ListPayoutsQuery {
  status?: PayoutStatus;
  page?: number;
  pageSize?: number;
}

interface PayoutAccountRelation {
  id: string;
  type: string;
  provider: string | null;
  phone: string | null;
  bankName: string | null;
  accountNumber: string | null;
  holderName: string;
  isDefault: boolean;
}

export interface PayoutPublic {
  id: string;
  organizationId: string;
  payoutAccountId: string;
  amount: string;
  fee: string;
  currency: string;
  kind: string;
  status: string;
  providerRef: string | null;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
  account: {
    id: string;
    type: string;
    holderName: string;
    bankName: string | null;
    /** Numéro masqué : `+24207***61` ou `****1234`. */
    masked: string;
    isDefault: boolean;
  } | null;
}

export interface PayoutAccountPublic {
  id: string;
  organizationId: string;
  type: string;
  provider: string | null;
  phone: string | null;
  bankName: string | null;
  accountNumber: string | null;
  holderName: string;
  verifiedAt: string | null;
  isDefault: boolean;
  createdAt: string;
}

type PayoutWithAccount = {
  id: string;
  organizationId: string;
  payoutAccountId: string;
  amount: Prisma.Decimal;
  fee: Prisma.Decimal;
  currency: string;
  kind: string;
  status: PayoutStatus;
  providerRef: string | null;
  failureReason: string | null;
  createdAt: Date;
  paidAt: Date | null;
  payoutAccount: PayoutAccountRelation | null;
};

/**
 * Spec 05 — reversements aux propriétaires.
 *
 * Solde = somme signée du grand livre (03) sur les organisations détenues par
 * l'utilisateur, HORS écritures rattachées à un paiement en litige ouvert,
 * et HORS reversements déjà engagés (PENDING / PROCESSING / PAID) afin de ne
 * jamais reverser la même somme deux fois (le ledger ne porte pas d'écriture
 * `PAYOUT` : elle serait ambiguë au niveau propriété, les reversements étant
 * engagés au niveau organisation).
 *
 * Le virement fournisseur est simulé en sandbox : un mobile money se
 * terminant par `9999` ou un compte bancaire se terminant par `0000`
 * échoue (statut FAILED, non retenté automatiquement — notifié à la finance
 * via `PAYOUT_FAILED`).
 */
@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
  ) {}

  // -------------------------------------------------------------------------
  // Solde
  // -------------------------------------------------------------------------

  /** Organisations propriétaires de l'utilisateur (via ses biens). */
  async ownerOrgIds(userId: string): Promise<string[]> {
    const props = await this.prisma.property.findMany({
      where: { ownerId: userId },
      select: { organizationId: true },
      distinct: ['organizationId'],
      take: 500,
    });
    return [...new Set(props.map((p) => p.organizationId))];
  }

  /**
   * Solde net du ledger hors montants en litige et hors reversements déjà
   * engagés (acceptation spec 05 : « Un reversement mensuel = solde du
   * ledger hors montants en litige »).
   */
  async availableBalance(ownerOrgIds: string[]): Promise<{
    balance: Prisma.Decimal;
    currency: string;
    disputedAmount: Prisma.Decimal;
  }> {
    if (ownerOrgIds.length === 0) {
      return {
        balance: new Prisma.Decimal(0),
        currency: 'XAF',
        disputedAmount: new Prisma.Decimal(0),
      };
    }

    const disputed = await this.prisma.payment.findMany({
      where: {
        disputes: {
          some: { status: { in: ['OPEN', 'AWAITING_MANAGER', 'ESCALATED'] } },
        },
      },
      select: { id: true, amount: true },
    });
    const disputedIds = disputed.map((d) => d.id);
    const disputedAmount = disputed.reduce(
      (acc, d) => acc.add(d.amount),
      new Prisma.Decimal(0),
    );

    const rows = await this.prisma.ledgerEntry.findMany({
      where: {
        ownerOrgId: { in: ownerOrgIds },
        ...(disputedIds.length > 0
          ? {
              NOT: {
                sourceType: 'PAYMENT',
                sourceId: { in: disputedIds },
              },
            }
          : {}),
      },
      select: { amount: true, currency: true },
      orderBy: { occurredAt: 'desc' },
    });

    let balance = new Prisma.Decimal(0);
    let currency = rows[0]?.currency ?? 'XAF';
    for (const row of rows) {
      balance = balance.add(row.amount);
    }

    const engaged = await this.prisma.payout.aggregate({
      where: {
        organizationId: { in: ownerOrgIds },
        status: { in: ['PENDING', 'PROCESSING', 'PAID'] },
      },
      _sum: { amount: true },
    });
    balance = balance.sub(engaged._sum.amount ?? new Prisma.Decimal(0));

    return { balance, currency, disputedAmount };
  }

  // -------------------------------------------------------------------------
  // Reversement à la demande
  // -------------------------------------------------------------------------

  async requestPayout(
    userId: string,
    input: RequestPayoutInput,
  ): Promise<PayoutPublic> {
    const orgIds = await this.ownerOrgIds(userId);
    if (orgIds.length === 0) {
      throw new ForbiddenException({
        code: 'NOT_OWNER',
        message: 'Only a property owner can request a payout',
      });
    }

    let account: PayoutAccount | null = null;
    if (input.payoutAccountId) {
      account = await this.prisma.payoutAccount.findUnique({
        where: { id: input.payoutAccountId },
      });
      if (!account || !orgIds.includes(account.organizationId)) {
        throw new NotFoundException({
          code: 'PAYOUT_ACCOUNT_NOT_FOUND',
          message: 'Payout account not found',
        });
      }
      if (!account.verifiedAt) {
        throw new BadRequestException({
          code: 'PAYOUT_ACCOUNT_NOT_VERIFIED',
          message: 'The payout account must be verified first',
        });
      }
    } else {
      account = await this.prisma.payoutAccount.findFirst({
        where: {
          organizationId: { in: orgIds },
          verifiedAt: { not: null },
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      if (!account) {
        throw new BadRequestException({
          code: 'NO_VERIFIED_PAYOUT_ACCOUNT',
          message: 'No verified payout account on this portfolio',
        });
      }
    }

    const open = await this.prisma.payout.count({
      where: {
        organizationId: account.organizationId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });
    if (open > 0) {
      throw new ConflictException({
        code: 'PAYOUT_IN_PROGRESS',
        message: 'A payout is already in progress for this organization',
      });
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: account.organizationId },
      select: { minPayoutAmount: true },
    });
    const min = new Prisma.Decimal(org?.minPayoutAmount ?? 0);
    const { balance, currency } = await this.availableBalance([
      account.organizationId,
    ]);
    if (balance.lte(0) || balance.lt(min)) {
      throw new BadRequestException({
        code: 'MINIMUM_PAYOUT_NOT_REACHED',
        message: 'Available balance is below the minimum payout amount',
        balance: balance.toString(),
        minPayoutAmount: min.toString(),
      });
    }

    const payout = await this.prisma.payout.create({
      data: {
        organizationId: account.organizationId,
        payoutAccountId: account.id,
        amount: balance,
        currency,
        kind: 'OWNER_NET',
        status: PayoutStatus.PENDING,
      },
      include: { payoutAccount: true },
    });
    return this.executePayout(payout);
  }

  /**
   * PENDING → PROCESSING → PAID | FAILED. En sandbox, un compte « piège »
   * (mobile money se terminant par 9999, compte bancaire se terminant par
   * 0000) échoue : l'échec n'est jamais retenté automatiquement.
   */
  async executePayout(
    payout: PayoutWithAccount,
  ): Promise<PayoutPublic> {
    const processing = await this.prisma.payout.update({
      where: { id: payout.id },
      data: { status: PayoutStatus.PROCESSING },
      include: { payoutAccount: true },
    });
    const account = processing.payoutAccount;
    const trap =
      (account?.type === 'MOBILE_MONEY' &&
        (account.phone ?? '').endsWith('9999')) ||
      (account?.type === 'BANK' &&
        (account.accountNumber ?? '').endsWith('0000'));

    if (trap) {
      const failed = await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.FAILED,
          failureReason: 'SANDBOX_TRANSFER_FAILED',
        },
        include: { payoutAccount: true },
      });
      await this.events.emit(DOMAIN_EVENTS.PAYOUT_FAILED, {
        payoutId: failed.id,
        organizationId: failed.organizationId,
        amount: failed.amount.toString(),
        currency: failed.currency,
        reason: 'SANDBOX_TRANSFER_FAILED',
      });
      return this.toPublic(failed);
    }

    const paid = await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.PAID,
        paidAt: new Date(),
        providerRef: `po_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        failureReason: null,
      },
      include: { payoutAccount: true },
    });
    await this.events.emit(DOMAIN_EVENTS.PAYOUT_PAID, {
      payoutId: paid.id,
      organizationId: paid.organizationId,
      amount: paid.amount.toString(),
      currency: paid.currency,
      reason: null,
    });
    return this.toPublic(paid);
  }

  // -------------------------------------------------------------------------
  // Listes
  // -------------------------------------------------------------------------

  async listMine(
    userId: string,
    query: ListPayoutsQuery,
  ): Promise<{
    data: PayoutPublic[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    const orgIds = await this.ownerOrgIds(userId);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    if (orgIds.length === 0) {
      return { data: [], meta: { total: 0, page, pageSize, totalPages: 1 } };
    }
    const where: Prisma.PayoutWhereInput = {
      organizationId: { in: orgIds },
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.payout.count({ where }),
      this.prisma.payout.findMany({
        where,
        include: { payoutAccount: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      data: rows.map((r) => this.toPublic(r)),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
  }

  async listAdmin(query: ListPayoutsQuery): Promise<{
    data: PayoutPublic[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.PayoutWhereInput = {
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.payout.count({ where }),
      this.prisma.payout.findMany({
        where,
        include: { payoutAccount: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      data: rows.map((r) => this.toPublic(r)),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
  }

  /** POST admin/payouts/:id/retry — relance manuelle d'un reversement. */
  async retry(payoutId: string): Promise<PayoutPublic> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: { payoutAccount: true },
    });
    if (!payout) {
      throw new NotFoundException({
        code: 'PAYOUT_NOT_FOUND',
        message: 'Payout not found',
      });
    }
    if (payout.status !== PayoutStatus.FAILED) {
      throw new BadRequestException({
        code: 'PAYOUT_NOT_RETRYABLE',
        message: 'Only a failed payout can be retried',
      });
    }
    const reset = await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.PENDING, failureReason: null },
      include: { payoutAccount: true },
    });
    return this.executePayout(reset);
  }

  // -------------------------------------------------------------------------
  // Cron mensuel (le 10)
  // -------------------------------------------------------------------------

  /** Public for direct invocation from tests. */
  async runMonthlyPayouts(): Promise<{
    orgs: number;
    created: number;
    paid: number;
    failed: number;
  }> {
    const orgs = await this.prisma.organization.findMany({
      where: { payoutFrequency: 'MONTHLY' },
      select: { id: true, minPayoutAmount: true },
    });
    let created = 0;
    let paid = 0;
    let failed = 0;
    for (const org of orgs) {
      const open = await this.prisma.payout.count({
        where: {
          organizationId: org.id,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      });
      if (open > 0) continue;

      const account = await this.prisma.payoutAccount.findFirst({
        where: { organizationId: org.id, verifiedAt: { not: null } },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      if (!account) continue;

      const min = new Prisma.Decimal(org.minPayoutAmount);
      const { balance, currency } = await this.availableBalance([org.id]);
      if (balance.lte(0) || balance.lt(min)) continue;

      const payout = await this.prisma.payout.create({
        data: {
          organizationId: org.id,
          payoutAccountId: account.id,
          amount: balance,
          currency,
          kind: 'OWNER_NET',
          status: PayoutStatus.PENDING,
        },
        include: { payoutAccount: true },
      });
      created += 1;
      const result = await this.executePayout(payout);
      if (result.status === 'PAID') paid += 1;
      else failed += 1;
    }
    return { orgs: orgs.length, created, paid, failed };
  }

  // -------------------------------------------------------------------------
  // Comptes de reversement
  // -------------------------------------------------------------------------

  async listAccounts(
    userId: string,
    orgId: string,
  ): Promise<PayoutAccountPublic[]> {
    await this.assertCanManageAccounts(userId, orgId);
    const rows = await this.prisma.payoutAccount.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.toPublicAccount(r));
  }

  async createAccount(
    userId: string,
    orgId: string,
    input: {
      type: 'MOBILE_MONEY' | 'BANK';
      provider?: PaymentProvider;
      phone?: string;
      bankName?: string;
      accountNumber?: string;
      holderName: string;
      isDefault?: boolean;
    },
  ): Promise<PayoutAccountPublic> {
    await this.assertCanManageAccounts(userId, orgId);
    if (input.type === 'MOBILE_MONEY' && !input.phone) {
      throw new BadRequestException({
        code: 'PHONE_REQUIRED',
        message: 'A mobile money account needs a phone number',
      });
    }
    if (input.type === 'BANK' && (!input.bankName || !input.accountNumber)) {
      throw new BadRequestException({
        code: 'BANK_DETAILS_REQUIRED',
        message: 'A bank account needs a bank name and an account number',
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.payoutAccount.updateMany({
          where: { organizationId: orgId },
          data: { isDefault: false },
        });
      }
      return tx.payoutAccount.create({
        data: {
          organizationId: orgId,
          type: input.type,
          provider: input.type === 'MOBILE_MONEY' ? (input.provider ?? null) : null,
          phone: input.type === 'MOBILE_MONEY' ? (input.phone ?? null) : null,
          bankName: input.type === 'BANK' ? (input.bankName ?? null) : null,
          accountNumber:
            input.type === 'BANK' ? (input.accountNumber ?? null) : null,
          holderName: input.holderName,
          isDefault: input.isDefault ?? false,
        },
      });
    });
    return this.toPublicAccount(created);
  }

  async updateAccount(
    userId: string,
    orgId: string,
    accountId: string,
    input: { isDefault?: boolean; holderName?: string },
  ): Promise<PayoutAccountPublic> {
    await this.assertCanManageAccounts(userId, orgId);
    const account = await this.prisma.payoutAccount.findFirst({
      where: { id: accountId, organizationId: orgId },
    });
    if (!account) {
      throw new NotFoundException({
        code: 'PAYOUT_ACCOUNT_NOT_FOUND',
        message: 'Payout account not found',
      });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.payoutAccount.updateMany({
          where: { organizationId: orgId, id: { not: accountId } },
          data: { isDefault: false },
        });
      }
      return tx.payoutAccount.update({
        where: { id: accountId },
        data: {
          ...(input.isDefault !== undefined
            ? { isDefault: input.isDefault }
            : {}),
          ...(input.holderName !== undefined
            ? { holderName: input.holderName }
            : {}),
        },
      });
    });
    return this.toPublicAccount(updated);
  }

  /**
   * Vérification sandbox : code `1` (micro-dépôt de 1 XAF) ou `000000`
   * (OTP fournisseur simulé).
   */
  async verifyAccount(
    userId: string,
    orgId: string,
    accountId: string,
    code: string,
  ): Promise<PayoutAccountPublic> {
    await this.assertCanManageAccounts(userId, orgId);
    const account = await this.prisma.payoutAccount.findFirst({
      where: { id: accountId, organizationId: orgId },
    });
    if (!account) {
      throw new NotFoundException({
        code: 'PAYOUT_ACCOUNT_NOT_FOUND',
        message: 'Payout account not found',
      });
    }
    if (code !== '1' && code !== '000000') {
      throw new BadRequestException({
        code: 'INVALID_VERIFICATION_CODE',
        message: 'Wrong verification code (sandbox: 1 or 000000)',
      });
    }
    const updated = await this.prisma.payoutAccount.update({
      where: { id: accountId },
      data: { verifiedAt: new Date() },
    });
    return this.toPublicAccount(updated);
  }

  async deleteAccount(
    userId: string,
    orgId: string,
    accountId: string,
  ): Promise<{ id: string }> {
    await this.assertCanManageAccounts(userId, orgId);
    const account = await this.prisma.payoutAccount.findFirst({
      where: { id: accountId, organizationId: orgId },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundException({
        code: 'PAYOUT_ACCOUNT_NOT_FOUND',
        message: 'Payout account not found',
      });
    }
    try {
      await this.prisma.payoutAccount.delete({ where: { id: accountId } });
    } catch {
      throw new ConflictException({
        code: 'PAYOUT_ACCOUNT_IN_USE',
        message: 'This account is referenced by existing payouts',
      });
    }
    return { id: accountId };
  }

  /** GET organizations/:id/payout-settings */
  async getSettings(
    userId: string,
    orgId: string,
  ): Promise<{ payoutFrequency: string; minPayoutAmount: string }> {
    await this.assertCanManageAccounts(userId, orgId);
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { payoutFrequency: true, minPayoutAmount: true },
    });
    return {
      payoutFrequency: org.payoutFrequency,
      minPayoutAmount: new Prisma.Decimal(org.minPayoutAmount).toString(),
    };
  }

  /** PATCH organizations/:id/payout-settings */
  async updateSettings(
    userId: string,
    orgId: string,
    input: { payoutFrequency?: 'MONTHLY' | 'ON_DEMAND'; minPayoutAmount?: number },
  ): Promise<{ payoutFrequency: string; minPayoutAmount: string }> {
    await this.assertCanManageAccounts(userId, orgId);
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(input.payoutFrequency !== undefined
          ? { payoutFrequency: input.payoutFrequency }
          : {}),
        ...(input.minPayoutAmount !== undefined
          ? { minPayoutAmount: input.minPayoutAmount }
          : {}),
      },
      select: { payoutFrequency: true, minPayoutAmount: true },
    });
    return {
      payoutFrequency: org.payoutFrequency,
      minPayoutAmount: new Prisma.Decimal(org.minPayoutAmount).toString(),
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Gestion autorisée : ADMIN/OWNER membre de l'orga, ou propriétaire d'un
   * bien de l'orga (les propriétaires ne sont pas forcément membres).
   */
  private async assertCanManageAccounts(
    userId: string,
    orgId: string,
  ): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      select: { role: true },
    });
    if (
      member &&
      (member.role === OrgMemberRole.ADMIN ||
        member.role === OrgMemberRole.OWNER)
    ) {
      return;
    }
    const owned = await this.prisma.property.findFirst({
      where: { organizationId: orgId, ownerId: userId },
      select: { id: true },
    });
    if (owned) return;
    throw new ForbiddenException({
      code: 'PAYOUT_ACCOUNT_FORBIDDEN',
      message: 'You are not allowed to manage payout accounts',
    });
  }

  private maskAccount(account: PayoutAccountRelation): string {
    if (account.type === 'MOBILE_MONEY' && account.phone) {
      const p = account.phone;
      return p.length <= 6 ? p : `${p.slice(0, 6)}***${p.slice(-2)}`;
    }
    if (account.accountNumber) {
      const n = account.accountNumber;
      return n.length <= 4 ? `****${n}` : `****${n.slice(-4)}`;
    }
    return '—';
  }

  private toPublic(payout: PayoutWithAccount): PayoutPublic {
    const account = payout.payoutAccount;
    return {
      id: payout.id,
      organizationId: payout.organizationId,
      payoutAccountId: payout.payoutAccountId,
      amount: payout.amount.toString(),
      fee: payout.fee.toString(),
      currency: payout.currency,
      kind: payout.kind,
      status: payout.status,
      providerRef: payout.providerRef,
      failureReason: payout.failureReason,
      createdAt: payout.createdAt.toISOString(),
      paidAt: payout.paidAt?.toISOString() ?? null,
      account: account
        ? {
            id: account.id,
            type: account.type,
            holderName: account.holderName,
            bankName: account.bankName,
            masked: this.maskAccount(account),
            isDefault: account.isDefault,
          }
        : null,
    };
  }

  private toPublicAccount(account: {
    id: string;
    organizationId: string;
    type: string;
    provider: string | null;
    phone: string | null;
    bankName: string | null;
    accountNumber: string | null;
    holderName: string;
    verifiedAt: Date | null;
    isDefault: boolean;
    createdAt: Date;
  }): PayoutAccountPublic {
    return {
      id: account.id,
      organizationId: account.organizationId,
      type: account.type,
      provider: account.provider,
      phone: account.phone,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      holderName: account.holderName,
      verifiedAt: account.verifiedAt?.toISOString() ?? null,
      isDefault: account.isDefault,
      createdAt: account.createdAt.toISOString(),
    };
  }
}
