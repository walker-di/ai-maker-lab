export interface ProjectileArcPoint {
  col: number;
  row: number;
  altitude: number;
}

export function sampleProjectileArc(
  from: ProjectileArcPoint,
  to: ProjectileArcPoint,
  progress: number,
  arc: 'direct' | 'parabolic',
): ProjectileArcPoint {
  const t = Math.max(0, Math.min(1, progress));
  const col = from.col + (to.col - from.col) * t;
  const row = from.row + (to.row - from.row) * t;
  const baseAltitude = from.altitude + (to.altitude - from.altitude) * t;
  const lift = arc === 'parabolic' ? Math.sin(Math.PI * t) * 1.65 : 0;
  return { col, row, altitude: baseAltitude + lift };
}
