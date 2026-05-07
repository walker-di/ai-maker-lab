/**
 * M5 Aero Map tests — bilinear interpolation, balance shift, yaw drag map,
 * stall behavior, and scalar fallback compatibility.
 */
import { describe, it, expect } from 'bun:test';
import {
  sampleAeroTable,
  computeAeroDownforce,
  computeAeroDrag,
  type AeroTableMap,
  type AeroMapPreset,
} from './aero.js';

// ---------------------------------------------------------------------------
// sampleAeroTable — bilinear interpolation
// ---------------------------------------------------------------------------

describe('sampleAeroTable', () => {
  const map: AeroTableMap = {
    axis0: [0, 1],
    axis1: [0, 1],
    data: [
      [0, 1],
      [2, 3],
    ],
  };

  it('returns corner values exactly', () => {
    expect(sampleAeroTable(map, 0, 0)).toBe(0);
    expect(sampleAeroTable(map, 0, 1)).toBe(1);
    expect(sampleAeroTable(map, 1, 0)).toBe(2);
    expect(sampleAeroTable(map, 1, 1)).toBe(3);
  });

  it('interpolates along axis1 at axis0=0', () => {
    // At axis0=0, between axis1=0 (val=0) and axis1=1 (val=1): midpoint = 0.5
    expect(sampleAeroTable(map, 0, 0.5)).toBeCloseTo(0.5, 10);
  });

  it('interpolates along axis0 at axis1=0', () => {
    // At axis1=0, between axis0=0 (val=0) and axis0=1 (val=2): midpoint = 1
    expect(sampleAeroTable(map, 0.5, 0)).toBeCloseTo(1, 10);
  });

  it('bilinear interpolation at center of table', () => {
    // Bilinear at (0.5, 0.5): average of all four corners = (0+1+2+3)/4 = 1.5
    expect(sampleAeroTable(map, 0.5, 0.5)).toBeCloseTo(1.5, 10);
  });

  it('clamps primary axis below lower bound', () => {
    expect(sampleAeroTable(map, -1, 0)).toBe(0);
  });

  it('clamps primary axis above upper bound', () => {
    expect(sampleAeroTable(map, 10, 1)).toBe(3);
  });

  it('clamps secondary axis below lower bound', () => {
    expect(sampleAeroTable(map, 0, -1)).toBe(0);
  });

  it('clamps secondary axis above upper bound', () => {
    expect(sampleAeroTable(map, 1, 10)).toBe(3);
  });

  it('handles single-row single-column table', () => {
    const single: AeroTableMap = { axis0: [0.1], axis1: [0], data: [[7]] };
    expect(sampleAeroTable(single, 0.1, 0)).toBe(7);
    expect(sampleAeroTable(single, 999, 999)).toBe(7);
  });

  it('handles empty table gracefully', () => {
    const empty: AeroTableMap = { axis0: [], axis1: [], data: [] };
    expect(sampleAeroTable(empty, 0, 0)).toBe(0);
  });

  it('interpolates a 3x3 table correctly', () => {
    const big: AeroTableMap = {
      axis0: [0, 0.1, 0.2],
      axis1: [-5, 0, 5],
      data: [
        [1.0, 1.2, 1.1],
        [0.8, 1.0, 0.9],
        [0.5, 0.7, 0.6],
      ],
    };
    // At exact grid point (0.1, 0): value = 1.0
    expect(sampleAeroTable(big, 0.1, 0)).toBeCloseTo(1.0, 10);
    // Midpoint between (0, 0)=1.2 and (0.1, 0)=1.0: expect ~1.1
    expect(sampleAeroTable(big, 0.05, 0)).toBeCloseTo(1.1, 10);
  });
});

// ---------------------------------------------------------------------------
// computeAeroDownforce — scalar fallback (no map)
// ---------------------------------------------------------------------------

describe('computeAeroDownforce — scalar fallback', () => {
  it('produces zero at zero speed', () => {
    const r = computeAeroDownforce({ forwardSpeed: 0, clAreaFront: 0.5, clAreaRear: 0.7 });
    expect(r.frontDownforceN).toBe(0);
    expect(r.rearDownforceN).toBe(0);
    expect(r.copFraction).toBe(0.5);
    expect(r.frontStalled).toBe(false);
    expect(r.rearStalled).toBe(false);
  });

  it('grows quadratically with speed', () => {
    const r1 = computeAeroDownforce({ forwardSpeed: 50, clAreaFront: 1, clAreaRear: 1 });
    const r2 = computeAeroDownforce({ forwardSpeed: 100, clAreaFront: 1, clAreaRear: 1 });
    expect(r2.frontDownforceN).toBeCloseTo(r1.frontDownforceN * 4, 5);
  });

  it('splits front/rear correctly', () => {
    const r = computeAeroDownforce({ forwardSpeed: 60, clAreaFront: 1, clAreaRear: 3 });
    expect(r.rearDownforceN).toBeCloseTo(r.frontDownforceN * 3, 5);
    // CoP fraction closer to rear
    expect(r.copFraction).toBeGreaterThan(0.5);
  });

  it('exposes effectiveClArea equal to scalar input', () => {
    const r = computeAeroDownforce({ forwardSpeed: 40, clAreaFront: 0.6, clAreaRear: 0.9 });
    expect(r.effectiveClAreaFront).toBeCloseTo(0.6, 10);
    expect(r.effectiveClAreaRear).toBeCloseTo(0.9, 10);
  });

  it('clamps negative scalar clArea to 0', () => {
    const r = computeAeroDownforce({ forwardSpeed: 50, clAreaFront: -1, clAreaRear: 0 });
    expect(r.frontDownforceN).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeAeroDownforce — aero map active path
// ---------------------------------------------------------------------------

describe('computeAeroDownforce — aero map', () => {
  // Simple front map: more downforce at lower ride-height (ground effect)
  const frontMap: AeroTableMap = {
    axis0: [0.05, 0.15],  // ride-height (m)
    axis1: [-2, 0, 2],    // pitch (deg)
    data: [
      [1.5, 1.6, 1.4],   // low ride-height
      [0.8, 1.0, 0.9],   // high ride-height
    ],
  };
  const rearMap: AeroTableMap = {
    axis0: [0.05, 0.15],
    axis1: [-2, 0, 2],
    data: [
      [2.0, 2.2, 2.1],
      [1.4, 1.5, 1.45],
    ],
  };
  const aeroMap: AeroMapPreset = { frontClAreaMap: frontMap, rearClAreaMap: rearMap };

  it('uses table lookup values instead of scalar clArea', () => {
    // At low ride-height, zero pitch: front Cl·A = 1.6, rear = 2.2
    const r = computeAeroDownforce({
      forwardSpeed: 50,
      clAreaFront: 0, // would give 0 if scalar used
      clAreaRear: 0,
      aeroMap,
      frontRideHeightM: 0.05,
      rearRideHeightM: 0.05,
      pitchDeg: 0,
    });
    expect(r.effectiveClAreaFront).toBeCloseTo(1.6, 5);
    expect(r.effectiveClAreaRear).toBeCloseTo(2.2, 5);
    expect(r.frontDownforceN).toBeGreaterThan(0);
    expect(r.rearDownforceN).toBeGreaterThan(r.frontDownforceN);
  });

  it('shows balance shift: low ride-height gives more downforce than high', () => {
    const low = computeAeroDownforce({
      forwardSpeed: 60,
      clAreaFront: 0,
      clAreaRear: 0,
      aeroMap,
      frontRideHeightM: 0.05,
      rearRideHeightM: 0.05,
      pitchDeg: 0,
    });
    const high = computeAeroDownforce({
      forwardSpeed: 60,
      clAreaFront: 0,
      clAreaRear: 0,
      aeroMap,
      frontRideHeightM: 0.15,
      rearRideHeightM: 0.15,
      pitchDeg: 0,
    });
    expect(low.frontDownforceN).toBeGreaterThan(high.frontDownforceN);
    expect(low.rearDownforceN).toBeGreaterThan(high.rearDownforceN);
  });

  it('interpolates pitch effect on balance', () => {
    // At zero pitch, front table gives 1.6. At pitch=2 it gives 1.4 (nose-up = less front downforce).
    const noseDown = computeAeroDownforce({
      forwardSpeed: 60,
      clAreaFront: 0,
      clAreaRear: 0,
      aeroMap,
      frontRideHeightM: 0.05,
      rearRideHeightM: 0.05,
      pitchDeg: -2,
    });
    const noseUp = computeAeroDownforce({
      forwardSpeed: 60,
      clAreaFront: 0,
      clAreaRear: 0,
      aeroMap,
      frontRideHeightM: 0.05,
      rearRideHeightM: 0.05,
      pitchDeg: 2,
    });
    expect(noseDown.effectiveClAreaFront).toBeCloseTo(1.5, 5);
    expect(noseUp.effectiveClAreaFront).toBeCloseTo(1.4, 5);
    expect(noseDown.frontDownforceN).toBeGreaterThan(noseUp.frontDownforceN);
  });

  it('uses authored copFraction when provided', () => {
    const mapWithCop: AeroMapPreset = { ...aeroMap, copFraction: 0.65 };
    const r = computeAeroDownforce({
      forwardSpeed: 60,
      clAreaFront: 0,
      clAreaRear: 0,
      aeroMap: mapWithCop,
      frontRideHeightM: 0.1,
      rearRideHeightM: 0.1,
      pitchDeg: 0,
    });
    expect(r.copFraction).toBeCloseTo(0.65, 10);
  });

  it('falls back to scalar front when frontClAreaMap absent', () => {
    const partialMap: AeroMapPreset = { rearClAreaMap: rearMap };
    const r = computeAeroDownforce({
      forwardSpeed: 60,
      clAreaFront: 0.7,
      clAreaRear: 0,
      aeroMap: partialMap,
      frontRideHeightM: 0.05,
      rearRideHeightM: 0.05,
      pitchDeg: 0,
    });
    expect(r.effectiveClAreaFront).toBeCloseTo(0.7, 10);
    expect(r.effectiveClAreaRear).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Stall behavior
// ---------------------------------------------------------------------------

describe('computeAeroDownforce — stall telemetry', () => {
  const aeroMap: AeroMapPreset = {
    frontClAreaMap: {
      axis0: [0.02, 0.10],
      axis1: [0],
      data: [[0.3], [1.0]],  // low ride-height stalls (less downforce)
    },
    rearClAreaMap: {
      axis0: [0.02, 0.10],
      axis1: [0],
      data: [[0.4], [1.5]],
    },
    stallRideHeightM: 0.04,
  };

  it('flags frontStalled when front ride-height below stall threshold', () => {
    const r = computeAeroDownforce({
      forwardSpeed: 50,
      clAreaFront: 0,
      clAreaRear: 0,
      aeroMap,
      frontRideHeightM: 0.02,
      rearRideHeightM: 0.10,
      pitchDeg: 0,
    });
    expect(r.frontStalled).toBe(true);
    expect(r.rearStalled).toBe(false);
  });

  it('flags rearStalled when rear ride-height below stall threshold', () => {
    const r = computeAeroDownforce({
      forwardSpeed: 50,
      clAreaFront: 0,
      clAreaRear: 0,
      aeroMap,
      frontRideHeightM: 0.10,
      rearRideHeightM: 0.02,
      pitchDeg: 0,
    });
    expect(r.frontStalled).toBe(false);
    expect(r.rearStalled).toBe(true);
  });

  it('does not flag stall when ride-height is above threshold', () => {
    const r = computeAeroDownforce({
      forwardSpeed: 50,
      clAreaFront: 0,
      clAreaRear: 0,
      aeroMap,
      frontRideHeightM: 0.10,
      rearRideHeightM: 0.10,
      pitchDeg: 0,
    });
    expect(r.frontStalled).toBe(false);
    expect(r.rearStalled).toBe(false);
  });

  it('no stall flags when map has no stallRideHeightM', () => {
    const noStallMap: AeroMapPreset = {
      frontClAreaMap: aeroMap.frontClAreaMap,
      rearClAreaMap: aeroMap.rearClAreaMap,
    };
    const r = computeAeroDownforce({
      forwardSpeed: 50,
      clAreaFront: 0,
      clAreaRear: 0,
      aeroMap: noStallMap,
      frontRideHeightM: 0.01,
      rearRideHeightM: 0.01,
      pitchDeg: 0,
    });
    expect(r.frontStalled).toBe(false);
    expect(r.rearStalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Yaw drag map
// ---------------------------------------------------------------------------

describe('computeAeroDrag — yaw drag map', () => {
  // Yaw drag map: rows = yaw deg [0, 10, 20], cols = speed kmh [0, 200]
  const yawMap: AeroTableMap = {
    axis0: [0, 10, 20],
    axis1: [0, 200],
    data: [
      [0, 0],         // yaw=0: no increment
      [0.1, 0.15],    // yaw=10: small increment
      [0.3, 0.4],     // yaw=20: large increment
    ],
  };

  it('scalar fallback when no yawDragMap', () => {
    const r = computeAeroDrag({ forwardSpeed: 30, sideSpeed: 5, cdArea: 0.6, yawDragGain: 1.6 });
    const rNoGain = computeAeroDrag({ forwardSpeed: 30, sideSpeed: 5, cdArea: 0.6, yawDragGain: 1.0 });
    // Higher yawDragGain should produce more lateral drag
    expect(Math.abs(r.fxDragWS)).toBeGreaterThan(Math.abs(rNoGain.fxDragWS));
  });

  it('map-based yaw drag increments drag at non-zero yaw', () => {
    // With zero side speed, no yaw drag contribution
    const straight = computeAeroDrag({
      forwardSpeed: 55.6, // 200 km/h
      sideSpeed: 0,
      cdArea: 0.7,
      yawDragMap: yawMap,
      speedKmh: 200,
    });
    // With side speed creating ~10° yaw at low speed
    const yawed = computeAeroDrag({
      forwardSpeed: 30,
      sideSpeed: 5.3, // ~10 deg yaw
      cdArea: 0.7,
      yawDragMap: yawMap,
      speedKmh: 120,
    });
    expect(straight.fxDragWS).toBe(0);
    expect(Math.abs(yawed.fxDragWS)).toBeGreaterThan(0);
  });

  it('map yaw drag is greater at large yaw than at small yaw', () => {
    const small = computeAeroDrag({
      forwardSpeed: 30,
      sideSpeed: 2,   // small yaw
      cdArea: 0.7,
      yawDragMap: yawMap,
      speedKmh: 100,
    });
    const large = computeAeroDrag({
      forwardSpeed: 10,
      sideSpeed: 10,  // large yaw
      cdArea: 0.7,
      yawDragMap: yawMap,
      speedKmh: 100,
    });
    // large yaw should produce more lateral drag per unit speed
    const ratioSmall = Math.abs(small.fxDragWS) / Math.hypot(30, 2);
    const ratioLarge = Math.abs(large.fxDragWS) / Math.hypot(10, 10);
    expect(ratioLarge).toBeGreaterThan(ratioSmall);
  });
});

// ---------------------------------------------------------------------------
// Scalar fallback compatibility (no aeroMap at all)
// ---------------------------------------------------------------------------

describe('computeAeroDownforce — scalar-only backward compatibility', () => {
  it('produces identical results with and without explicit undefined aeroMap', () => {
    const a = computeAeroDownforce({ forwardSpeed: 70, clAreaFront: 0.8, clAreaRear: 1.2 });
    const b = computeAeroDownforce({
      forwardSpeed: 70,
      clAreaFront: 0.8,
      clAreaRear: 1.2,
      aeroMap: undefined,
    });
    expect(a.frontDownforceN).toBeCloseTo(b.frontDownforceN, 10);
    expect(a.rearDownforceN).toBeCloseTo(b.rearDownforceN, 10);
    expect(a.copFraction).toBeCloseTo(b.copFraction, 10);
  });

  it('returns copFraction=0.5 when no downforce', () => {
    const r = computeAeroDownforce({ forwardSpeed: 0, clAreaFront: 0.5, clAreaRear: 0.5 });
    expect(r.copFraction).toBe(0.5);
  });

  it('returns copFraction=0.5 when downforce is exactly balanced', () => {
    const r = computeAeroDownforce({ forwardSpeed: 40, clAreaFront: 1.0, clAreaRear: 1.0 });
    expect(r.copFraction).toBeCloseTo(0.5, 8);
  });
});
