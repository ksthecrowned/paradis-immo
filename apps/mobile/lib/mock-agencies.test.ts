import { describe, expect, test } from 'bun:test';
import {
  getAgency,
  getAgent,
  listAgencies,
  listAgencyReviews,
  listAgentsByAgency,
  listPropertiesByAgency,
  listPropertiesByAgent,
} from './mock-agencies';

describe('mock agencies', () => {
  test('lists at least 3 agencies', () => {
    expect(listAgencies().length).toBeGreaterThanOrEqual(3);
  });

  test('lists official agency first', () => {
    const list = listAgencies();
    expect(list[0]?.id).toBe('ag-paradis-immo');
    expect(list[0]?.isOfficial).toBe(true);
  });

  test('each agency has at least 2 agents', () => {
    for (const agency of listAgencies()) {
      expect(listAgentsByAgency(agency.id).length).toBeGreaterThanOrEqual(2);
    }
  });

  test('properties resolve to known agency and agent', () => {
    const props = listPropertiesByAgency(listAgencies()[0]!.id);
    expect(props.length).toBeGreaterThan(0);
    const agent = getAgent(props[0]!.agentId);
    expect(agent?.agencyId).toBe(props[0]!.agencyId);
    expect(getAgency(props[0]!.agencyId)).toBeDefined();
  });

  test('listPropertiesByAgent returns only that agent', () => {
    const agent = listAgentsByAgency(listAgencies()[0]!.id)[0]!;
    const props = listPropertiesByAgent(agent.id);
    expect(props.every((p) => p.agentId === agent.id)).toBe(true);
  });

  test('listAgencyReviews returns reviews for agency', () => {
    const reviews = listAgencyReviews('ag-paradis-immo');
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews.every((r) => r.agencyId === 'ag-paradis-immo')).toBe(true);
  });
});
