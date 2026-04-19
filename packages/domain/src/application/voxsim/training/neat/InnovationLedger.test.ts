import { describe, expect, it } from 'bun:test';

import { InnovationLedger } from './InnovationLedger.js';

describe('InnovationLedger', () => {
  it('returns the same innovation for the same (source, target) pair within a run', () => {
    const ledger = new InnovationLedger();
    const a = ledger.getOrAssignConnectionInnovation(1, 2, 0);
    const b = ledger.getOrAssignConnectionInnovation(1, 2, 1);
    expect(a).toBe(b);
  });

  it('assigns different innovations to different pairs', () => {
    const ledger = new InnovationLedger();
    const a = ledger.getOrAssignConnectionInnovation(1, 2, 0);
    const b = ledger.getOrAssignConnectionInnovation(2, 3, 0);
    expect(a).not.toBe(b);
  });

  it('returns the same node innovation for the same split connection', () => {
    const ledger = new InnovationLedger();
    const splitInnovation = ledger.getOrAssignConnectionInnovation(1, 5, 0);
    const a = ledger.getOrAssignNodeInnovation(splitInnovation, 0);
    const b = ledger.getOrAssignNodeInnovation(splitInnovation, 1);
    expect(a).toBe(b);
  });

  it('snapshotForGeneration only returns entries from the requested generation', () => {
    const ledger = new InnovationLedger();
    ledger.getOrAssignConnectionInnovation(1, 2, 0);
    ledger.getOrAssignConnectionInnovation(2, 3, 1);
    const gen0 = ledger.snapshotForGeneration(0);
    const gen1 = ledger.snapshotForGeneration(1);
    expect(gen0.addedConnections.length).toBe(1);
    expect(gen1.addedConnections.length).toBe(1);
    expect(gen0.addedConnections[0]!.sourceNodeId).toBe(1);
    expect(gen1.addedConnections[0]!.sourceNodeId).toBe(2);
  });

  it('serialize/restore round trip preserves assignments', () => {
    const ledger = new InnovationLedger();
    const a = ledger.getOrAssignConnectionInnovation(1, 2, 0);
    const split = ledger.getOrAssignConnectionInnovation(2, 3, 0);
    const node = ledger.getOrAssignNodeInnovation(split, 0);

    const restored = InnovationLedger.restore(ledger.serialize());
    expect(restored.getOrAssignConnectionInnovation(1, 2, 9)).toBe(a);
    expect(restored.getOrAssignNodeInnovation(split, 9)).toBe(node);
    // new pair gets a fresh id higher than any existing
    expect(restored.getOrAssignConnectionInnovation(9, 10, 9)).toBeGreaterThan(a);
  });

  it('reserveNodeId bumps the allocator above existing ids', () => {
    const ledger = new InnovationLedger();
    ledger.reserveNodeId(50);
    const id = ledger.getOrAssignNodeInnovation(123, 0);
    expect(id).toBe(51);
  });
});
