import { describe, expect, test } from 'bun:test';
import { emitAccountDeleted, onAccountDeleted } from './account-deleted-signal';

describe('account deleted signal', () => {
  test('notifies every subscriber', () => {
    let first = 0;
    let second = 0;
    const offFirst = onAccountDeleted(() => {
      first += 1;
    });
    const offSecond = onAccountDeleted(() => {
      second += 1;
    });

    emitAccountDeleted();

    expect(first).toBe(1);
    expect(second).toBe(1);
    offFirst();
    offSecond();
  });

  test('unsubscribe stops the notifications', () => {
    let calls = 0;
    const off = onAccountDeleted(() => {
      calls += 1;
    });
    off();

    emitAccountDeleted();

    expect(calls).toBe(0);
  });

  test('a throwing listener does not break the others', () => {
    let reached = 0;
    const offThrowing = onAccountDeleted(() => {
      throw new Error('listener failure');
    });
    const offOk = onAccountDeleted(() => {
      reached += 1;
    });

    expect(() => emitAccountDeleted()).not.toThrow();
    expect(reached).toBe(1);
    offThrowing();
    offOk();
  });
});
