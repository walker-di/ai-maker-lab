import type { MapDefinition, PowerUpKind, RunOutcome } from '../types.js';
import { COMPONENT_KINDS } from './components.js';
import type {
  BodyComponent,
  CameraComponent,
  PlayerStateComponent,
  PositionComponent,
  ProjectileComponent,
  RenderableComponent,
  VelocityComponent,
} from './components.js';
import { EngineEmitter, type EngineEventMap } from './events.js';
import { FixedStepLoop } from './fixed-step-loop.js';
import { TileGrid } from './tile-grid.js';
import { EngineWorld, SystemEventBus, type System } from './world.js';
import { DEFAULT_TUNABLES, type Tunables } from './tunables.js';
import { type AssetBundle, getAssetBundle } from './assets.js';
import { type AudioBus, NullAudioBus } from './audio-bus.js';
import { createEmptyInputState, type InputSource, type InputState } from './input.js';
import { isQuestionBlockReserveSpawn, spawnFromDefinition, spawnPlayer } from './systems/factory.js';
import { PlayerControllerSystem } from './systems/player-controller.js';
import { PipeTeleportSystem } from './systems/teleport.js';
import { IntegrationSystem } from './systems/integration.js';
import {
  BulletShooterSystem,
  FireBarSystem,
  FlyingEnemySystem,
  WalkerEnemySystem,
} from './systems/enemies.js';
import { PlayerEntityCollisionSystem } from './systems/collisions.js';
import { CameraSystem } from './systems/camera.js';

export type EngineMode = 'play' | 'preview';

export interface PlatformerEngineConfig {
  mode: EngineMode;
  assetBundleId?: string;
  fixedStepHz?: number;
  tunables?: Partial<Tunables>;
  audio?: AudioBus;
  /** Countdown starting value after each `loadMap` (default 300_000 ms). */
  timeLimitMs?: number;
  /** Optional renderer factory; the default constructs a Pixi adapter on `mount`. */
  rendererFactory?: () => Promise<EngineRenderer>;
}

/**
 * Renderer surface the engine talks to. The default Pixi-based implementation
 * lives in `engine/pixi-renderer.ts`. Tests pass a mock or `null` (headless).
 */
export interface EngineRenderer {
  mount(target: HTMLCanvasElement | HTMLDivElement): Promise<void>;
  loadMap(map: MapDefinition, bundle: AssetBundle): void;
  /** Called every render tick with the current world snapshot. */
  render(snapshot: RenderSnapshot): void;
  dispose(): void;
}

export interface RenderEntity {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  tint: number;
  shape: 'rect' | 'roundRect' | 'circle' | 'triangle';
  kind: string;
}

export interface RenderSnapshot {
  cameraX: number;
  alpha: number;
  entities: RenderEntity[];
  /** Tile updates queued since the last render. */
  tileUpdates: { col: number; row: number; kind: import('../types.js').TileKind }[];
}

export class PlatformerEngine {
  readonly emitter = new EngineEmitter();
  readonly world = new EngineWorld();
  private readonly bus = new SystemEventBus();
  private readonly loop: FixedStepLoop;
  private readonly tunables: Tunables;
  private readonly bundle: AssetBundle;
  private readonly audio: AudioBus;
  private readonly mode: EngineMode;
  private readonly playerEntityRef = { value: null as number | null };
  private renderer: EngineRenderer | null = null;
  private rendererFactory: (() => Promise<EngineRenderer>) | undefined;
  private grid: TileGrid | null = null;
  private map: MapDefinition | null = null;
  private input: InputSource | null = null;
  private currentInput: InputState = createEmptyInputState();
  private systems: System[] = [];
  private cameraEntity: number | null = null;
  private running = false;
  private rafHandle: number | null = null;
  private elapsedMs = 0;
  private timeRemainingMs = 300_000;
  private readonly timeLimitMs: number;
  private score = 0;
  private coins = 0;
  private lives = 3;
  private goalReached = false;
  private pendingTileUpdates: RenderSnapshot['tileUpdates'] = [];

  constructor(config: PlatformerEngineConfig) {
    this.mode = config.mode;
    this.bundle = getAssetBundle(config.assetBundleId ?? 'default');
    this.tunables = { ...DEFAULT_TUNABLES, ...(config.tunables ?? {}) };
    this.audio = config.audio ?? new NullAudioBus();
    this.loop = new FixedStepLoop({ hz: config.fixedStepHz ?? 60 });
    this.rendererFactory = config.rendererFactory;
    this.timeLimitMs = config.timeLimitMs ?? 300_000;
  }

  async mount(target: HTMLCanvasElement | HTMLDivElement): Promise<void> {
    if (this.rendererFactory) {
      this.renderer = await this.rendererFactory();
      await this.renderer.mount(target);
      if (this.map) this.renderer.loadMap(this.map, this.bundle);
    }
  }

  loadMap(map: MapDefinition): void {
    this.map = map;
    this.grid = new TileGrid(map);

    // Reset world.
    for (const e of [...this.world.query([])]) this.world.removeEntity(e);

    const player = spawnPlayer({ world: this.world, bundle: this.bundle, grid: this.grid }, map.spawn.col, map.spawn.row);
    this.playerEntityRef.value = player;

    for (const spawn of map.entities) {
      if (isQuestionBlockReserveSpawn(map, spawn)) continue;
      spawnFromDefinition({ world: this.world, bundle: this.bundle, grid: this.grid }, spawn);
    }

    // Camera entity.
    const cam = this.world.createEntity();
    this.world.addComponent<CameraComponent>(cam, COMPONENT_KINDS.camera, {
      x: 0,
      deadzoneHalfWidth: 64,
      locked: false,
      minX: 0,
    });
    this.cameraEntity = cam;

    this.systems = this.buildSystems();
    this.score = 0;
    this.coins = 0;
    this.goalReached = false;
    this.elapsedMs = 0;
    this.timeRemainingMs = this.timeLimitMs;
    this.pendingTileUpdates = [];

    this.audio.playMusic(map.music, { crossfadeMs: 500 });

    if (this.renderer) this.renderer.loadMap(map, this.bundle);
  }

  setInput(source: InputSource): void {
    this.input?.dispose();
    this.input = source;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (typeof window !== 'undefined') {
      let lastTime = performance.now();
      const frame = (now: number) => {
        if (!this.running) return;
        const dt = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;
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
    this.input?.dispose();
    this.input = null;
    this.audio.dispose();
    this.renderer?.dispose();
    this.renderer = null;
    this.emitter.removeAll();
  }

  /** Headless tick used by tests; advances one fixed step. */
  tickFixed(): void {
    this.runFixedStep();
  }

  /** Drives systems for `seconds` of real time using the fixed-step loop. */
  tickReal(seconds: number): void {
    this.loop.tick(seconds, () => this.runFixedStep());
    this.render(this.loop ? 0 : 0);
  }

  on<K extends keyof EngineEventMap>(type: K, listener: (payload: EngineEventMap[K]) => void): () => void {
    return this.emitter.on(type, listener);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private buildSystems(): System[] {
    if (!this.grid) throw new Error('Map must be loaded before building systems');
    const grid = this.grid;
    const tunables = this.tunables;

    const playerCtrl = new PlayerControllerSystem({
      tunables,
      getInput: () => this.currentInput,
      onAttack: (entity) => this.spawnFireball(entity),
      onJump: () => this.audio.playSfx('jump'),
    });
    const pipeTeleport = new PipeTeleportSystem({
      grid,
      bundle: this.bundle,
      getMap: () => this.map,
      getInput: () => this.currentInput,
      playerEntityRef: this.playerEntityRef,
      onTeleport: (payload) => {
        this.emitter.emit('pipeTeleport', payload);
        this.audio.playSfx('pipe');
      },
    });
    const integration = new IntegrationSystem({ grid, tunables });
    const walkers = new WalkerEnemySystem({ grid, tunables, bundle: this.bundle });
    const flyers = new FlyingEnemySystem({ grid, tunables, bundle: this.bundle });
    const fireBars = new FireBarSystem({ grid, tunables, bundle: this.bundle });
    const shooters = new BulletShooterSystem(
      { grid, tunables, bundle: this.bundle },
      (x, y, vx) => this.spawnBullet(x, y, vx),
    );
    const collisions = new PlayerEntityCollisionSystem({
      tunables,
      playerEntityRef: this.playerEntityRef,
    });
    const camera = new CameraSystem(
      {
        viewportWidth: 320,
        mapWidthPx: grid.cols * grid.tileSize,
      },
      this.playerEntityRef,
    );

    return [playerCtrl, pipeTeleport, walkers, flyers, fireBars, shooters, integration, collisions, camera];
  }

  private runFixedStep(): void {
    if (!this.grid || !this.map) return;
    if (this.input) this.currentInput = this.input.pollFixed();

    const dt = this.loop.stepDt;
    const ctx = { bus: this.bus, stepIndex: this.loop.totalSteps() };
    for (const system of this.systems) system.update(this.world, dt, ctx);
    this.processEvents();

    this.elapsedMs += dt * 1000;
    this.timeRemainingMs -= dt * 1000;
    this.checkGoalAndFalls();
    if (this.timeRemainingMs <= 0 && !this.goalReached) {
      this.timeRemainingMs = 0;
      this.loseLife();
    }
  }

  private processEvents(): void {
    for (const evt of this.bus.drain()) {
      switch (evt.type) {
        case 'bumpableHit':
          this.handleBumpableHit(evt.col as number, evt.row as number, evt.kind as import('../types.js').TileKind);
          break;
        case 'hazardHit':
          this.handleHazard(evt.col as number, evt.row as number);
          break;
        case 'enemyStomped':
          this.addScore(this.tunables.stompScore);
          this.audio.playSfx('stomp');
          break;
        case 'enemyKilled':
          this.addScore(this.tunables.stompScore);
          break;
        case 'playerHit':
          this.handlePlayerDamage();
          break;
        case 'itemPickup':
          this.handleItemPickup(evt.kind as import('../types.js').EntityKind);
          break;
      }
    }
  }

  private handleBumpableHit(col: number, row: number, kind: import('../types.js').TileKind): void {
    if (!this.grid) return;
    const player = this.playerEntityRef.value;
    const state = player != null
      ? this.world.getComponent<PlayerStateComponent>(player, COMPONENT_KINDS.playerState)
      : null;
    if (kind === 'brick') {
      if (state && (state.power === 'grow' || state.power === 'fire')) {
        this.grid.setTile(col, row, 'empty');
        this.pendingTileUpdates.push({ col, row, kind: 'empty' });
        this.addScore(this.tunables.bumpScore);
        this.audio.playSfx('bump');
      } else {
        this.audio.playSfx('bump');
      }
    } else if (kind === 'question') {
      this.grid.setTile(col, row, 'hardBlock');
      this.pendingTileUpdates.push({ col, row, kind: 'hardBlock' });
      const item = this.itemFromQuestion(col, row);
      if (item === 'coin') {
        this.audio.playSfx('coin');
        this.coins++;
        this.addScore(this.tunables.coinScore);
        this.emitter.emit('coin', { total: this.coins });
      } else if (row > 0) {
        const spawned = spawnFromDefinition(
          { world: this.world, bundle: this.bundle, grid: this.grid },
          { kind: item, tile: { col, row: row - 1 } },
        );
        if (spawned != null) {
          const vel = this.world.getComponent<VelocityComponent>(spawned, COMPONENT_KINDS.velocity);
          if (vel) vel.vy = -200;
        }
        this.audio.playSfx('powerUp');
      }
    }
  }

  private itemFromQuestion(col: number, row: number): 'coin' | 'mushroom' | 'flower' | 'star' | 'oneUp' {
    const map = this.map;
    if (!map) return 'coin';
    const spawn = map.entities.find(
      (e) => e.tile.col === col && e.tile.row === row && (e.kind === 'mushroom' || e.kind === 'flower' || e.kind === 'star' || e.kind === 'oneUp'),
    );
    return (spawn?.kind as 'coin' | 'mushroom' | 'flower' | 'star' | 'oneUp') ?? 'coin';
  }

  private handleHazard(col: number, row: number): void {
    this.emitter.emit('hazardHit', { col, row });
    this.handlePlayerDamage();
  }

  private handlePlayerDamage(): void {
    const player = this.playerEntityRef.value;
    if (player == null) return;
    const state = this.world.getComponent<PlayerStateComponent>(player, COMPONENT_KINDS.playerState);
    if (!state) return;
    if (state.iframesMs > 0 || state.starMs > 0) return;
    if (state.power === 'fire') {
      state.power = 'grow';
      state.iframesMs = this.tunables.iframesMs;
      this.emitter.emit('powerUp', { power: 'grow' });
      return;
    }
    if (state.power === 'grow') {
      state.power = 'none';
      state.iframesMs = this.tunables.iframesMs;
      this.emitter.emit('powerUp', { power: 'none' });
      return;
    }
    this.audio.playSfx('death');
    this.loseLife();
  }

  private handleItemPickup(kind: import('../types.js').EntityKind): void {
    const player = this.playerEntityRef.value;
    if (player == null) return;
    const state = this.world.getComponent<PlayerStateComponent>(player, COMPONENT_KINDS.playerState);
    const vel = this.world.getComponent<VelocityComponent>(player, COMPONENT_KINDS.velocity);
    if (kind === 'coin') {
      this.coins++;
      this.addScore(this.tunables.coinScore);
      this.audio.playSfx('coin');
      this.emitter.emit('coin', { total: this.coins });
    } else if (kind === 'mushroom') {
      if (state && state.power === 'none') {
        state.power = 'grow';
        this.emitter.emit('powerUp', { power: 'grow' });
      }
      this.audio.playSfx('powerUp');
    } else if (kind === 'flower') {
      if (state && (state.power === 'grow' || state.power === 'none')) {
        state.power = 'fire';
        this.emitter.emit('powerUp', { power: 'fire' });
      }
      this.audio.playSfx('powerUp');
    } else if (kind === 'star') {
      if (state) state.starMs = this.tunables.starDurationMs;
      this.emitter.emit('powerUp', { power: 'star' });
      this.audio.playSfx('powerUp');
    } else if (kind === 'oneUp') {
      this.lives++;
      this.audio.playSfx('oneUp');
    } else if (kind === 'spring') {
      if (vel) vel.vy = this.tunables.springImpulse;
      this.audio.playSfx('jump');
    }
  }

  private checkGoalAndFalls(): void {
    if (!this.map || !this.grid) return;
    const player = this.playerEntityRef.value;
    if (player == null) return;
    const pos = this.world.getComponent<PositionComponent>(player, COMPONENT_KINDS.position);
    const body = this.world.getComponent<BodyComponent>(player, COMPONENT_KINDS.body);
    if (!pos || !body) return;
    const tileSize = this.grid.tileSize;
    const fellOff = pos.y > (this.grid.rows + 2) * tileSize;
    if (fellOff) {
      this.loseLife();
      return;
    }
    if (this.goalReached) return;
    const cellCol = Math.floor((pos.x + body.aabb.width / 2) / tileSize);
    const cellRow = Math.floor((pos.y + body.aabb.height / 2) / tileSize);
    if (cellCol === this.map.goal.col && cellRow === this.map.goal.row) {
      this.goalReached = true;
      const heightBonus = this.map.goal.kind === 'flag'
        ? Math.max(0, (this.map.size.rows - cellRow) * this.tunables.flagBonusPerRow)
        : 0;
      this.addScore(this.tunables.goalScore + heightBonus);
      this.audio.playSfx('levelComplete');
      this.emitter.emit('goalReached', {
        score: this.score,
        coins: this.coins,
        timeMs: this.elapsedMs,
      });
      this.emitter.emit('runFinished', {
        outcome: 'completed' as RunOutcome,
        score: this.score,
        coins: this.coins,
        timeMs: this.elapsedMs,
      });
      this.stop();
    }
  }

  private addScore(delta: number): void {
    this.score += delta;
    this.emitter.emit('score', { delta, total: this.score });
  }

  private loseLife(): void {
    this.lives = Math.max(0, this.lives - 1);
    this.emitter.emit('lifeLost', { lives: this.lives });
    if (this.lives === 0) {
      this.emitter.emit('runFinished', {
        outcome: 'gameOver' as RunOutcome,
        score: this.score,
        coins: this.coins,
        timeMs: this.elapsedMs,
      });
      this.stop();
      return;
    }
    if (this.map) this.loadMap(this.map);
  }

  private spawnFireball(playerEntity: number): void {
    const pos = this.world.getComponent<PositionComponent>(playerEntity, COMPONENT_KINDS.position);
    const state = this.world.getComponent<PlayerStateComponent>(playerEntity, COMPONENT_KINDS.playerState);
    const body = this.world.getComponent<BodyComponent>(playerEntity, COMPONENT_KINDS.body);
    if (!pos || !state || !body) return;
    const dir = state.faceDir;
    const e = this.world.createEntity();
    const placeholder = this.bundle.entities.fireball;
    const x = pos.x + (dir > 0 ? body.aabb.width : -placeholder.width);
    const y = pos.y + body.aabb.height / 3;
    this.world.addComponent<PositionComponent>(e, COMPONENT_KINDS.position, { x, y });
    this.world.addComponent<VelocityComponent>(e, COMPONENT_KINDS.velocity, {
      vx: dir * this.tunables.fireballSpeed,
      vy: -120,
    });
    this.world.addComponent<BodyComponent>(e, COMPONENT_KINDS.body, {
      aabb: { x, y, width: placeholder.width, height: placeholder.height },
      grounded: false,
      ceilinged: false,
      lastBottom: y + placeholder.height,
      tag: 'projectile',
    });
    this.world.addComponent<RenderableComponent>(e, COMPONENT_KINDS.renderable, {
      kind: 'fireball',
      width: placeholder.width,
      height: placeholder.height,
      tint: placeholder.tint,
      shape: placeholder.shape,
    });
    this.world.addComponent<ProjectileComponent>(e, COMPONENT_KINDS.projectile, {
      kind: 'fireball',
      source: 'player',
      bouncesLeft: 4,
    });
    this.audio.playSfx('fireball');
  }

  private spawnBullet(x: number, y: number, vx: number): void {
    const e = this.world.createEntity();
    const placeholder = this.bundle.entities.bullet;
    this.world.addComponent<PositionComponent>(e, COMPONENT_KINDS.position, { x, y });
    this.world.addComponent<VelocityComponent>(e, COMPONENT_KINDS.velocity, { vx, vy: 0 });
    this.world.addComponent<BodyComponent>(e, COMPONENT_KINDS.body, {
      aabb: { x, y, width: placeholder.width, height: placeholder.height },
      grounded: false,
      ceilinged: false,
      lastBottom: y + placeholder.height,
      tag: 'projectile',
    });
    this.world.addComponent<RenderableComponent>(e, COMPONENT_KINDS.renderable, {
      kind: 'bullet',
      width: placeholder.width,
      height: placeholder.height,
      tint: placeholder.tint,
      shape: placeholder.shape,
    });
    this.world.addComponent<ProjectileComponent>(e, COMPONENT_KINDS.projectile, {
      kind: 'bullet',
      source: 'enemy',
      bouncesLeft: 0,
    });
  }

  private render(alpha: number): void {
    if (!this.renderer) return;
    const entities: RenderEntity[] = [];
    for (const id of this.world.query([COMPONENT_KINDS.position, COMPONENT_KINDS.renderable])) {
      const pos = this.world.getComponent<PositionComponent>(id, COMPONENT_KINDS.position)!;
      const renderable = this.world.getComponent<RenderableComponent>(id, COMPONENT_KINDS.renderable)!;
      entities.push({
        id,
        x: pos.x,
        y: pos.y,
        width: renderable.width,
        height: renderable.height,
        tint: renderable.tint,
        shape: renderable.shape,
        kind: renderable.kind,
      });
    }
    let cameraX = 0;
    if (this.cameraEntity != null) {
      const cam = this.world.getComponent<CameraComponent>(this.cameraEntity, COMPONENT_KINDS.camera);
      if (cam) cameraX = cam.x;
    }
    const tileUpdates = this.pendingTileUpdates;
    this.pendingTileUpdates = [];
    this.renderer.render({ cameraX, alpha, entities, tileUpdates });
  }

  // Read-only state accessors used by the page model and HUD.
  getScore(): number { return this.score; }
  getCoins(): number { return this.coins; }
  getLives(): number { return this.lives; }
  getTimeRemainingMs(): number { return this.timeRemainingMs; }
  getMode(): EngineMode { return this.mode; }
  getPlayerPower(): PowerUpKind {
    const player = this.playerEntityRef.value;
    if (player == null) return 'none';
    return this.world.getComponent<PlayerStateComponent>(player, COMPONENT_KINDS.playerState)?.power ?? 'none';
  }
}
