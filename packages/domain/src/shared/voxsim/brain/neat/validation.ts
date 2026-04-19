/**
 * Validation rules for `NeatGenome`. Run through `validateBrainDna(dna,
 * genome)` so the topology context (NEAT vs HyperNEAT vs NEAT-LSTM) is
 * available.
 */

import type { BrainDna } from '../brain-dna.js';
import type { NeatConnectionGene, NeatGenome, NeatNodeGene } from './neat-genome.js';
import { CPPN_ONLY_ACTIVATIONS } from './neat-activations.js';

export interface NeatGenomeValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface NeatGenomeValidationResult {
  ok: boolean;
  issues: NeatGenomeValidationIssue[];
}

function hasCycle(
  nodeIds: ReadonlySet<number>,
  edges: ReadonlyArray<NeatConnectionGene>,
): boolean {
  // DFS over enabled edges only.
  const adj = new Map<number, number[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    if (!e.enabled) continue;
    const list = adj.get(e.sourceNodeId);
    if (list) list.push(e.targetNodeId);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<number, number>();
  for (const id of nodeIds) color.set(id, WHITE);
  for (const id of nodeIds) {
    if (color.get(id) !== WHITE) continue;
    const stack: Array<{ node: number; index: number }> = [{ node: id, index: 0 }];
    color.set(id, GRAY);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = adj.get(frame.node) ?? [];
      if (frame.index >= neighbors.length) {
        color.set(frame.node, BLACK);
        stack.pop();
        continue;
      }
      const next = neighbors[frame.index++];
      const c = color.get(next);
      if (c === GRAY) return true;
      if (c === WHITE) {
        color.set(next, GRAY);
        stack.push({ node: next, index: 0 });
      }
    }
  }
  return false;
}

export function validateNeatGenome(
  genome: NeatGenome,
  dna: BrainDna,
): NeatGenomeValidationResult {
  const issues: NeatGenomeValidationIssue[] = [];
  const nodeMap = new Map<number, NeatNodeGene>();
  for (let i = 0; i < genome.nodes.length; i++) {
    const node = genome.nodes[i];
    if (nodeMap.has(node.id)) {
      issues.push({
        code: 'duplicate_node_id',
        message: `node id ${node.id} appears more than once`,
        path: `nodes[${i}]`,
      });
    } else {
      nodeMap.set(node.id, node);
    }
    if (!Number.isFinite(node.bias)) {
      issues.push({
        code: 'bias_not_finite',
        message: 'node.bias must be finite',
        path: `nodes[${i}]`,
      });
    }
    if (node.kind === 'lstm' && dna.topology !== 'neatLstm') {
      issues.push({
        code: 'lstm_node_in_non_lstm_topology',
        message: 'lstm nodes are only allowed when topology = "neatLstm"',
        path: `nodes[${i}]`,
      });
    }
    if (node.kind !== 'lstm' && CPPN_ONLY_ACTIVATIONS.has(node.activation as never)) {
      if (dna.topology !== 'hyperNeat') {
        issues.push({
          code: 'cppn_only_activation_in_non_hyperneat',
          message: `activation ${node.activation} is only allowed in hyperNeat topology`,
          path: `nodes[${i}]`,
        });
      }
    }
    // Input/output binding id checks (skip for HyperNEAT: those are CPPN substrate-coordinate inputs).
    if (dna.topology !== 'hyperNeat') {
      if (node.kind === 'input') {
        if (!node.inputBindingId) {
          issues.push({
            code: 'input_node_missing_binding',
            message: 'input node must have inputBindingId',
            path: `nodes[${i}]`,
          });
        } else {
          const found = dna.inputEncoder.inputs.some((b) => b.sensorId === node.inputBindingId);
          if (!found) {
            issues.push({
              code: 'input_binding_unknown_sensor_id',
              message: `inputBindingId ${node.inputBindingId} not present in InputEncoder`,
              path: `nodes[${i}]`,
            });
          }
        }
      }
      if (node.kind === 'output') {
        if (!node.outputBindingId) {
          issues.push({
            code: 'output_node_missing_binding',
            message: 'output node must have outputBindingId',
            path: `nodes[${i}]`,
          });
        } else {
          const found = dna.outputDecoder.outputs.some((b) => b.actuatorId === node.outputBindingId);
          if (!found) {
            issues.push({
              code: 'output_binding_unknown_actuator_id',
              message: `outputBindingId ${node.outputBindingId} not present in OutputDecoder`,
              path: `nodes[${i}]`,
            });
          }
        }
      }
    }
  }

  for (let i = 0; i < genome.connections.length; i++) {
    const conn = genome.connections[i];
    const path = `connections[${i}]`;
    if (!Number.isFinite(conn.weight)) {
      issues.push({ code: 'weight_not_finite', message: 'connection weight must be finite', path });
    }
    const src = nodeMap.get(conn.sourceNodeId);
    const tgt = nodeMap.get(conn.targetNodeId);
    if (!src) {
      issues.push({
        code: 'unknown_source_node',
        message: `unknown sourceNodeId ${conn.sourceNodeId}`,
        path,
      });
    }
    if (!tgt) {
      issues.push({
        code: 'unknown_target_node',
        message: `unknown targetNodeId ${conn.targetNodeId}`,
        path,
      });
    }
    if (tgt && (tgt.kind === 'input' || tgt.kind === 'bias')) {
      issues.push({
        code: 'connection_targets_input',
        message: 'connection target may not be an input or bias node',
        path,
      });
    }
    if (src && src.kind === 'output') {
      issues.push({
        code: 'connection_sourced_from_output',
        message: 'connection source may not be an output node',
        path,
      });
    }
    if (conn.lstmGate) {
      if (dna.topology !== 'neatLstm') {
        issues.push({
          code: 'lstm_gate_in_non_lstm_topology',
          message: 'lstmGate is only allowed in neatLstm topology',
          path,
        });
      } else if (tgt && tgt.kind !== 'lstm') {
        issues.push({
          code: 'lstm_gate_target_not_lstm',
          message: 'lstmGate is only allowed when target node is an lstm node',
          path,
        });
      }
    }
  }

  if (!dna.neat?.allowRecurrent) {
    const enabled = genome.connections.filter((c) => c.enabled);
    if (hasCycle(new Set(nodeMap.keys()), enabled)) {
      issues.push({
        code: 'cyclic_graph_with_recurrence_disabled',
        message: 'enabled connection graph contains a cycle but allowRecurrent is false',
      });
    }
  }

  return { ok: issues.length === 0, issues };
}
