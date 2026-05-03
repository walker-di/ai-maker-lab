import { describe, expect, it } from 'bun:test';
import { BuiltInRacingCatalogSource } from './loader.js';

describe('BuiltInRacingCatalogSource', () => {
  const source = new BuiltInRacingCatalogSource();

  it('loads three vehicle presets and validates them', async () => {
    const vehicles = await source.listVehicles();
    expect(vehicles.map((v) => v.id).sort()).toEqual(
      ['awd-rear-biased', 'fwd-front', 'rwd-front-mid'].sort(),
    );
    for (const v of vehicles) {
      expect(v.gears.length).toBeGreaterThanOrEqual(3);
      expect(v.axleDrive.front + v.axleDrive.rear).toBeCloseTo(1, 6);
    }
  });

  it('loads three track presets and validates them', async () => {
    const tracks = await source.listTracks();
    expect(tracks.map((t) => t.id).sort()).toEqual(
      ['classic-twist', 'corkscrew-ridge', 'lakeside-gp'].sort(),
    );
    for (const t of tracks) {
      expect(t.ctrl.length).toBeGreaterThanOrEqual(4);
      expect(t.samples).toBeGreaterThanOrEqual(32);
    }
  });

  it('looks up vehicles and tracks by id', async () => {
    const vehicle = await source.findVehicle('rwd-front-mid');
    expect(vehicle?.label).toBe('RWD / Front-mid');
    const missing = await source.findVehicle('does-not-exist');
    expect(missing).toBeUndefined();

    const track = await source.findTrack('classic-twist');
    expect(track?.halfWidth).toBeCloseTo(6.0, 6);
  });
});
