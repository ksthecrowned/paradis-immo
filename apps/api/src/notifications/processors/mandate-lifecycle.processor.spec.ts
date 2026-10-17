import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications.service';
import {DOMAIN_EVENTS} from '../../events/event.types';
import type {DomainEvent} from '../../events/event.types';
import {MandateLifecycleNotificationsProcessor} from './mandate-lifecycle.processor';

function prismaStub(
  mandate: Record<string, unknown> | null,
): PrismaService {
  return {
    mandate: { findUnique: jest.fn().mockResolvedValue(mandate) },
  } as unknown as PrismaService;
}

describe('MandateLifecycleNotificationsProcessor (spec 11)', () => {
  const send = jest.fn(async () => ({ status: 'SENT' as const }));
  const notifications = { send } as unknown as NotificationsService;

  beforeEach(() => {
    send.mockClear();
  });

  function makeOrgMandate(extra = {}): Record<string, unknown> {
    return {
      property: { ownerId: 'owner-user' },
      organization: {
        members: [{ userId: 'gerant-1' }, { userId: 'admin-2' }],
      },
      ...extra,
    };
  }

  it('MANDATE_ACCEPTED notifie la gérance et le propriétaire', async () => {
    const processor = new MandateLifecycleNotificationsProcessor(
      prismaStub(makeOrgMandate()),
      notifications,
    );
    const event = {
      name: DOMAIN_EVENTS.MANDATE_ACCEPTED,
      payload: {
        mandateId: 'mandate-1',
        propertyId: 'property-1',
        organizationId: 'org-1',
      },
      emittedAt: new Date().toISOString(),
      emittedBy: 'system',
    } as unknown as DomainEvent<Record<string, string>>;
    await processor.onAccepted(event as never);

    expect(send).toHaveBeenCalledTimes(3);
    const targets = send.mock.calls.map((c) => c[0].userId);
    expect(targets).toEqual(
      expect.arrayContaining(['gerant-1', 'admin-2', 'owner-user']),
    );
    for (const call of send.mock.calls) {
      expect(call[0].type).toBe('MANDATE_ACCEPTED');
      expect(call[0].payload).toMatchObject({ mandateId: 'mandate-1' });
    }
  });

  it('MANDATE_DECLINED notifie les mêmes parties', async () => {
    const processor = new MandateLifecycleNotificationsProcessor(
      prismaStub(makeOrgMandate()),
      notifications,
    );
    const event = {
      name: DOMAIN_EVENTS.MANDATE_DECLINED,
      payload: { mandateId: 'mandate-1' },
      emittedAt: new Date().toISOString(),
    } as unknown as DomainEvent<Record<string, string>>;
    await processor.onDeclined(event as never);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[0][0].type).toBe('MANDATE_DECLINED');
  });

  it('MANDATE_TERMINATED transmet motif et date d\'effet', async () => {
    const processor = new MandateLifecycleNotificationsProcessor(
      prismaStub(makeOrgMandate()),
      notifications,
    );
    const event = {
      name: DOMAIN_EVENTS.MANDATE_TERMINATED,
      payload: {
        mandateId: 'mandate-1',
        effectiveAt: '2026-11-15T00:00:00.000Z',
        reason: 'AUTRE',
      },
      emittedAt: new Date().toISOString(),
    } as unknown as DomainEvent<Record<string, string>>;
    await processor.onTerminated(event as never);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[0][0].payload).toMatchObject({
      mandateId: 'mandate-1',
      effectiveAt: '2026-11-15T00:00:00.000Z',
      reason: 'AUTRE',
    });
  });

  it('mandat introuvable : aucune notification', async () => {
    const processor = new MandateLifecycleNotificationsProcessor(
      prismaStub(null),
      notifications,
    );
    const event = {
      name: DOMAIN_EVENTS.MANDATE_ACCEPTED,
      payload: { mandateId: 'ghost' },
      emittedAt: new Date().toISOString(),
    } as unknown as DomainEvent<Record<string, string>>;
    await expect(processor.onAccepted(event as never)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('payload sans mandatId : sortie silencieuse sans notification', async () => {
    const processor = new MandateLifecycleNotificationsProcessor(
      prismaStub(makeOrgMandate()),
      notifications,
    );
    const event = {
      name: DOMAIN_EVENTS.MANDATE_ACCEPTED,
      payload: {},
      emittedAt: new Date().toISOString(),
    } as unknown as DomainEvent<Record<string, string>>;
    await expect(processor.onAccepted(event as never)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});
