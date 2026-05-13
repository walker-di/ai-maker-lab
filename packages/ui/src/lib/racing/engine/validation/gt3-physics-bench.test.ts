import { describe, expect, it } from 'bun:test';
import {
  GT3_RWD_SYNTHETIC_ENVELOPE,
  runGt3TireBench,
  validateGt3BenchEnvelope,
} from './gt3-physics-bench.js';

describe('GT3 physics validation harness', () => {
  it('generates deterministic plot-ready tire bench series', () => {
    const a = runGt3TireBench();
    const b = runGt3TireBench();

    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.pureLongitudinal.length).toBeGreaterThan(10);
    expect(a.pureLateral.length).toBeGreaterThan(10);
    expect(a.combinedSlip.length).toBeGreaterThan(10);
    expect(a.pressureSweep.length).toBeGreaterThan(5);
    expect(a.relaxationStep.some((p) => (p.dynamic ?? 0) > 0.063)).toBe(true);
  });

  it('keeps the synthetic GT3 seed inside locked physics envelopes', () => {
    const bench = runGt3TireBench();
    const findings = validateGt3BenchEnvelope(bench.summary, GT3_RWD_SYNTHETIC_ENVELOPE);
    expect(findings).toEqual([]);
  });
});
