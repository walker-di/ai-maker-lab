export const TIRE_FZ_REF = 3500;
export const TIRE_LOAD_FALLOFF = 0.12;
export const ENGINE_CURVE = [
  [0, 0],
  [1000, 220],
  [2500, 360],
  [4000, 470],
  [5500, 520],
  [6800, 510],
  [7800, 460],
  [8500, 380],
  [9200, 0],
];
export const ENGINE_REDLINE = 8400;

const DEG = Math.PI / 180;

export function tireD(mu, fz) {
  return mu * fz * (1 - TIRE_LOAD_FALLOFF * (fz / TIRE_FZ_REF - 1));
}

export function pacejkaLat(slipAngleRad, fz, mu, fall = 0) {
  const alphaDeg = slipAngleRad * (180 / Math.PI);
  const B = 0.27;
  const C = 1.3;
  const D = tireD(mu, fz);
  const E = -1.6;
  const x = alphaDeg;
  let y = D * Math.sin(C * Math.atan(B * x - E * (B * x - Math.atan(B * x))));
  if (fall > 0) {
    const peakDeg = 7;
    const overshoot = Math.max(0, Math.abs(alphaDeg) - peakDeg);
    y *= 1 / (1 + fall * overshoot);
  }
  return y;
}

export function pacejkaLong(slipRatio, fz, mu) {
  const B = 14;
  const C = 1.65;
  const D = tireD(mu, fz);
  const E = 0.97;
  const x = slipRatio;
  return D * Math.sin(C * Math.atan(B * x - E * (B * x - Math.atan(B * x))));
}

export function engineTorqueAt(rpm) {
  const maxRpm = ENGINE_CURVE[ENGINE_CURVE.length - 1][0];
  const r = Math.max(0, Math.min(maxRpm, rpm));
  for (let i = 1; i < ENGINE_CURVE.length; i++) {
    const [r0, t0] = ENGINE_CURVE[i - 1];
    const [r1, t1] = ENGINE_CURVE[i];
    if (r <= r1) {
      const t = (r - r0) / Math.max(1, r1 - r0);
      return t0 + (t1 - t0) * t;
    }
  }
  return 0;
}

export function computeToeSlipOffset(toeDeg, lateralSign = 1, axle = 'front') {
  const direction = axle === 'rear' ? -1 : 1;
  return toeDeg * lateralSign * direction * DEG;
}

export function computeAckermannAngles(steerCmdRad, wheelbaseM, trackM, ackermannPct = 1) {
  const absSteer = Math.abs(steerCmdRad);
  if (absSteer < 1e-6 || ackermannPct <= 0) {
    return {
      leftRad: steerCmdRad,
      rightRad: steerCmdRad,
      innerRad: absSteer,
      outerRad: absSteer,
    };
  }
  const sign = Math.sign(steerCmdRad) || 1;
  const outer = absSteer;
  const outerRadius = wheelbaseM / Math.max(Math.tan(outer), 1e-6);
  const innerIdeal = Math.atan(wheelbaseM / Math.max(0.25, outerRadius - trackM));
  const inner = outer + (innerIdeal - outer) * ackermannPct;
  const leftRad = sign > 0 ? inner : outer;
  const rightRad = sign > 0 ? outer : inner;
  return {
    leftRad: leftRad * sign,
    rightRad: rightRad * sign,
    innerRad: inner,
    outerRad: outer,
  };
}

export function computeMotionRatio(rawRate, motionRatio) {
  return rawRate * motionRatio * motionRatio;
}

export function computeBumpStopForce(compression, threshold, bumpK) {
  if (compression <= threshold || bumpK <= 0) return 0;
  const over = compression - threshold;
  return bumpK * over * (1 + over / 0.03);
}

export function computeCasterCamber(steerRad, casterDeg) {
  return -Math.abs(Math.sin(steerRad)) * (casterDeg * DEG) * 0.35;
}
