import { FcmService } from './fcm.service';

describe('FcmService', () => {
  const original = process.env.FCM_CREDENTIALS;

  afterEach(() => {
    if (original === undefined) delete process.env.FCM_CREDENTIALS;
    else process.env.FCM_CREDENTIALS = original;
  });

  it('returns NOT_CONFIGURED when messaging is unavailable', async () => {
    delete process.env.FCM_CREDENTIALS;
    const service = new FcmService();
    service.onModuleInit();
    const result = await service.sendPush('token', 'Title', 'Body');
    expect(result).toEqual({ ok: false, reason: 'NOT_CONFIGURED' });
  });

  it('returns ok with messageId on successful send', async () => {
    const service = new FcmService();
    service.setMessagingForTests({
      send: jest.fn().mockResolvedValue('projects/x/messages/1'),
    } as never);

    const result = await service.sendPush(
      'device-token',
      'Hello',
      'World',
      { type: 'RENT_DUE_SOON' },
    );
    expect(result).toEqual({ ok: true, messageId: 'projects/x/messages/1' });
  });

  it('maps unregistered token to INVALID_TOKEN', async () => {
    const service = new FcmService();
    service.setMessagingForTests({
      send: jest.fn().mockRejectedValue({
        code: 'messaging/registration-token-not-registered',
        message: 'Requested entity was not found.',
      }),
    } as never);

    const result = await service.sendPush('stale', 'T', 'B');
    expect(result).toEqual({ ok: false, reason: 'INVALID_TOKEN' });
  });
});
