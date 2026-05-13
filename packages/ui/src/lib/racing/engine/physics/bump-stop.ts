/**
 * Bump-stop force. Once suspension compression exceeds the bump-stop gap,
 * an additional progressive spring kicks in. We model it as
 * `bumpK · over · (1 + over / 0.03)` so the rate stays continuous at the
 * threshold and grows quickly past it (a real elastomer bump-stop is
 * highly progressive).
 */

export function computeBumpStopForce(
  compression: number,
  threshold: number,
  bumpK: number,
): number {
  if (compression <= threshold || bumpK <= 0) return 0;
  const over = compression - threshold;
  return bumpK * over * (1 + over / 0.03);
}
