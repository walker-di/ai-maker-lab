# Racing UI module

Browser-side racing simulation. Three.js renders, Jolt physics integrates,
and a Svelte 5 HUD reads engine snapshots.

## Layout

- `engine/` — orchestrator + per-frame pipeline.
  - `RacingEngine.ts` — chassis state, wheel pass, drivetrain, lap timer.
  - `physics/` — pure helpers (`pacejka`, `engine-curve`, `arb`, `aero`,
    `mz`, `tire-thermal`, `drivetrain`, `driver-aids`, `brakes`, etc.).
  - `tracks/` — `catmull-rom`, `ribbon-geometry`, `surface-lookup`,
    `scenery-placement`.
  - `cameras.ts` — chase / hood / far / map rig.
  - `three-renderer.ts` — WebGL scene, chassis + wheel meshes, track
    ribbon, scenery placement.
  - `input.ts` — keyboard input controller (WASD / arrows / shift / Q-E).
  - `audio-bus.ts` — `AudioBus` interface and `NullAudioBus` placeholder.
  - `events.ts` — typed `EngineEmitter` (`tick`, `lapStarted`, `lapFinished`,
    `wheelEvent`).
  - `jolt-loader.ts` — Jolt WASM init + collision-layer table.
  - `fixed-step-loop.ts` — re-export of the platformer 240 Hz accumulator.
- `runtime/` — Svelte HUD model + cards.
  - `RacingHud.svelte.ts` — `state = $state<RacingHudState>({...})` + mutators.
  - `RacingHud.svelte` — root composition.
  - `components/*.svelte` — `SpeedCard`, `RpmCard`, `GearCard`, `LapCard`,
    `InputCard`, `WheelCard`, `DriftPanel`.
- `types.ts` — local UI-side mirrors of domain types (no domain imports).

## Boundaries

- `packages/ui/src/lib/racing/` MUST NOT import from `domain/infrastructure`,
  `domain/application`, or `surrealdb`. The `engine/import-boundaries.test.ts`
  file enforces this.
- The route imports the namespaced `Racing.Engine.RacingEngine`,
  `Racing.Engine.RacingRenderer`, and `Racing.Runtime.RacingHud`.
- Type duplication with `domain/shared/racing` is intentional: domain types
  flowing in from the app structurally satisfy the local mirrors so the UI
  package doesn't depend on `domain`.

## Tests

```sh
bun test packages/ui/src/lib/racing/
```

77 tests across 8 files cover physics helpers, advanced contributors
(camber, ARB, anti-dive, brake fade, yaw-aero, Mz, slipping clutch,
diff variants, thermal models), and import boundaries.
