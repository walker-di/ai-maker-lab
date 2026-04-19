/**
 * ECS-lite world. Components are plain data records stored in typed pools
 * keyed by entity id. Queries return iterators over entities that own all of
 * the requested component kinds.
 *
 * The voxsim engine reserves a small set of well-known component kinds (see
 * `components.ts`); downstream plans (physics, morphology, brain, replay)
 * register their own kinds without modifying this module.
 */

export type Entity = number;

export type ComponentKind = string;

export class EngineWorld {
  private nextEntityId = 1;
  private readonly alive = new Set<Entity>();
  private readonly tags = new Map<Entity, string>();
  private readonly pools = new Map<ComponentKind, Map<Entity, unknown>>();

  createEntity(tag?: string): Entity {
    const id = this.nextEntityId++;
    this.alive.add(id);
    if (tag !== undefined) this.tags.set(id, tag);
    return id;
  }

  removeEntity(entity: Entity): void {
    if (!this.alive.has(entity)) return;
    this.alive.delete(entity);
    this.tags.delete(entity);
    for (const pool of this.pools.values()) {
      pool.delete(entity);
    }
  }

  isAlive(entity: Entity): boolean {
    return this.alive.has(entity);
  }

  tagOf(entity: Entity): string | undefined {
    return this.tags.get(entity);
  }

  setTag(entity: Entity, tag: string): void {
    if (!this.alive.has(entity)) {
      throw new Error(`Cannot tag dead entity ${entity}`);
    }
    this.tags.set(entity, tag);
  }

  addComponent<T>(entity: Entity, kind: ComponentKind, data: T): void {
    if (!this.alive.has(entity)) {
      throw new Error(`Cannot add component to dead entity ${entity}`);
    }
    let pool = this.pools.get(kind);
    if (!pool) {
      pool = new Map();
      this.pools.set(kind, pool);
    }
    pool.set(entity, data);
  }

  getComponent<T>(entity: Entity, kind: ComponentKind): T | undefined {
    return this.pools.get(kind)?.get(entity) as T | undefined;
  }

  hasComponent(entity: Entity, kind: ComponentKind): boolean {
    return this.pools.get(kind)?.has(entity) ?? false;
  }

  removeComponent(entity: Entity, kind: ComponentKind): void {
    this.pools.get(kind)?.delete(entity);
  }

  *query(kinds: ComponentKind[]): Iterable<Entity> {
    if (kinds.length === 0) {
      for (const e of this.alive) yield e;
      return;
    }
    let smallestPool: Map<Entity, unknown> | undefined;
    let smallestSize = Infinity;
    for (const kind of kinds) {
      const pool = this.pools.get(kind);
      if (!pool) return;
      if (pool.size < smallestSize) {
        smallestSize = pool.size;
        smallestPool = pool;
      }
    }
    if (!smallestPool) return;
    for (const entity of smallestPool.keys()) {
      let owned = true;
      for (const kind of kinds) {
        if (!this.pools.get(kind)?.has(entity)) {
          owned = false;
          break;
        }
      }
      if (owned) yield entity;
    }
  }

  entityCount(): number {
    return this.alive.size;
  }

  clear(): void {
    this.alive.clear();
    this.tags.clear();
    this.pools.clear();
    this.nextEntityId = 1;
  }
}

export interface SystemContext {
  bus: SystemEventBus;
  /** Total number of fixed steps the engine has executed. */
  stepIndex: number;
}

export interface System {
  readonly name?: string;
  update(world: EngineWorld, dt: number, ctx: SystemContext): void;
}

export interface SystemEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * Per-step event bus passed to systems. Systems push events; the engine drains
 * them after each fixed step. Drained events are forwarded to typed engine
 * listeners (see `events.ts`).
 */
export class SystemEventBus {
  private events: SystemEvent[] = [];

  emit(event: SystemEvent): void {
    this.events.push(event);
  }

  drain(): SystemEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
