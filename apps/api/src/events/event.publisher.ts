import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import {
  DomainEvent,
  DomainEventName,
  EventPayloadOf,
} from './event.types';

@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name);

  constructor(private readonly emitter: EventEmitter2) {}

  /**
   * Emit a domain event in-process. Listeners run via `@OnEvent()` handlers.
   * Returns a synthetic event id for backwards compatibility with callers that
   * logged async job ids.
   */
  async emit<E extends DomainEventName>(
    name: E,
    payload: EventPayloadOf<E>,
  ): Promise<{ id: string; name: E }> {
    const event: DomainEvent<EventPayloadOf<E>> = {
      name,
      payload,
      emittedAt: new Date().toISOString(),
    };
    const listeners = this.emitter.listeners(name);
    this.logger.debug(
      `Emitting ${name} to ${listeners.length} listener(s)`,
    );
    await this.emitter.emitAsync(name, event);
    return { id: randomUUID(), name };
  }
}
