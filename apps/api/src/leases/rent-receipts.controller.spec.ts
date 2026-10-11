import { AgencyAccessService } from '../mandates/agency-access.service';
import { RentReceiptService } from './rent-receipt.service';
import { RentReceiptsController } from './rent-receipts.controller';

describe('RentReceiptsController', () => {
  it('does not expose storage keys in the tenant receipt list', async () => {
    const receipts = {
      listForUser: jest.fn().mockResolvedValue([
        {
          id: 'receipt-1',
          number: 'Q-ORG-2026-000001',
          rentScheduleId: 'schedule-1',
          issuerOrgId: 'org-1',
          fileKey: 'private/quittances/secret.pdf',
          issuedAt: '2026-01-05T00:00:00.000Z',
        },
      ]),
    } as unknown as RentReceiptService;
    const controller = new RentReceiptsController(
      receipts,
      {} as AgencyAccessService,
    );

    await expect(
      controller.listMine({ userId: 'tenant-1' } as never),
    ).resolves.toEqual([
      {
        id: 'receipt-1',
        number: 'Q-ORG-2026-000001',
        rentScheduleId: 'schedule-1',
        issuerOrgId: 'org-1',
        issuedAt: '2026-01-05T00:00:00.000Z',
      },
    ]);
  });

  it('authorizes the caller before returning a signed download URL', async () => {
    const receipts = {
      assertCanReadSchedule: jest
        .fn()
        .mockImplementation(async (_userId, _scheduleId, canOperate) =>
          canOperate('agent-1', 'property-1'),
        ),
      getUrlForSchedule: jest
        .fn()
        .mockResolvedValue('https://private.example/signed'),
    } as unknown as RentReceiptService;
    const agencyAccess = {
      assertCanOperateOnProperty: jest.fn().mockResolvedValue(undefined),
    } as unknown as AgencyAccessService;
    const controller = new RentReceiptsController(receipts, agencyAccess);

    await expect(
      controller.getDownload({ userId: 'agent-1' } as never, 'schedule-1'),
    ).resolves.toEqual({ url: 'https://private.example/signed' });
    expect(receipts.assertCanReadSchedule).toHaveBeenCalledWith(
      'agent-1',
      'schedule-1',
      expect.any(Function),
    );
    expect(receipts.getUrlForSchedule).toHaveBeenCalledWith('schedule-1');
    expect(agencyAccess.assertCanOperateOnProperty).toHaveBeenCalledWith(
      'agent-1',
      'property-1',
    );
  });
});
