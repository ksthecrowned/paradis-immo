import type { PrismaService } from '../prisma/prisma.service';
import { AccountDeletionProcessor } from './account-deletion.processor';

describe('AccountDeletionProcessor', () => {
  const userId = 'deleted-user-id';
  const phone = '+242060000000';
  const phoneHistory = [{ id: 'phone-history-id', phone: '+242061111111' }];
  const anonymizedAt = new Date('2026-10-16T02:00:00.000Z');
  const transaction = {
    user: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    userPhoneHistory: { update: jest.fn() },
    otpChallenge: { deleteMany: jest.fn() },
    userDevice: { deleteMany: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    notification: { deleteMany: jest.fn() },
  };
  const prisma = {
    user: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  let processor: AccountDeletionProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(transaction));
    transaction.user.findFirst.mockResolvedValue({ phone, phoneHistory });
    transaction.user.updateMany.mockResolvedValue({ count: 1 });
    transaction.userPhoneHistory.update.mockResolvedValue({});
    transaction.otpChallenge.deleteMany.mockResolvedValue({ count: 1 });
    transaction.userDevice.deleteMany.mockResolvedValue({ count: 1 });
    transaction.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
    transaction.notification.deleteMany.mockResolvedValue({ count: 1 });
    prisma.user.findMany.mockResolvedValue([]);
    processor = new AccountDeletionProcessor(
      prisma as unknown as PrismaService,
    );
  });

  it('anonymizes eligible profiles and removes authentication and push data', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: userId }])
      .mockResolvedValueOnce([]);

    await expect(
      processor.anonymizeExpiredAccounts(anonymizedAt),
    ).resolves.toBe(1);

    const cutoff = new Date(anonymizedAt.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(prisma.user.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          status: 'DELETED',
          deletedAt: { lte: cutoff },
          anonymizedAt: null,
        },
      }),
    );
    expect(transaction.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: userId,
          status: 'DELETED',
          deletedAt: { lte: cutoff },
          anonymizedAt: null,
        }),
      }),
    );

    const update = transaction.user.updateMany.mock.calls[0][0];
    expect(update.data).toEqual(
      expect.objectContaining({
        email: null,
        emailVerifiedAt: null,
        passwordHash: null,
        googleId: null,
        name: null,
        avatarUrl: null,
        fcmToken: null,
        preferredQuartierIds: [],
        marketingOptIn: false,
        anonymizedAt,
      }),
    );
    expect(update.data.phone).toMatch(/^[a-f0-9]{64}$/);
    expect(update.data.phone).not.toBe(phone);

    const historyUpdate = transaction.userPhoneHistory.update.mock.calls[0][0];
    expect(historyUpdate.where.id).toBe(phoneHistory[0].id);
    expect(historyUpdate.data.phone).toMatch(/^[a-f0-9]{64}$/);
    expect(historyUpdate.data.phone).not.toBe(phoneHistory[0].phone);
    expect(transaction.otpChallenge.deleteMany).toHaveBeenCalledWith({
      where: { phone: { in: [phone, phoneHistory[0].phone] } },
    });
    expect(transaction.userDevice.deleteMany).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(transaction.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(transaction.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId },
    });
  });

  it('does not process accounts before the 30-day grace period', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await expect(
      processor.anonymizeExpiredAccounts(anonymizedAt),
    ).resolves.toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('is idempotent and does not re-anonymize processed accounts', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: userId }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    transaction.user.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      processor.anonymizeExpiredAccounts(anonymizedAt),
    ).resolves.toBe(1);
    await expect(
      processor.anonymizeExpiredAccounts(anonymizedAt),
    ).resolves.toBe(0);
    expect(transaction.user.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not clean related data if deletion was cancelled during processing', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: userId }])
      .mockResolvedValueOnce([]);
    transaction.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      processor.anonymizeExpiredAccounts(anonymizedAt),
    ).resolves.toBe(0);
    expect(transaction.userDevice.deleteMany).not.toHaveBeenCalled();
    expect(transaction.refreshToken.deleteMany).not.toHaveBeenCalled();
    expect(transaction.notification.deleteMany).not.toHaveBeenCalled();
  });
});
