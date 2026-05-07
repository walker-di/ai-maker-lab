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
  if (v.dimensions && typeof v.dimensions === 'object') {
    const dims = v.dimensions;
    const positiveDimFields = [
      'overallLengthM',
      'overallWidthM',
      'overallHeightM',
      'frontTrackWidthM',
      'rearTrackWidthM',
    ] as const;
    for (const key of positiveDimFields) {
      const value = dims[key];
      if (value !== undefined && (!isFiniteNumber(value) || value <= 0)) {
        pushError(errors, `dimensions.${key}`, 'invalid', `${key} must be > 0 when provided`);
      }
    }
    if (dims.overallWidthM !== undefined && dims.overallWidthM < v.trackWidth) {
      pushError(errors, 'dimensions.overallWidthM', 'invalid', 'overallWidthM must be >= trackWidth');
    }
  }
  if (v.tires && typeof v.tires === 'object') {
    const tires = v.tires;
    const positiveTireFields = [
      'frontSectionWidthM',
      'rearSectionWidthM',
      'frontOverallDiameterM',
      'rearOverallDiameterM',
    ] as const;
    for (const key of positiveTireFields) {
      const value = tires[key];
      if (value !== undefined && (!isFiniteNumber(value) || value <= 0)) {
        pushError(errors, `tires.${key}`, 'invalid', `${key} must be > 0 when provided`);
      }
    }
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
  const physics = v.physics;
  if (physics && typeof physics === 'object') {
    const finitePositiveFields = [
      'massKg',
      'inertiaPitchKgM2',
      'inertiaYawKgM2',
      'inertiaRollKgM2',
      'springFrontNpm',
      'springRearNpm',
      'damperBumpFrontNsPm',
      'damperReboundFrontNsPm',
      'damperBumpRearNsPm',
      'damperReboundRearNsPm',
      'arbFrontNpm',
      'arbRearNpm',
      'brakeTorqueMaxNm',
      'cdAreaM2',
      'yawAeroCoeff',
      'cgHeightM',
      'sprungCgHeightM',
      'unsprungCgHeightM',
      'unsprungMassFrontKg',
      'unsprungMassRearKg',
      'engineInertiaKgM2',
      'flywheelInertiaKgM2',
      'gearboxInputInertiaKgM2',
      'propshaftInertiaKgM2',
      'diffInertiaKgM2',
      'clutchMaxTorqueNm',
      'clutchStickThresholdRadPerSec',
      'diffCapacityNm',
      'pneumaticTrailDecayDeg',
      'steeringAlignTorqueMaxNm',
      // M1 tire additions
      'tireColdPressureKpa',
      'tireOptimalPressureKpa',
      'tireRadialStiffnessNpm',
      'tireRadialDampingNspm',
      // M2 FFB geometry
      'ffbKpiDeg',
      'ffbMaxNm',
      'ffbAssistPeakKmh',
    ] as const;
    for (const key of finitePositiveFields) {
      const value = physics[key];
      if (value !== undefined && (!isFiniteNumber(value) || value <= 0)) {
        pushError(errors, `physics.${key}`, 'invalid', `${key} must be > 0 when provided`);
      }
    }
    if (
      physics.brakeBiasFront !== undefined &&
      (!isFiniteNumber(physics.brakeBiasFront) || physics.brakeBiasFront < 0 || physics.brakeBiasFront > 1)
    ) {
      pushError(errors, 'physics.brakeBiasFront', 'invalid', 'brakeBiasFront must be in [0, 1]');
    }
    const nonNegativeFields = [
      'clAreaFrontM2',
      'clAreaRearM2',
      'diffPreloadNm',
      'pneumaticTrail0M',
      'casterTrailScaleMPerDeg',
      'mechanicalTrailMaxM',
      'scrubRadiusM',
      'steeringAlignCentreRateScale',
      // M2 FFB geometry
      'ffbSaiScale',
      'ffbScrubRadiusM',
      'ffbCasterTrailM',
      'ffbGain',
      'ffbAssistMin',
    ] as const;
    for (const key of nonNegativeFields) {
      const value = physics[key];
      if (value !== undefined && (!isFiniteNumber(value) || value < 0)) {
        pushError(errors, `physics.${key}`, 'invalid', `${key} must be >= 0 when provided`);
      }
    }
    for (const tireKey of ['tireFront', 'tireRear'] as const) {
      const tire = physics[tireKey];
      if (tire === undefined) continue;
      if (typeof tire !== 'object' || tire === null) {
        pushError(errors, `physics.${tireKey}`, 'invalid', `${tireKey} must be an object when provided`);
        continue;
      }
      for (const [k, v] of Object.entries(tire)) {
        if (v !== undefined && !isFiniteNumber(v)) {
          pushError(
            errors,
            `physics.${tireKey}.${k}`,
            'invalid',
            `${tireKey}.${k} must be a finite number when provided`,
          );
        }
      }
    }
    // M3 damper knee params validation.
    for (const damperKey of ['damperFront', 'damperRear'] as const) {
      const d = physics[damperKey];
      if (d === undefined) continue;
      if (typeof d !== 'object' || d === null) {
        pushError(errors, `physics.${damperKey}`, 'invalid', `${damperKey} must be an object when provided`);
        continue;
      }
      const damperPositiveFields = ['lsb', 'hsb', 'kneeB', 'lsr', 'hsr', 'kneeR'] as const;
      for (const field of damperPositiveFields) {
        const val = (d as Record<string, unknown>)[field];
        if (val !== undefined && (!isFiniteNumber(val) || val <= 0)) {
          pushError(errors, `physics.${damperKey}.${field}`, 'invalid', `${damperKey}.${field} must be > 0 when provided`);
        }
      }
    }
    // M3 kinematic table validation: each table must be an array of [number, number] pairs.
    const kinematicTableFields = [
      'bumpSteerFront', 'bumpSteerRear',
      'camberTableFront', 'camberTableRear',
      'casterTableFront', 'casterTableRear',
      'rollCenterTableFront', 'rollCenterTableRear',
      'bumpStopRateTableFront', 'bumpStopRateTableRear',
    ] as const;
    for (const tableKey of kinematicTableFields) {
      const table = physics[tableKey];
      if (table === undefined) continue;
      if (!Array.isArray(table)) {
        pushError(errors, `physics.${tableKey}`, 'invalid', `${tableKey} must be an array when provided`);
        continue;
      }
      for (let ti = 0; ti < table.length; ti++) {
        const entry = table[ti];
        if (!Array.isArray(entry) || entry.length !== 2 || !isFiniteNumber(entry[0]) || !isFiniteNumber(entry[1])) {
          pushError(errors, `physics.${tableKey}[${ti}]`, 'invalid', `${tableKey}[${ti}] must be [number, number]`);
        }
      }
    }
    // M5 aero map validation.
    if (physics.aeroMap !== undefined) {
      const am = physics.aeroMap;
      if (typeof am !== 'object' || am === null) {
        pushError(errors, 'physics.aeroMap', 'invalid', 'aeroMap must be an object when provided');
      } else {
        for (const mapKey of ['frontClAreaMap', 'rearClAreaMap', 'yawDragMap'] as const) {
          const tbl = am[mapKey];
          if (tbl === undefined) continue;
          if (typeof tbl !== 'object' || tbl === null) {
            pushError(errors, `physics.aeroMap.${mapKey}`, 'invalid', `${mapKey} must be an object when provided`);
            continue;
          }
          if (!Array.isArray(tbl.axis0) || tbl.axis0.some((v: unknown) => !isFiniteNumber(v))) {
            pushError(errors, `physics.aeroMap.${mapKey}.axis0`, 'invalid', 'axis0 must be an array of finite numbers');
          }
          if (!Array.isArray(tbl.axis1) || tbl.axis1.some((v: unknown) => !isFiniteNumber(v))) {
            pushError(errors, `physics.aeroMap.${mapKey}.axis1`, 'invalid', 'axis1 must be an array of finite numbers');
          }
          if (!Array.isArray(tbl.data)) {
            pushError(errors, `physics.aeroMap.${mapKey}.data`, 'invalid', 'data must be an array of rows');
          } else {
            for (let ri = 0; ri < tbl.data.length; ri++) {
              const row = tbl.data[ri];
              if (!Array.isArray(row) || row.some((v: unknown) => !isFiniteNumber(v))) {
                pushError(
                  errors,
                  `physics.aeroMap.${mapKey}.data[${ri}]`,
                  'invalid',
                  `data[${ri}] must be an array of finite numbers`,
                );
              }
            }
          }
        }
        if (am.copFraction !== undefined && (!isFiniteNumber(am.copFraction) || am.copFraction < 0 || am.copFraction > 1)) {
          pushError(errors, 'physics.aeroMap.copFraction', 'invalid', 'copFraction must be in [0, 1] when provided');
        }
        if (am.stallRideHeightM !== undefined && (!isFiniteNumber(am.stallRideHeightM) || am.stallRideHeightM < 0)) {
          pushError(errors, 'physics.aeroMap.stallRideHeightM', 'invalid', 'stallRideHeightM must be >= 0 when provided');
        }
      }
    }
    if (
      physics.clutchStaticFactor !== undefined &&
      (!isFiniteNumber(physics.clutchStaticFactor) || physics.clutchStaticFactor < 1)
    ) {
      pushError(errors, 'physics.clutchStaticFactor', 'invalid', 'clutchStaticFactor must be >= 1 when provided');
    }
    if (
      physics.drivetrainSubsteps !== undefined &&
      (!Number.isInteger(physics.drivetrainSubsteps) || physics.drivetrainSubsteps < 1)
    ) {
      pushError(
        errors,
        'physics.drivetrainSubsteps',
        'invalid',
        'drivetrainSubsteps must be an integer >= 1',
      );
    }
    const rampFields = ['diffPowerRamp', 'diffCoastRamp'] as const;
    for (const key of rampFields) {
      const value = physics[key];
      if (value !== undefined && (!isFiniteNumber(value) || value < 0 || value > 1)) {
        pushError(errors, `physics.${key}`, 'invalid', `${key} must be in [0, 1] when provided`);
      }
    }
    // M8: wake field validation.
    const m8NonNegativeFields = ['wakeLengthM', 'wakeWidthM', 'wheelInertiaKgM2'] as const;
    for (const key of m8NonNegativeFields) {
      const value = physics[key];
      if (value !== undefined && (!isFiniteNumber(value) || value < 0)) {
        pushError(errors, `physics.${key}`, 'invalid', `${key} must be >= 0 when provided`);
      }
    }
    if (physics.wakeReductionPct !== undefined && (!isFiniteNumber(physics.wakeReductionPct) || physics.wakeReductionPct < 0 || physics.wakeReductionPct > 1)) {
      pushError(errors, 'physics.wakeReductionPct', 'invalid', 'wakeReductionPct must be in [0, 1] when provided');
    }
    // M6: turbo params validation.
    if (physics.turbo !== undefined) {
      const t = physics.turbo;
      if (typeof t !== 'object' || t === null || Array.isArray(t)) {
        pushError(errors, 'physics.turbo', 'invalid', 'turbo must be an object when provided');
      } else {
        const turboPositive = ['peakBoostBar', 'peakTorqueMultiplier', 'targetSpoolRpm', 'spoolUpTimeS', 'spoolDownTimeS'] as const;
        for (const field of turboPositive) {
          const val = (t as Record<string, unknown>)[field];
          if (val !== undefined && (!isFiniteNumber(val as number) || (val as number) <= 0)) {
            pushError(errors, `physics.turbo.${field}`, 'invalid', `turbo.${field} must be > 0 when provided`);
          }
        }
        const turboNonNeg = ['overboostLimitBar', 'idleSpoolRatio', 'efficiencyScale'] as const;
        for (const field of turboNonNeg) {
          const val = (t as Record<string, unknown>)[field];
          if (val !== undefined && (!isFiniteNumber(val as number) || (val as number) < 0)) {
            pushError(errors, `physics.turbo.${field}`, 'invalid', `turbo.${field} must be >= 0 when provided`);
          }
        }
      }
    }
    // M6: engineTorqueMap validation.
    if (physics.engineTorqueMap !== undefined) {
      const m = physics.engineTorqueMap;
      if (typeof m !== 'object' || m === null || Array.isArray(m)) {
        pushError(errors, 'physics.engineTorqueMap', 'invalid', 'engineTorqueMap must be an object when provided');
      } else {
        if (!Array.isArray(m.axis0) || m.axis0.some((v: unknown) => !isFiniteNumber(v))) {
          pushError(errors, 'physics.engineTorqueMap.axis0', 'invalid', 'axis0 must be an array of finite numbers');
        }
        if (!Array.isArray(m.axis1) || m.axis1.some((v: unknown) => !isFiniteNumber(v))) {
          pushError(errors, 'physics.engineTorqueMap.axis1', 'invalid', 'axis1 must be an array of finite numbers');
        }
        if (!Array.isArray(m.data)) {
          pushError(errors, 'physics.engineTorqueMap.data', 'invalid', 'data must be an array of rows');
        } else {
          for (let ri = 0; ri < m.data.length; ri++) {
            const row = m.data[ri];
            if (!Array.isArray(row) || row.some((v: unknown) => !isFiniteNumber(v))) {
              pushError(errors, `physics.engineTorqueMap.data[${ri}]`, 'invalid', `data[${ri}] must be an array of finite numbers`);
            }
          }
        }
      }
    }
    // M6: engineTorqueCurve validation.
    if (physics.engineTorqueCurve !== undefined) {
      if (!Array.isArray(physics.engineTorqueCurve) || physics.engineTorqueCurve.length < 2) {
        pushError(errors, 'physics.engineTorqueCurve', 'invalid', 'engineTorqueCurve must be an array of at least 2 [rpm, Nm] pairs');
      } else {
        for (let ci = 0; ci < physics.engineTorqueCurve.length; ci++) {
          const pt = physics.engineTorqueCurve[ci];
          if (!Array.isArray(pt) || pt.length !== 2 || !isFiniteNumber(pt[0]) || !isFiniteNumber(pt[1])) {
            pushError(errors, `physics.engineTorqueCurve[${ci}]`, 'invalid', `engineTorqueCurve[${ci}] must be [number, number]`);
          }
        }
      }
    }
    // M6: shiftLogic validation.
    if (physics.shiftLogic !== undefined) {
      const sl = physics.shiftLogic;
      if (typeof sl !== 'object' || sl === null || Array.isArray(sl)) {
        pushError(errors, 'physics.shiftLogic', 'invalid', 'shiftLogic must be an object when provided');
      } else {
        const shiftNonNeg = ['upshiftMinRpm', 'upshiftMaxRpm', 'downshiftMinRpm', 'downshiftMaxRpm'] as const;
        for (const field of shiftNonNeg) {
          const val = (sl as Record<string, unknown>)[field];
          if (val !== undefined && (!isFiniteNumber(val as number) || (val as number) < 0)) {
            pushError(errors, `physics.shiftLogic.${field}`, 'invalid', `shiftLogic.${field} must be >= 0 when provided`);
          }
        }
        const slTime = (sl as Record<string, unknown>)['shiftTimeS'];
        if (slTime !== undefined && (!isFiniteNumber(slTime as number) || (slTime as number) < 0)) {
          pushError(errors, 'physics.shiftLogic.shiftTimeS', 'invalid', 'shiftLogic.shiftTimeS must be >= 0 when provided');
        }
        const slCut = (sl as Record<string, unknown>)['shiftThrottleCutFraction'];
        if (slCut !== undefined && (!isFiniteNumber(slCut as number) || (slCut as number) < 0 || (slCut as number) > 1)) {
          pushError(errors, 'physics.shiftLogic.shiftThrottleCutFraction', 'invalid', 'shiftThrottleCutFraction must be in [0, 1] when provided');
        }
      }
    }
    // M6: drivelineCompliance validation.
    if (physics.drivelineCompliance !== undefined) {
      const dc = physics.drivelineCompliance;
      if (typeof dc !== 'object' || dc === null || Array.isArray(dc)) {
        pushError(errors, 'physics.drivelineCompliance', 'invalid', 'drivelineCompliance must be an object when provided');
      } else {
        const dcNonNeg = ['shaftStiffnessNmRad', 'shaftDampingNmSRad', 'backlashRad'] as const;
        for (const field of dcNonNeg) {
          const val = (dc as Record<string, unknown>)[field];
          if (val !== undefined && (!isFiniteNumber(val as number) || (val as number) < 0)) {
            pushError(errors, `physics.drivelineCompliance.${field}`, 'invalid', `drivelineCompliance.${field} must be >= 0 when provided`);
          }
        }
      }
    }
    // M9: compliance validation.
    if (physics.compliance !== undefined) {
      const comp = physics.compliance;
      if (typeof comp !== 'object' || comp === null || Array.isArray(comp)) {
        pushError(errors, 'physics.compliance', 'invalid', 'compliance must be an object when provided');
      } else {
        const compNonNeg = ['hubLinearStiffnessNpm', 'hubLinearDampingNspms', 'hubRotationalStiffnessNmDeg', 'hubRotationalDampingNmSdeg', 'chassisTorsionalStiffnessNmDeg'] as const;
        for (const field of compNonNeg) {
          const val = (comp as Record<string, unknown>)[field];
          if (val !== undefined && (!isFiniteNumber(val as number) || (val as number) < 0)) {
            pushError(errors, `physics.compliance.${field}`, 'invalid', `compliance.${field} must be >= 0 when provided`);
          }
        }
      }
    }
    // M6: engineBraking validation.
    if (physics.engineBraking !== undefined) {
      const eb = physics.engineBraking;
      if (typeof eb !== 'object' || eb === null || Array.isArray(eb)) {
        pushError(errors, 'physics.engineBraking', 'invalid', 'engineBraking must be an object when provided');
      } else {
        const ebNonNeg = ['linearNmPerRadS', 'constantNm', 'pumpingCoeffNmPerRadS2', 'maxBrakeTorqueNm'] as const;
        for (const field of ebNonNeg) {
          const val = (eb as Record<string, unknown>)[field];
          if (val !== undefined && (!isFiniteNumber(val as number) || (val as number) < 0)) {
            pushError(errors, `physics.engineBraking.${field}`, 'invalid', `engineBraking.${field} must be >= 0 when provided`);
          }
        }
      }
    }
    // Chassis compliance validation.
    if (physics.compliance !== undefined) {
      const cc = physics.compliance;
      if (typeof cc !== 'object' || cc === null || Array.isArray(cc)) {
        pushError(errors, 'physics.compliance', 'invalid', 'compliance must be an object when provided');
      } else {
        const ccNonNeg = [
          'hubLinearStiffnessNpm',
          'hubLinearDampingNspms',
          'hubRotationalStiffnessNmDeg',
          'hubRotationalDampingNmSdeg',
          'chassisTorsionalStiffnessNmDeg',
        ] as const;
        for (const field of ccNonNeg) {
          const val = (cc as Record<string, unknown>)[field];
          if (val !== undefined && (!isFiniteNumber(val as number) || (val as number) < 0)) {
            pushError(errors, `physics.compliance.${field}`, 'invalid', `compliance.${field} must be >= 0 when provided`);
          }
        }
        if (cc.hubLinearStiffnessNpm !== undefined && (cc.hubLinearStiffnessNpm as number) > 500_000) {
          pushError(errors, 'physics.compliance.hubLinearStiffnessNpm', 'range', 'hubLinearStiffnessNpm must be <= 500000');
        }
        if (cc.hubRotationalStiffnessNmDeg !== undefined && (cc.hubRotationalStiffnessNmDeg as number) > 10_000) {
          pushError(errors, 'physics.compliance.hubRotationalStiffnessNmDeg', 'range', 'hubRotationalStiffnessNmDeg must be <= 10000');
        }
        if (cc.chassisTorsionalStiffnessNmDeg !== undefined && (cc.chassisTorsionalStiffnessNmDeg as number) > 100_000) {
          pushError(errors, 'physics.compliance.chassisTorsionalStiffnessNmDeg', 'range', 'chassisTorsionalStiffnessNmDeg must be <= 100000');
        }
      }
    }
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

  // M4: elevation samples validation.
  if (Array.isArray(t.elevationSamples)) {
    for (let i = 0; i < t.elevationSamples.length; i++) {
      const s = t.elevationSamples[i] as Partial<{ segmentIndex: unknown; y: unknown }>;
      if (!Number.isInteger(s?.segmentIndex) || (s.segmentIndex as number) < 0) {
        pushError(errors, `elevationSamples[${i}].segmentIndex`, 'invalid', 'segmentIndex must be a non-negative integer');
      }
      if (!isFiniteNumber(s?.y)) {
        pushError(errors, `elevationSamples[${i}].y`, 'invalid', 'y must be a finite number');
      }
    }
  }

  // M4: kerb profile validation.
  if (t.kerbProfile !== undefined) {
    const kp = t.kerbProfile as Partial<{ widthM: unknown; crownHeightM: unknown; topFlatFraction: unknown; bumpForceN: unknown }>;
    if (!isFiniteNumber(kp?.widthM) || (kp.widthM as number) <= 0) {
      pushError(errors, 'kerbProfile.widthM', 'invalid', 'kerbProfile.widthM must be > 0');
    }
    if (!isFiniteNumber(kp?.crownHeightM) || (kp.crownHeightM as number) < 0) {
      pushError(errors, 'kerbProfile.crownHeightM', 'invalid', 'kerbProfile.crownHeightM must be >= 0');
    }
    if (!isFiniteNumber(kp?.topFlatFraction) || (kp.topFlatFraction as number) < 0 || (kp.topFlatFraction as number) > 1) {
      pushError(errors, 'kerbProfile.topFlatFraction', 'invalid', 'kerbProfile.topFlatFraction must be in [0, 1]');
    }
    if (!isFiniteNumber(kp?.bumpForceN) || (kp.bumpForceN as number) < 0) {
      pushError(errors, 'kerbProfile.bumpForceN', 'invalid', 'kerbProfile.bumpForceN must be >= 0');
    }
  }

  // M4: scalar track condition fields.
  if (t.bumpAmplitudeM !== undefined && (!isFiniteNumber(t.bumpAmplitudeM) || t.bumpAmplitudeM < 0)) {
    pushError(errors, 'bumpAmplitudeM', 'invalid', 'bumpAmplitudeM must be >= 0 when provided');
  }
  if (t.trackTempC !== undefined && !isFiniteNumber(t.trackTempC)) {
    pushError(errors, 'trackTempC', 'invalid', 'trackTempC must be a finite number when provided');
  }
  if (t.rubberLineGrip !== undefined && (!isFiniteNumber(t.rubberLineGrip) || t.rubberLineGrip <= 0)) {
    pushError(errors, 'rubberLineGrip', 'invalid', 'rubberLineGrip must be > 0 when provided');
  }
  if (t.wetness !== undefined && (!isFiniteNumber(t.wetness) || t.wetness < 0 || t.wetness > 1)) {
    pushError(errors, 'wetness', 'invalid', 'wetness must be in [0, 1] when provided');
  }
  if (t.condition !== undefined && (typeof t.condition !== 'string' || t.condition.trim().length === 0)) {
    pushError(errors, 'condition', 'invalid', 'condition must be a non-empty string when provided');
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
