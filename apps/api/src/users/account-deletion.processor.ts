import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ACCOUNT_DELETION_GRACE_PERIOD_DAYS } from './account-deletion.constants';

const BATCH_SIZE = 100;

function anonymizePhone(phone: string): string {
  // Discarding the random salt prevents offline phone-number guessing from the database.
  return createHash('sha256')
    .update(randomBytes(32))
    .update('\0')
    .update(phone)
    .digest('hex');
}

@Injectable()
export class AccountDeletionProcessor {
  private readonly logger = new Logger(AccountDeletionProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: 'Africa/Brazzaville' })
  async handleCron(): Promise<void> {
    const count = await this.anonymizeExpiredAccounts();
    if (count > 0) {
      this.logger.log(`Anonymized ${count} expired deleted accounts`);
    }
  }

  async anonymizeExpiredAccounts(now = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );
    let cursorId: string | undefined;
    let anonymizedCount = 0;

    while (true) {
      const candidates = await this.prisma.user.findMany({
        where: {
          status: 'DELETED',
          deletedAt: { lte: cutoff },
          anonymizedAt: null,
        },
        orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
        take: BATCH_SIZE,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        select: { id: true },
      });
      if (candidates.length === 0) break;

      for (const { id } of candidates) {
        if (await this.anonymizeIfStillEligible(id, cutoff, now)) {
          anonymizedCount += 1;
        }
      }
      cursorId = candidates[candidates.length - 1].id;
    }

    return anonymizedCount;
  }

  private async anonymizeIfStillEligible(
    userId: string,
    cutoff: Date,
    anonymizedAt: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          status: 'DELETED',
          deletedAt: { lte: cutoff },
          anonymizedAt: null,
        },
        select: {
          phone: true,
          phoneHistory: { select: { id: true, phone: true } },
        },
      });
      if (!user) return false;

      const changed = await tx.user.updateMany({
        where: {
          id: userId,
          status: 'DELETED',
          deletedAt: { lte: cutoff },
          anonymizedAt: null,
        },
        data: {
          phone: user.phone ? anonymizePhone(user.phone) : null,
          email: null,
          emailVerifiedAt: null,
          passwordHash: null,
          googleId: null,
          name: null,
          avatarUrl: null,
          fcmToken: null,
          seekerIntent: null,
          seekerExperience: null,
          budgetMinXaf: null,
          budgetMaxXaf: null,
          preferredQuartierIds: [],
          seekerSetupCompletedAt: null,
          marketingOptIn: false,
          anonymizedAt,
        },
      });
      if (changed.count === 0) return false;

      for (const history of user.phoneHistory) {
        await tx.userPhoneHistory.update({
          where: { id: history.id },
          data: { phone: anonymizePhone(history.phone) },
        });
      }

      const phoneNumbers = [
        ...(user.phone ? [user.phone] : []),
        ...user.phoneHistory.map((history) => history.phone),
      ];
      if (phoneNumbers.length > 0) {
        await tx.otpChallenge.deleteMany({
          where: { phone: { in: phoneNumbers } },
        });
      }

      await Promise.all([
        tx.userDevice.deleteMany({ where: { userId } }),
        tx.refreshToken.deleteMany({ where: { userId } }),
        tx.notification.deleteMany({ where: { userId } }),
      ]);

      return true;
    });
  }
}
