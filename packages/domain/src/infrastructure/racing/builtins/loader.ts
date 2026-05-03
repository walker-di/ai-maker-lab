/**
 * Built-in racing catalog loader. Reads the bundled vehicle and track JSON
 * files at startup and validates them with the shared validators. Throws if
 * any preset fails validation so a regression in the catalog is loud at
 * boot rather than mysterious at runtime.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  validateTrackPreset,
  validateVehiclePreset,
  type TrackPreset,
  type VehiclePreset,
} from '../../../shared/racing/index.js';

const VEHICLE_FILES = ['rwd-front-mid.json', 'fwd-front.json', 'awd-rear-biased.json'];
const TRACK_FILES = ['classic-twist.json', 'lakeside-gp.json', 'corkscrew-ridge.json'];

export interface IRacingCatalogSource {
  listVehicles(): Promise<VehiclePreset[]>;
  findVehicle(id: string): Promise<VehiclePreset | undefined>;
  listTracks(): Promise<TrackPreset[]>;
  findTrack(id: string): Promise<TrackPreset | undefined>;
}

export class BuiltInRacingCatalogSource implements IRacingCatalogSource {
  private vehiclesCache: VehiclePreset[] | null = null;
  private tracksCache: TrackPreset[] | null = null;

  constructor(
    private readonly directory: string = fileURLToPath(new URL('./', import.meta.url)),
  ) {}

  async listVehicles(): Promise<VehiclePreset[]> {
    if (!this.vehiclesCache) {
      const out: VehiclePreset[] = [];
      for (const file of VEHICLE_FILES) {
        const raw = await readFile(join(this.directory, 'vehicles', file), 'utf8');
        const parsed = JSON.parse(raw) as VehiclePreset;
        const result = validateVehiclePreset(parsed);
        if (!result.ok) {
          throw new Error(
            `Built-in vehicle ${parsed.id} failed validation: ${result.errors.map((e) => `${e.path}:${e.code}`).join(', ')}`,
          );
        }
        out.push(parsed);
      }
      this.vehiclesCache = out;
    }
    return this.vehiclesCache.map(clone);
  }

  async findVehicle(id: string): Promise<VehiclePreset | undefined> {
    const all = await this.listVehicles();
    return all.find((v) => v.id === id);
  }

  async listTracks(): Promise<TrackPreset[]> {
    if (!this.tracksCache) {
      const out: TrackPreset[] = [];
      for (const file of TRACK_FILES) {
        const raw = await readFile(join(this.directory, 'tracks', file), 'utf8');
        const parsed = JSON.parse(raw) as TrackPreset;
        const result = validateTrackPreset(parsed);
        if (!result.ok) {
          throw new Error(
            `Built-in track ${parsed.id} failed validation: ${result.errors.map((e) => `${e.path}:${e.code}`).join(', ')}`,
          );
        }
        out.push(parsed);
      }
      this.tracksCache = out;
    }
    return this.tracksCache.map(clone);
  }

  async findTrack(id: string): Promise<TrackPreset | undefined> {
    const all = await this.listTracks();
    return all.find((t) => t.id === id);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
