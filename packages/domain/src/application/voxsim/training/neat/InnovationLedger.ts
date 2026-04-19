/**
 * Per-run global innovation map. Same structural mutation in the same
 * generation reuses the same innovation id across the population, matching
 * Stanley-Miikkulainen NEAT.
 */

import type {
  NeatInnovationConnectionEntry,
  NeatInnovationNodeEntry,
} from '../../../../shared/voxsim/index.js';

interface ConnectionRecord {
  innovation: number;
  sourceNodeId: number;
  targetNodeId: number;
  generation: number;
}

interface NodeRecord {
  innovation: number;
  splitConnectionInnovation: number;
  generation: number;
}

export interface InnovationLedgerSnapshot {
  nextInnovation: number;
  nextNodeId: number;
  connections: Array<ConnectionRecord>;
  nodes: Array<NodeRecord>;
}

function connectionKey(source: number, target: number): string {
  return `${source}->${target}`;
}

export class InnovationLedger {
  private nextInnovation: number;
  private nextNodeId: number;
  private connectionByPair = new Map<string, ConnectionRecord>();
  private nodeBySplit = new Map<number, NodeRecord>();

  constructor(initialInnovation = 1, initialNodeId = 1) {
    this.nextInnovation = initialInnovation;
    this.nextNodeId = initialNodeId;
  }

  /**
   * Bump the node id allocator if a genome has already used a higher id (e.g.
   * after restoring from persistence).
   */
  reserveNodeId(idAtLeast: number): void {
    if (idAtLeast >= this.nextNodeId) {
      this.nextNodeId = idAtLeast + 1;
    }
  }

  reserveInnovation(innovationAtLeast: number): void {
    if (innovationAtLeast >= this.nextInnovation) {
      this.nextInnovation = innovationAtLeast + 1;
    }
  }

  getOrAssignConnectionInnovation(
    sourceNodeId: number,
    targetNodeId: number,
    generation: number,
  ): number {
    const key = connectionKey(sourceNodeId, targetNodeId);
    const existing = this.connectionByPair.get(key);
    if (existing) return existing.innovation;
    const innovation = this.nextInnovation++;
    this.connectionByPair.set(key, {
      innovation,
      sourceNodeId,
      targetNodeId,
      generation,
    });
    return innovation;
  }

  /**
   * Returns the new global node id for the hidden node inserted by splitting
   * `splitConnectionInnovation`. Stable per run.
   */
  getOrAssignNodeInnovation(
    splitConnectionInnovation: number,
    generation: number,
  ): number {
    const existing = this.nodeBySplit.get(splitConnectionInnovation);
    if (existing) return existing.innovation;
    const innovation = this.nextNodeId++;
    this.nodeBySplit.set(splitConnectionInnovation, {
      innovation,
      splitConnectionInnovation,
      generation,
    });
    return innovation;
  }

  snapshotForGeneration(generation: number): {
    addedConnections: NeatInnovationConnectionEntry[];
    addedNodes: NeatInnovationNodeEntry[];
  } {
    const addedConnections: NeatInnovationConnectionEntry[] = [];
    for (const c of this.connectionByPair.values()) {
      if (c.generation === generation) {
        addedConnections.push({
          innovation: c.innovation,
          sourceNodeId: c.sourceNodeId,
          targetNodeId: c.targetNodeId,
        });
      }
    }
    const addedNodes: NeatInnovationNodeEntry[] = [];
    for (const n of this.nodeBySplit.values()) {
      if (n.generation === generation) {
        addedNodes.push({
          innovation: n.innovation,
          splitConnectionInnovation: n.splitConnectionInnovation,
        });
      }
    }
    return { addedConnections, addedNodes };
  }

  serialize(): InnovationLedgerSnapshot {
    return {
      nextInnovation: this.nextInnovation,
      nextNodeId: this.nextNodeId,
      connections: Array.from(this.connectionByPair.values()).map((c) => ({ ...c })),
      nodes: Array.from(this.nodeBySplit.values()).map((n) => ({ ...n })),
    };
  }

  static restore(snapshot: InnovationLedgerSnapshot): InnovationLedger {
    const ledger = new InnovationLedger(snapshot.nextInnovation, snapshot.nextNodeId);
    for (const c of snapshot.connections) {
      ledger.connectionByPair.set(connectionKey(c.sourceNodeId, c.targetNodeId), { ...c });
    }
    for (const n of snapshot.nodes) {
      ledger.nodeBySplit.set(n.splitConnectionInnovation, { ...n });
    }
    return ledger;
  }
}
