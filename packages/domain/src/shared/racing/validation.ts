/**
 * Validators for racing authoring data. Used by the built-in catalog loader
 * and by transport adapters that accept user-authored JSON. Returns a
 * structured `Result` rather than throwing so callers can present field-level
 * errors.
 */

import type { VehiclePreset } from './vehicle-types.js';
import type { TrackPreset } from './track-types.js';
import type { SurfaceId } from './surface-types.js';
import { SURFACE_IDS } from './surface-types.js';

export interface ValidationError {
  path: string;
  code: string;
  message: string;
}

export type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[] };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function pushError(errors: ValidationError[], path: string, code: string, message: string) {
  errors.push({ path, code, message });
}

export function validateVehiclePreset(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: [{ path: '', code: 'not-object', message: 'preset must be an object' }] };
  }
  const v = input as Partial<VehiclePreset>;
  if (typeof v.id !== 'string' || v.id.length === 0) pushError(errors, 'id', 'missing', 'id is required');
  if (typeof v.label !== 'string' || v.label.length === 0) pushError(errors, 'label', 'missing', 'label is required');
  if (v.driveLabel !== 'RWD' && v.driveLabel !== 'FWD' && v.driveLabel !== 'AWD') {
    pushError(errors, 'driveLabel', 'invalid', 'driveLabel must be RWD, FWD, or AWD');
  }
  if (!isFiniteNumber(v.wheelbase) || v.wheelbase <= 0) pushError(errors, 'wheelbase', 'invalid', 'wheelbase must be > 0');
  if (!isFiniteNumber(v.trackWidth) || v.trackWidth <= 0) pushError(errors, 'trackWidth', 'invalid', 'trackWidth must be > 0');
  if (!isFiniteNumber(v.frontMassPct) || v.frontMassPct < 0 || v.frontMassPct > 1) {
    pushError(errors, 'frontMassPct', 'invalid', 'frontMassPct must be in [0, 1]');
  }
  if (!isFiniteNumber(v.finalDrive) || v.finalDrive <= 0) pushError(errors, 'finalDrive', 'invalid', 'finalDrive must be > 0');
  if (!isFiniteNumber(v.steerMaxDeg) || v.steerMaxDeg <= 0) pushError(errors, 'steerMaxDeg', 'invalid', 'steerMaxDeg must be > 0');
  if (!Array.isArray(v.gears) || v.gears.length < 3) {
    pushError(errors, 'gears', 'invalid', 'gears must include at least Reverse, Neutral, and one forward ratio');
  } else {
    for (let i = 0; i < v.gears.length; i++) {
      const g = v.gears[i] as Partial<{ n: string; ratio: number }>;
      if (typeof g?.n !== 'string') pushError(errors, `gears[${i}].n`, 'invalid', 'n must be a string');
      if (!isFiniteNumber(g?.ratio)) pushError(errors, `gears[${i}].ratio`, 'invalid', 'ratio must be a finite number');
    }
  }
  if (!v.axleDrive || !isFiniteNumber(v.axleDrive.front) || !isFiniteNumber(v.axleDrive.rear)) {
    pushError(errors, 'axleDrive', 'invalid', 'axleDrive.front and axleDrive.rear must be finite numbers');
  } else {
    const total = v.axleDrive.front + v.axleDrive.rear;
    if (Math.abs(total - 1) > 1e-3) {
      pushError(errors, 'axleDrive', 'sum', `axleDrive shares must sum to 1 (got ${total.toFixed(3)})`);
    }
  }
  if (v.diffType !== 'welded' && v.diffType !== 'open' && v.diffType !== 'clutchLSD') {
    pushError(errors, 'diffType', 'invalid', 'diffType must be welded, open, or clutchLSD');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateTrackPreset(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: [{ path: '', code: 'not-object', message: 'preset must be an object' }] };
  }
  const t = input as Partial<TrackPreset> & { surfaceZones?: ReadonlyArray<{ surface?: SurfaceId }> };
  if (typeof t.id !== 'string' || t.id.length === 0) pushError(errors, 'id', 'missing', 'id is required');
  if (typeof t.label !== 'string' || t.label.length === 0) pushError(errors, 'label', 'missing', 'label is required');
  if (!isFiniteNumber(t.halfWidth) || t.halfWidth <= 0) pushError(errors, 'halfWidth', 'invalid', 'halfWidth must be > 0');
  if (!isFiniteNumber(t.samples) || t.samples < 32) pushError(errors, 'samples', 'invalid', 'samples must be >= 32');
  if (!Array.isArray(t.ctrl) || t.ctrl.length < 4) {
    pushError(errors, 'ctrl', 'invalid', 'ctrl must contain at least 4 control points');
  } else {
    for (let i = 0; i < t.ctrl.length; i++) {
      const p = t.ctrl[i] as readonly unknown[];
      if (!Array.isArray(p) || p.length !== 2 || !isFiniteNumber(p[0]) || !isFiniteNumber(p[1])) {
        pushError(errors, `ctrl[${i}]`, 'invalid', 'each ctrl entry must be [x, z]');
      }
    }
  }
  if (Array.isArray(t.surfaceZones)) {
    for (let i = 0; i < t.surfaceZones.length; i++) {
      const z = t.surfaceZones[i];
      if (z?.surface === undefined || !SURFACE_IDS.includes(z.surface)) {
        pushError(errors, `surfaceZones[${i}].surface`, 'invalid', `surface must be one of ${SURFACE_IDS.join(', ')}`);
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
