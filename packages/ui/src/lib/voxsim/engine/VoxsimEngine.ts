import {
  AmbientLight,
  Color,
  DirectionalLight,
  Scene,
  type PerspectiveCamera,
} from 'three';

import type { ArenaDefinition } from '../types.js';
import { AssetRegistry, type AssetBundle } from './asset-registry.js';
import { OrbitCamera } from './camera.js';
import { ChunkMeshBuilder, type ChunkMeshes } from './chunk-mesh-builder.js';
import { COMPONENT_KINDS, type CameraComponent, type TransformComponent } from './components.js';
import { EngineEmitter, type EngineEventMap } from './events.js';
import { FixedStepLoop } from './fixed-step-loop.js';
import { createEmptyInputState, type InputSource, type InputState } from './input.js';
import { attachSceneLayers, disposeSceneLayers, type SceneLayers } from './layers.js';
import {
  emptyRenderSnapshot,
  type RenderSnapshot,
  type RenderSnapshotEntity,
} from './render-snapshot.js';
import { NullRenderer, type EngineRenderer } from './renderer.js';
import { NullPhysicsSystem } from './physics/null-physics.js';
import type { IPhysicsSystem, PhysicsSnapshot } from './physics/types.js';
import { EngineWorld, SystemEventBus, type Entity, type System, type SystemContext } from './world.js';
import {
  MORPHOLOGY_COMPONENT_KINDS,
  type AgentComponent,
} from '../morphology/components.js';
import type { PolicyNetwork } from '../brain/policy.js';

export type PolicyHandle = string;

export type EngineMode = 'play' | 'preview' | 'editor';

export interface VoxsimEngineConfig {
  mode: EngineMode;
  assetBundleId?: string;
  fixedStepHz?: number;
  pixelRatio?: number;
  /**
   * Optional renderer factory. The default is `NullRenderer` so the engine
   * stays headless until `mount(canvas)` is invoked with a renderer factory
   * registered via `setRendererFactory`.
   */
  rendererFactory?: () => Promise<EngineRenderer>;
  assetRegistry?: AssetRegistry;
  /**
   * Optional physics system. When omitted the engine uses `NullPhysicsSystem`
   * so headless tests, the editor preview, and the replay viewer all run
   * without loading the Jolt WASM module. Plan 02 (`JoltSystem`) is the
   * production implementation; pass it here in app code.
   */
  physics?: IPhysicsSystem;
}

/**
 * The voxsim engine. Owns the Three `Scene`, the ECS world, the fixed-step
 * accumulator, the chunk mesh cache, the orbit camera, and the layered scene
 * model. Exposes a small framework-free surface that the desktop app, the
 * future arena editor, the replay viewer, and tests all consume the same way.
 *
 * Plan 01 deliberately keeps the engine surface narrow. Physics body creation
 * (plan 02), morphology systems (plan 03), brain inference (plan 04), and
 * persistence wiring (plan 07) live in their dedicated modules and bind to
 * the engine through reserved component kinds and the `IPhysicsSystem` slot.
 */
export class VoxsimEngine {
  readonly emitter = new EngineEmitter();
  readonly world = new EngineWorld();
  readonly assets: AssetRegistry;
  readonly orbitCamera = new OrbitCamera({ aspect: 1 });

  /** Three scene; constructed eagerly so headless code can read the layers. */
  readonly scene = new Scene();
  /** Layered scene groups. Downstream plans add and remove children directly. */
  readonly layers: SceneLayers;

  private readonly mode: EngineMode;
  private readonly bundle: AssetBundle;
  private readonly bus = new SystemEventBus();
  private readonly loop: FixedStepLoop;
  private readonly pixelRatio?: number;

  private rendererFactory?: () => Promise<EngineRenderer>;
  private renderer: EngineRenderer = new NullRenderer();
  private mounted = false;

  private physics: IPhysicsSystem;
  private physicsInitialized = false;
  private latestPhysicsSnapshot: PhysicsSnapshot = { bodies: [], stepIndex: 0 };

  private chunkMeshBuilder: ChunkMeshBuilder | null = null;
  private chunkMeshes = new Map<string, ChunkMeshes>();

  private currentArena: ArenaDefinition | null = null;
  private inputSource: InputSource | null = null;
  private currentInput: InputState = createEmptyInputState();
  private systems: System[] = [];

  private cameraEntity: number | null = null;
  private running = false;
  private nextPolicyHandle = 1;
  private readonly policiesByHandle = new Map<PolicyHandle, PolicyNetwork>();
  private readonly policyHandleByAgent = new Map<Entity, PolicyHandle>();
  private rafHandle: number | null = null;
  private lastFrameMs = 0;
  private lastFps = 0;

  constructor(config: VoxsimEngineConfig) {
    this.mode = config.mode;
    this.assets = config.assetRegistry ?? new AssetRegistry();
    this.bundle = this.assets.resolve(config.assetBundleId ?? 'default');
    this.loop = new FixedStepLoop({ hz: config.fixedStepHz ?? 60 });
    this.pixelRatio = config.pixelRatio;
    this.rendererFactory = config.rendererFactory;
    this.physics = config.physics ?? new NullPhysicsSystem();

    this.scene.background = new Color(0x202535);
    this.layers = attachSceneLayers(this.scene);
    this.installDefaultLights();
    this.installDefaultCameraEntity();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  setRendererFactory(factory: () => Promise<EngineRenderer>): void {
    this.rendererFactory = factory;
  }

  async mount(canvas: HTMLCanvasElement): Promise<void> {
    if (this.mounted) return;
    if (this.rendererFactory) {
      this.renderer = await this.rendererFactory();
      await this.renderer.mount(canvas);
      const w = canvas.clientWidth || canvas.width || 1;
      const h = canvas.clientHeight || canvas.height || 1;
      this.renderer.resize(w, h, this.pixelRatio);
      this.orbitCamera.setAspect(w / Math.max(1, h));
    }
    this.mounted = true;
  }

  async loadArena(arena: ArenaDefinition): Promise<void> {
    if (this.currentArena) await this.unloadArena();
    this.currentArena = arena;
    this.bundle satisfies AssetBundle;
    this.chunkMeshBuilder = new ChunkMeshBuilder({
      bundle: this.bundle,
      voxelSize: arena.voxelSize,
    });
    for (const chunk of arena.chunks) {
      const built = this.chunkMeshBuilder.build(chunk);
      this.chunkMeshes.set(chunk.id, built);
      for (const entry of built.meshes) this.layers.arena.add(entry.mesh);
    }
    if (!this.physicsInitialized) {
      await this.physics.init({ gravity: arena.gravity });
      this.physicsInitialized = true;
    }
    this.physics.loadArenaColliders(arena);
    this.frameOrbitCameraOnArena(arena);
    this.emitter.emit('arenaLoaded', { arenaId: arena.id, chunkCount: arena.chunks.length });
  }

  async unloadArena(): Promise<void> {
    const arena = this.currentArena;
    if (!arena) return;
    for (const entry of this.chunkMeshes.values()) {
      for (const mesh of entry.meshes) {
        mesh.mesh.removeFromParent();
        mesh.mesh.dispose();
      }
    }
    this.chunkMeshes.clear();
    this.chunkMeshBuilder?.dispose();
    this.chunkMeshBuilder = null;
    this.layers.agents.clear();
    this.layers.entities.clear();
    this.layers.debug.clear();
    this.layers.overlay.clear();
    this.physics.unloadArenaColliders();
    this.currentArena = null;
    this.emitter.emit('arenaUnloaded', { arenaId: arena.id });
  }

  /** Returns the physics system (Jolt or Null). Used by morphology and replay tools. */
  getPhysics(): IPhysicsSystem {
    return this.physics;
  }

  /** Returns the latest physics snapshot captured during the most recent fixed step. */
  getPhysicsSnapshot(): PhysicsSnapshot {
    return this.latestPhysicsSnapshot;
  }

  setInput(source: InputSource): void {
    this.inputSource?.dispose();
    this.inputSource = source;
  }

  registerSystem(system: System): void {
    this.systems.push(system);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.lastFrameMs = performance.now();
      const frame = (now: number) => {
        if (!this.running) return;
        const dt = Math.min(0.1, (now - this.lastFrameMs) / 1000);
        this.lastFps = dt > 0 ? 1 / dt : 0;
        this.lastFrameMs = now;
        this.tickReal(dt);
        this.rafHandle = window.requestAnimationFrame(frame);
      };
      this.rafHandle = window.requestAnimationFrame(frame);
    }
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  dispose(): void {
    this.stop();
    void this.unloadArena();
    this.inputSource?.dispose();
    this.inputSource = null;
    disposeSceneLayers(this.scene, this.layers);
    this.renderer.dispose();
    this.renderer = new NullRenderer();
    if (this.physicsInitialized) {
      this.physics.dispose();
      this.physicsInitialized = false;
    }
    this.emitter.removeAll();
    for (const policy of this.policiesByHandle.values()) policy.dispose();
    this.policiesByHandle.clear();
    this.policyHandleByAgent.clear();
    this.world.clear();
    this.systems = [];
  }

  // ---------------------------------------------------------------------------
  // Tick & render
  // ---------------------------------------------------------------------------

  /** Headless-friendly tick of a single fixed step. Tests and workers use this. */
  tickFixed(stepMs?: number): void {
    if (stepMs !== undefined) {
      const stepDt = stepMs / 1000;
      this.runFixedStep(stepDt);
    } else {
      this.runFixedStep(this.loop.stepDt);
      this.loop.step(() => {});
    }
  }

  /** Drives systems for `seconds` of real time using the fixed-step loop. */
  tickReal(seconds: number): void {
    this.loop.tick(seconds, () => this.runFixedStep(this.loop.stepDt));
    this.renderFrame(this.loop.alpha());
  }

  /**
   * Capture the latest interpolated render snapshot. Used by the inspector,
   * the replay viewer (plan 06), and tests. Idempotent.
   */
  getRenderSnapshot(): RenderSnapshot {
    if (!this.currentArena) return emptyRenderSnapshot();

    const entities: RenderSnapshotEntity[] = [];
    for (const id of this.world.query([COMPONENT_KINDS.transform])) {
      const tr = this.world.getComponent<TransformComponent>(id, COMPONENT_KINDS.transform);
      if (!tr) continue;
      const renderable = this.world.getComponent<{ meshId: string; visible: boolean }>(
        id,
        COMPONENT_KINDS.renderMesh,
      );
      entities.push({
        entity: id,
        tag: this.world.tagOf(id),
        meshId: renderable?.meshId,
        position: { ...tr.position },
        rotation: { ...tr.rotation },
        visible: renderable?.visible ?? true,
      });
    }
    return {
      alpha: this.loop.alpha(),
      stepIndex: this.loop.totalSteps(),
      capturedAtMs: this.lastFrameMs,
      cameraPosition: {
        x: this.orbitCamera.camera.position.x,
        y: this.orbitCamera.camera.position.y,
        z: this.orbitCamera.camera.position.z,
      },
      cameraTarget: this.orbitCamera.getOrbitTarget(),
      entities,
    };
  }

  on<K extends keyof EngineEventMap>(type: K, listener: (payload: EngineEventMap[K]) => void): () => void {
    return this.emitter.on(type, listener);
  }

  // ---------------------------------------------------------------------------
  // Brain attachment (plan 04)
  // ---------------------------------------------------------------------------

  /**
   * Attach a `PolicyNetwork` instance to an agent entity. The handle is stored
   * on the agent's `AgentComponent.policyHandle`; `BrainSystem` resolves it
   * back to the policy via `resolvePolicy`.
   */
  attachPolicy(agentEntity: Entity, policy: PolicyNetwork): PolicyHandle {
    if (this.policyHandleByAgent.has(agentEntity)) this.detachPolicy(agentEntity);
    const handle = `policy-${this.nextPolicyHandle++}`;
    this.policiesByHandle.set(handle, policy);
    this.policyHandleByAgent.set(agentEntity, handle);
    const agentComp = this.world.getComponent<AgentComponent>(
      agentEntity,
      MORPHOLOGY_COMPONENT_KINDS.agent,
    );
    if (agentComp) agentComp.policyHandle = handle;
    return handle;
  }

  detachPolicy(agentEntity: Entity): void {
    const handle = this.policyHandleByAgent.get(agentEntity);
    if (!handle) return;
    this.policyHandleByAgent.delete(agentEntity);
    this.policiesByHandle.delete(handle);
    const agentComp = this.world.getComponent<AgentComponent>(
      agentEntity,
      MORPHOLOGY_COMPONENT_KINDS.agent,
    );
    if (agentComp) agentComp.policyHandle = undefined;
  }

  resolvePolicy(handle: unknown): PolicyNetwork | undefined {
    if (typeof handle !== 'string') return undefined;
    return this.policiesByHandle.get(handle);
  }

  /**
   * Reset every attached policy's per-episode state (e.g. clears
   * `LstmCellState` for `NeatLstmPolicyNetwork`). Called at episode boundaries
   * by the trainer; safe to call manually after spawning fresh agents.
   */
  resetEpisodeStateForAllPolicies(): void {
    for (const policy of this.policiesByHandle.values()) policy.resetEpisodeState();
  }

  /**
   * Returns the distinct `brainDnaId` values currently attached to live
   * agents. Used by the trainer and the inspector to enumerate brains.
   */
  getActiveBrainDnaIds(): string[] {
    const ids = new Set<string>();
    for (const entity of this.world.query([MORPHOLOGY_COMPONENT_KINDS.agent])) {
      const agent = this.world.getComponent<AgentComponent>(
        entity,
        MORPHOLOGY_COMPONENT_KINDS.agent,
      );
      if (agent?.brainDnaId) ids.add(agent.brainDnaId);
    }
    return Array.from(ids);
  }

  // ---------------------------------------------------------------------------
  // Read-only accessors
  // ---------------------------------------------------------------------------

  getMode(): EngineMode { return this.mode; }
  getCurrentArena(): ArenaDefinition | null { return this.currentArena; }
  getCamera(): PerspectiveCamera { return this.orbitCamera.camera; }
  getStepIndex(): number { return this.loop.totalSteps(); }
  isRunning(): boolean { return this.running; }
  getLoop(): FixedStepLoop { return this.loop; }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private runFixedStep(dt: number): void {
    if (this.inputSource) this.currentInput = this.inputSource.pollFixed();
    const ctx: SystemContext = { bus: this.bus, stepIndex: this.loop.totalSteps() };
    for (const system of this.systems) system.update(this.world, dt, ctx);
    if (this.physicsInitialized) {
      this.physics.step(dt * 1000);
      this.latestPhysicsSnapshot = this.physics.snapshot();
    }
    this.processSystemEvents();
    this.emitter.emit('simStep', { stepIndex: this.loop.totalSteps(), stepDt: dt });
  }

  private processSystemEvents(): void {
    for (const evt of this.bus.drain()) {
      // Plan 01 has no system-level events to forward yet. Plans 03-05 add
      // their own routing here. The drain call still runs to keep the bus
      // bounded, mirroring the platformer engine convention.
      void evt;
    }
  }

  private renderFrame(alpha: number): void {
    this.emitter.emit('renderFrame', { alpha, fps: this.lastFps });
    this.renderer.render(this.scene, this.orbitCamera.camera);
  }

  private installDefaultLights(): void {
    const ambient = new AmbientLight(0xffffff, 0.55);
    ambient.name = 'voxsim:lights:ambient';
    this.layers.overlay.add(ambient);

    const sun = new DirectionalLight(0xffffff, 0.85);
    sun.name = 'voxsim:lights:sun';
    sun.position.set(20, 40, 15);
    this.layers.overlay.add(sun);
  }

  private installDefaultCameraEntity(): void {
    const cam = this.world.createEntity('camera');
    this.world.addComponent<CameraComponent>(cam, COMPONENT_KINDS.camera, {
      kind: 'orbit',
      target: { x: 0, y: 0, z: 0 },
      distance: this.orbitCamera.getDistance(),
      azimuth: this.orbitCamera.getAzimuth(),
      elevation: this.orbitCamera.getElevation(),
      fov: 60,
      near: 0.1,
      far: 1000,
    });
    this.cameraEntity = cam;
  }

  private frameOrbitCameraOnArena(arena: ArenaDefinition): void {
    const span = arena.voxelSize;
    const { sx, sy, sz } = arena.chunkSize;
    const widthChunks = arena.bounds.max.cx - arena.bounds.min.cx + 1;
    const heightChunks = arena.bounds.max.cy - arena.bounds.min.cy + 1;
    const depthChunks = arena.bounds.max.cz - arena.bounds.min.cz + 1;
    const centerX = (arena.bounds.min.cx + widthChunks / 2) * sx * span;
    const centerY = (arena.bounds.min.cy + heightChunks / 2) * sy * span;
    const centerZ = (arena.bounds.min.cz + depthChunks / 2) * sz * span;
    const radius = Math.max(widthChunks * sx, depthChunks * sz, heightChunks * sy) * span;
    this.orbitCamera.setOrbitTarget({ x: centerX, y: centerY, z: centerZ });
    this.orbitCamera.setDistance(Math.max(8, radius * 1.2));
  }
}
