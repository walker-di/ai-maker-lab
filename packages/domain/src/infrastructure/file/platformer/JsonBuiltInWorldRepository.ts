import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type {
  IBuiltInWorldRepository,
} from '../../../application/platformer/index.js';
import type { WorldDefinition } from '../../../shared/platformer/index.js';

/**
 * Reads built-in worlds from the bundled JSON file. Used by the desktop app
 * server. Tests can inject `InMemoryBuiltInWorldRepository` instead.
 */
export class JsonBuiltInWorldRepository implements IBuiltInWorldRepository {
  private cache: WorldDefinition[] | null = null;
  constructor(private readonly jsonPath: string = fileURLToPath(new URL('./built-in-worlds.json', import.meta.url))) {}

  async listWorlds(): Promise<WorldDefinition[]> {
    if (!this.cache) {
      const raw = await readFile(this.jsonPath, 'utf8');
      this.cache = JSON.parse(raw) as WorldDefinition[];
    }
    return this.cache.map(cloneWorld);
  }

  async getWorld(id: string): Promise<WorldDefinition | null> {
    const worlds = await this.listWorlds();
    return worlds.find((w) => w.id === id) ?? null;
  }
}

/**
 * In-memory variant for tests and the SSR boot path when a json file isn't
 * appropriate.
 */
export class InMemoryBuiltInWorldRepository implements IBuiltInWorldRepository {
  constructor(private readonly worlds: WorldDefinition[]) {}
  async listWorlds(): Promise<WorldDefinition[]> {
    return this.worlds.map(cloneWorld);
  }
  async getWorld(id: string): Promise<WorldDefinition | null> {
    return this.worlds.find((w) => w.id === id) ?? null;
  }
}

function cloneWorld(world: WorldDefinition): WorldDefinition {
  return JSON.parse(JSON.stringify(world)) as WorldDefinition;
}
