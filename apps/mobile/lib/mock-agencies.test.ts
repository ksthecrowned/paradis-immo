import { describe, expect, test } from 'bun:test';
import {
  getAgency,
  getAgent,
  listAgencies,
  listAgentsByAgency,
  listPropertiesByAgency,
  listPropertiesByAgent,
} from './mock-agencies';

describe('mock agencies', () => {
  test('lists at least 3 agencies', () => {
    expect(listAgencies().length).toBeGreaterThanOrEqual(3);
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
});
