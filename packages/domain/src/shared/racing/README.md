# Shared Racing Types

Browser-safe shared domain types for the racing experiment (`/experiments/racing`).

These exports cover vehicle and track presets, the surface palette, setup
tunables, lap / session bookkeeping, and validators consumed by both the
built-in catalog loader and the transport adapters.

## Boundaries

- Must stay browser-safe. No imports from Three.js, Jolt, SurrealDB, SvelteKit,
  or any infrastructure modules.
- The UI package mirrors these shapes locally in
  `packages/ui/src/lib/racing/types.ts` per the chat / platformer / RTS
  pattern. Domain types satisfy the UI mirror structurally when passed in
  from the app layer.
- Application use cases consume these types and the validators from
  `validation.ts`.

## Modules

- `surface-types.ts` — `SurfaceId`, `SurfaceDef`, and the seven named surfaces
  (`RUBBER`, `ASPHALT`, `MARBLES`, `DAMP`, `CURB`, `GRASS`, `GRAVEL`).
- `vehicle-types.ts` — `VehiclePreset` plus drivetrain / gear / axle-share
  sub-shapes.  Includes `ComplianceConfig` (M9) for chassis torsional
  stiffness and suspension bushing stiffness.
- `track-types.ts` — `TrackPreset`, `CenterlineCtrl`, `SurfaceZone`,
  `SceneryHint`.
- `setup-types.ts` — `SetupValues`, `defaultSetup`, `clampSetup`.
- `match-types.ts` — `RacingSession`, `LapResult`, `SectorTime`, `BestLapKey`.
- `validation.ts` — `validateVehiclePreset`, `validateTrackPreset`.

## ComplianceConfig (M9)

`ComplianceConfig` lives on `VehiclePhysicsPreset.compliance` and provides
optional chassis-compliance parameters:

- `hubLinearStiffnessNpm` — bushing linear stiffness (N/m). 0 = rigid.
- `hubLinearDampingNspms` — bushing linear damping (N·s/m).
- `hubRotationalStiffnessNmDeg` — bushing rotational stiffness (N·m/deg).
- `hubRotationalDampingNmSdeg` — bushing rotational damping (N·m·s/deg).
- `chassisTorsionalStiffnessNmDeg` — chassis torsional spring rate
  (N·m/deg). 0 = rigid.

All fields are optional with zero defaults.  Presets that omit the block
continue to behave as perfectly rigid bodies (backward compatible).
