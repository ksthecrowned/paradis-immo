import { describe, expect, test } from 'bun:test';
import { listProspectPipeline } from './mock-activity';

describe('listProspectPipeline', () => {
  test('has upcoming visits and in-progress rows', () => {
    const sections = listProspectPipeline();
    expect(sections.map((s) => s.key)).toEqual(['upcoming', 'in_progress']);
    expect(sections[0]!.items.every((i) => i.segment === 'visits')).toBe(true);
    expect(sections[1]!.items.length).toBeGreaterThan(0);
    expect(
      sections[1]!.items.every((i) =>
        ['bookings', 'sales', 'payments'].includes(i.segment),
      ),
    ).toBe(true);
  });
});
