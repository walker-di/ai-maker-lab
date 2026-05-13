/** ECS-lite world. Identical shape to platformer engine for consistency. */

export type Entity = number;
export type ComponentKind = string;

export class EngineWorld {
  private nextEntityId = 1;
  private readonly alive = new Set<Entity>();
  private readonly pools = new Map<ComponentKind, Map<Entity, unknown>>();

  createEntity(): Entity {
    const id = this.nextEntityId++;
    this.alive.add(id);
    return id;
  }

  removeEntity(entity: Entity): void {
    if (!this.alive.has(entity)) return;
    this.alive.delete(entity);
    for (const pool of this.pools.values()) pool.delete(entity);
  }

  isAlive(entity: Entity): boolean {
    return this.alive.has(entity);
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
    let smallest: Map<Entity, unknown> | undefined;
    let smallestSize = Infinity;
    for (const kind of kinds) {
      const pool = this.pools.get(kind);
      if (!pool) return;
      if (pool.size < smallestSize) {
        smallestSize = pool.size;
        smallest = pool;
      }
    }
    if (!smallest) return;
    for (const entity of smallest.keys()) {
      let owns = true;
      for (const kind of kinds) {
        if (!this.pools.get(kind)?.has(entity)) {
          owns = false;
          break;
        }
      }
      if (owns) yield entity;
    }
  }

  entityCount(): number {
    return this.alive.size;
  }
}

export interface SystemContext {
  bus: SystemEventBus;
  stepIndex: number;
  totalStepsMs: number;
}

export interface System {
  readonly name?: string;
  update(world: EngineWorld, dt: number, ctx: SystemContext): void;
}

export interface SystemEvent {
  type: string;
  [key: string]: unknown;
}

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
