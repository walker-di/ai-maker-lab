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
  - `compliance.ts` — M9 chassis compliance: hub bodies, `SixDOFConstraint`,
    torsional restoring torque, software fallback for non-Jolt environments.
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
bun run --filter ui test:browser:racing
bun run --filter desktop-app test:racing:assets
bun run test:racing:assets
```

The racing asset checks are split across three layers:

- `packages/ui/src/lib/racing/engine/three-renderer.browser.test.ts` mocks
  `GLTFLoader` and verifies renderer-side asset caching, scenery rebuilds,
  and primitive fallback behavior without launching the full app.
- `apps/desktop-app/src/routes/experiments/racing/racing-kenney-assets.test.ts`
  validates that the shipped desktop bundle still includes Kenney attribution,
  `static/racing/License.txt`, and the expected GLB families on disk.
- `apps/desktop-app/e2e/racing/racing-assets.e2e.ts` proves the browser route
  actually requests `/racing/extracted/*.glb` at runtime and stays playable
  when those GLBs fail to load.

The existing package tests continue to cover physics helpers, advanced
contributors (camber, ARB, anti-dive, brake fade, yaw-aero, Mz, slipping
clutch, diff variants, thermal models), and import boundaries.

### GT3 physics-lab validation

The GT3/RWD benchmark path starts from deterministic, plot-ready tire data:

- `engine/physics/tire-dataset.ts` owns the versioned `gt3-rwd-slick`
  synthetic seed. Replace this dataset with measured tire-rig data when it is
  available; do not hide fitted values as anonymous constants.
- `engine/physics/contact-patch.ts` adds the first dynamic contact-patch
  layer: load-sensitive relaxation length, sliding-speed grip loss,
  three-strip pressure distribution, and overturning-moment telemetry.
- `engine/validation/gt3-physics-bench.ts` generates pure Fx/Fy, combined
  slip, camber, pressure, temperature, load, and relaxation step-response
  series from the same helpers used by `RacingEngine`.

Run the current GT3 lab guard with:

```sh
bun test packages/ui/src/lib/racing/engine/physics/tire-dataset.test.ts packages/ui/src/lib/racing/engine/physics/contact-patch.test.ts packages/ui/src/lib/racing/engine/validation/gt3-physics-bench.test.ts
```

The bench envelope is synthetic for now. When real GT3 tire or telemetry data
arrives, update the dataset version, regenerate the plot series, and tighten
`GT3_RWD_SYNTHETIC_ENVELOPE` into measured acceptance ranges.

### Chassis compliance (M9)

When a vehicle preset carries nonzero `compliance` fields, the engine
activates a localized soft-constraint layer between the chassis and four
wheel-hub bodies:

- **Jolt path** (when `PhysicsContext` is supplied): real `SixDOFConstraint`
  with `SpringSettings` per hub; Jolt integrates chassis + hubs.
- **Software path** (fallback): explicit spring-damper compliance forces
  evaluated in plain JS; hubs and chassis are integrated together with
  semi-implicit Euler.  Physically equivalent at 240 Hz.
- **Rigid fallback** (default): when compliance fields are omitted or zero,
  behaviour is identical to pre-M9 code — no regression.

Compliance parameters:
- `hubLinearStiffnessNpm` — bushing spring rate (N/m).  0 = rigid lock.
- `hubLinearDampingNspms` — bushing damping (N·s/m).
- `hubRotationalStiffnessNmDeg` — bushing rotational stiffness (N·m/deg).
- `hubRotationalDampingNmSdeg` — bushing rotational damping (N·m·s/deg).
- `chassisTorsionalStiffnessNmDeg` — chassis torsional spring rate
  (N·m/deg).  Applied as a restoring torque on the chassis roll axis.

Tuning:
- Hub natural frequency should stay within 5–20 Hz (safe below tire carcass
  resonance at 60–100 Hz).  For a 20 kg hub, 150 kN/m gives ~13.8 Hz.
- Damping ratio 0.7–1.0 keeps the bushing critically damped.
- Torsional stiffness 15 000–30 000 N·m/deg is typical for GT3-class tubs.
- The effective wheel rate seen at the contact patch is the series
  combination of tire carcass (default 200 kN/m), bushing, and spring.

Preset authoring: add a `compliance` object inside `physics`.  The bundled
`gt3-rigid-tub` preset demonstrates nonzero values.
