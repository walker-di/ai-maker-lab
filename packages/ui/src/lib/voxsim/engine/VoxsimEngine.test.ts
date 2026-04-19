import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_GRAVITY,
  DEFAULT_VOXEL_SIZE,
  type ArenaDefinition,
  type Chunk,
} from '../types.js';
import { ordinalForVoxelKind } from '../types.js';
import { COMPONENT_KINDS, type TransformComponent } from './components.js';
import { VoxsimEngine } from './VoxsimEngine.js';
import { ScriptedInputSource } from './input.js';
import type { System, SystemContext } from './world.js';
import {
  MORPHOLOGY_COMPONENT_KINDS,
  type AgentComponent,
} from '../morphology/components.js';
import type { ActivationFrame, PolicyNetwork } from '../brain/policy.js';
import type { NeatGenome } from '../brain/types.js';

class StubPolicy implements PolicyNetwork {
  disposeCount = 0;
  resetCount = 0;
  async init(): Promise<void> {}
  setWeights(): void {}
  getWeights(): Float32Array { return new Float32Array(); }
  setGenome(_g: NeatGenome): void {}
  getGenome(): NeatGenome { throw new Error('nope'); }
  act(_o: Float32Array, scratch: Float32Array): void {
    scratch.fill(0.25);
  }
  actBatch(): void {}
  resetEpisodeState(): void { this.resetCount++; }
  tap(_cb: (frame: ActivationFrame) => void) { return { dispose: () => {} }; }
  dispose(): void { this.disposeCount++; }
}

function makeChunk(originX = 0, originZ = 0): Chunk {
  const voxels = new Uint8Array(DEFAULT_CHUNK_SIZE.sx * DEFAULT_CHUNK_SIZE.sy * DEFAULT_CHUNK_SIZE.sz);
  // Fill the bottom layer with `solid` voxels for visual sanity.
  const solid = ordinalForVoxelKind('solid');
  for (let z = 0; z < DEFAULT_CHUNK_SIZE.sz; z++) {
    for (let x = 0; x < DEFAULT_CHUNK_SIZE.sx; x++) {
      voxels[x + DEFAULT_CHUNK_SIZE.sx * (0 + DEFAULT_CHUNK_SIZE.sy * z)] = solid;
    }
  }
  return {
    id: `chunk:${originX}_0_${originZ}`,
    chunkOrigin: { cx: originX, cy: 0, cz: originZ },
    size: DEFAULT_CHUNK_SIZE,
    voxels,
  };
}

function makeArena(): ArenaDefinition {
  return {
    id: 'arena-1',
    version: 1,
    chunkSize: DEFAULT_CHUNK_SIZE,
    voxelSize: DEFAULT_VOXEL_SIZE,
    bounds: { min: { cx: 0, cy: 0, cz: 0 }, max: { cx: 1, cy: 0, cz: 1 } },
    chunks: [makeChunk(0, 0), makeChunk(1, 0)],
    spawns: [
      {
        id: 'spawn-1',
        tag: 'biped',
        pose: { position: { x: 1, y: 2, z: 1 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      },
    ],
    entities: [],
    gravity: DEFAULT_GRAVITY,
    skybox: 'default',
  };
}

describe('VoxsimEngine', () => {
  test('constructs in headless mode without WebGL', () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    expect(engine.scene).toBeDefined();
    expect(engine.layers.arena).toBeDefined();
    expect(engine.layers.agents).toBeDefined();
    expect(engine.layers.entities).toBeDefined();
    expect(engine.layers.debug).toBeDefined();
    expect(engine.layers.overlay).toBeDefined();
    expect(engine.layers.hud).toBeDefined();
    engine.dispose();
  });

  test('attaches layer groups in declared z-order', () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    const groupNames = engine.scene.children
      .filter((child) => child.type === 'Group')
      .map((g) => g.name);
    const ordered = groupNames.filter((n) => n.startsWith('voxsim:'));
    expect(ordered).toEqual([
      'voxsim:arena',
      'voxsim:agents',
      'voxsim:entities',
      'voxsim:debug',
      'voxsim:overlay',
      'voxsim:hud',
    ]);
    engine.dispose();
  });

  test('loadArena builds chunk meshes and attaches them to the arena layer', async () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    let loadedEvent: { arenaId: string; chunkCount: number } | null = null;
    engine.on('arenaLoaded', (e) => { loadedEvent = e; });

    await engine.loadArena(makeArena());
    expect(loadedEvent).toEqual({ arenaId: 'arena-1', chunkCount: 2 });
    expect(engine.layers.arena.children.length).toBeGreaterThan(0);
    engine.dispose();
  });

  test('unloadArena removes chunk meshes and emits arenaUnloaded', async () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    let unloaded: { arenaId: string } | null = null;
    engine.on('arenaUnloaded', (e) => { unloaded = e; });

    await engine.loadArena(makeArena());
    await engine.unloadArena();
    expect(unloaded).toEqual({ arenaId: 'arena-1' });
    expect(engine.layers.arena.children.length).toBe(0);
    engine.dispose();
  });

  test('loadArena replaces the previous arena before building the new one', async () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    await engine.loadArena(makeArena());
    const firstCount = engine.layers.arena.children.length;
    await engine.loadArena({ ...makeArena(), id: 'arena-2' });
    expect(engine.layers.arena.children.length).toBe(firstCount);
    expect(engine.getCurrentArena()?.id).toBe('arena-2');
    engine.dispose();
  });

  test('tickFixed advances simulation state deterministically', () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    let stepCount = 0;
    const sys: System = {
      update(_world, _dt, _ctx: SystemContext) {
        stepCount++;
      },
    };
    engine.registerSystem(sys);
    engine.tickFixed();
    engine.tickFixed();
    engine.tickFixed();
    expect(stepCount).toBe(3);
    engine.dispose();
  });

  test('emits simStep with a monotonically increasing index', () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    const indices: number[] = [];
    engine.on('simStep', (e) => indices.push(e.stepIndex));
    engine.tickFixed();
    engine.tickFixed();
    engine.tickFixed();
    expect(indices.length).toBe(3);
    expect(indices[1]!).toBeGreaterThanOrEqual(indices[0]!);
    expect(indices[2]!).toBeGreaterThanOrEqual(indices[1]!);
    engine.dispose();
  });

  test('getRenderSnapshot reflects entity transforms after a step', async () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    await engine.loadArena(makeArena());
    const e = engine.world.createEntity('agent-1');
    engine.world.addComponent<TransformComponent>(e, COMPONENT_KINDS.transform, {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    });
    engine.world.addComponent(e, COMPONENT_KINDS.renderMesh, {
      meshId: 'agent.debugBox',
      visible: true,
    });
    engine.tickFixed();
    const snap = engine.getRenderSnapshot();
    const agent = snap.entities.find((x) => x.tag === 'agent-1');
    expect(agent).toBeDefined();
    expect(agent!.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(agent!.meshId).toBe('agent.debugBox');
    engine.dispose();
  });

  test('input source is polled before each fixed step', () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    const input = new ScriptedInputSource();
    engine.setInput(input);
    let polls = 0;
    const wrapped = {
      pollFixed: () => { polls++; return input.pollFixed(); },
      dispose: () => input.dispose(),
    };
    engine.setInput(wrapped);
    engine.tickFixed();
    engine.tickFixed();
    expect(polls).toBe(2);
    engine.dispose();
  });

  test('start/stop is idempotent without window', () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    engine.start();
    expect(engine.isRunning()).toBe(true);
    engine.stop();
    expect(engine.isRunning()).toBe(false);
    engine.dispose();
  });

  test('attachPolicy stores handle on AgentComponent and resolvePolicy returns the policy', () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    const agent = engine.world.createEntity('agent');
    const agentComp: AgentComponent = {
      bodyDnaId: 'b',
      brainDnaId: 'br1',
      observation: new Float32Array(2),
      action: new Float32Array(2),
      alive: true,
      stepsSinceSpawn: 0,
      energyUsed: 0,
    };
    engine.world.addComponent<AgentComponent>(agent, MORPHOLOGY_COMPONENT_KINDS.agent, agentComp);
    const policy = new StubPolicy();
    const handle = engine.attachPolicy(agent, policy);
    expect(handle).toMatch(/^policy-/);
    expect(agentComp.policyHandle).toBe(handle);
    expect(engine.resolvePolicy(handle)).toBe(policy);
    expect(engine.getActiveBrainDnaIds()).toEqual(['br1']);
    engine.detachPolicy(agent);
    expect(agentComp.policyHandle).toBeUndefined();
    expect(engine.resolvePolicy(handle)).toBeUndefined();
    engine.dispose();
  });

  test('resetEpisodeStateForAllPolicies fans out to every attached policy', () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    const agent = engine.world.createEntity('agent');
    engine.world.addComponent<AgentComponent>(agent, MORPHOLOGY_COMPONENT_KINDS.agent, {
      bodyDnaId: 'b',
      brainDnaId: 'b',
      observation: new Float32Array(),
      action: new Float32Array(),
      alive: true,
      stepsSinceSpawn: 0,
      energyUsed: 0,
    });
    const policy = new StubPolicy();
    engine.attachPolicy(agent, policy);
    engine.resetEpisodeStateForAllPolicies();
    expect(policy.resetCount).toBe(1);
    engine.dispose();
    expect(policy.disposeCount).toBe(1);
  });

  test('dispose cleans up scene layers and emitter listeners', async () => {
    const engine = new VoxsimEngine({ mode: 'preview' });
    let received = 0;
    engine.on('arenaLoaded', () => received++);
    await engine.loadArena(makeArena());
    expect(received).toBe(1);
    engine.dispose();
    expect(engine.scene.children.length).toBe(0);
  });
});
