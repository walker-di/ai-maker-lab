import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  validateMapDefinition,
  type MapDefinition,
} from '../../../shared/rts/index.js';
import type { IRtsMapSource } from '../../../application/rts/index.js';

const BUILTIN_FILES = ['tiny-skirmish.json', 'cliffside.json', 'dual-ramps.json'];

export class BuiltInRtsMapSource implements IRtsMapSource {
  private cache: MapDefinition[] | null = null;

  constructor(private readonly directory: string = fileURLToPath(new URL('./', import.meta.url))) {}

  async listMaps(): Promise<MapDefinition[]> {
    if (!this.cache) {
      const maps: MapDefinition[] = [];
      for (const filename of BUILTIN_FILES) {
        const raw = await readFile(join(this.directory, filename), 'utf8');
        const parsed = JSON.parse(raw) as MapDefinition;
        const result = validateMapDefinition(parsed);
        if (!result.ok) {
          throw new Error(
            `Built-in map ${parsed.id} failed validation: ${result.errors.map((e) => e.code).join(', ')}`,
          );
        }
        maps.push(parsed);
      }
      this.cache = maps;
    }
    return this.cache.map(cloneMap);
  }

  async findMap(id: string): Promise<MapDefinition | undefined> {
    const all = await this.listMaps();
    return all.find((m) => m.id === id);
  }
}

export class InMemoryRtsMapSource implements IRtsMapSource {
  constructor(private readonly maps: MapDefinition[]) {}
  async listMaps(): Promise<MapDefinition[]> {
    return this.maps.map(cloneMap);
  }
  async findMap(id: string): Promise<MapDefinition | undefined> {
    return this.maps.find((m) => m.id === id);
  }
}

function cloneMap(map: MapDefinition): MapDefinition {
  return JSON.parse(JSON.stringify(map)) as MapDefinition;
}
