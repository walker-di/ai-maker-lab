/**
 * Engine tunables. Centralized so feel adjustments do not require spelunking
 * across systems.
 */
export interface Tunables {
  gravity: number;
  maxFallSpeed: number;
  jumpImpulse: number;
  jumpHoldGravityScale: number;
  walkAccel: number;
  walkCap: number;
  runCap: number;
  friction: number;
  coyoteMs: number;
  bufferMs: number;
  enemyWalkSpeed: number;
  shellSlideSpeed: number;
  fireballSpeed: number;
  fireballGravity: number;
  bulletSpeed: number;
  starDurationMs: number;
  iframesMs: number;
  bumpScore: number;
  coinScore: number;
  stompScore: number;
  goalScore: number;
  flagBonusPerRow: number;
  springImpulse: number;
}

export const DEFAULT_TUNABLES: Tunables = {
  gravity: 1500,
  maxFallSpeed: 720,
  jumpImpulse: -560,
  jumpHoldGravityScale: 0.4,
  walkAccel: 800,
  walkCap: 140,
  runCap: 220,
  friction: 1200,
  coyoteMs: 100,
  bufferMs: 120,
  enemyWalkSpeed: 50,
  shellSlideSpeed: 280,
  fireballSpeed: 320,
  fireballGravity: 1200,
  bulletSpeed: 180,
  starDurationMs: 8000,
  iframesMs: 1200,
  bumpScore: 50,
  coinScore: 200,
  stompScore: 100,
  goalScore: 1000,
  flagBonusPerRow: 50,
  springImpulse: -780,
};
