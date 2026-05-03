## Implementation Tasks

### 1. Phase 1 — Workspace foundations (engine package + domain types)

- [x] 1.1 Add `three` and `jolt-physics` to `packages/ui/package.json` (dependencies, pinned to the versions the prototype proves on `esm.sh`). Run `bun install` from the workspace root and confirm both resolve in `packages/ui/node_modules`.
- [x] 1.2 Create the engine package skeleton at `packages/ui/src/lib/racing/` with `engine/`, `runtime/`, and an `index.ts` barrel that exports an empty `Racing` namespace. Re-export from `packages/ui/src/lib/index.ts` alongside `Rts` and `Platformer`.
- [x] 1.3 Migrate `.design_sketch/racing-sim-physics.js` to `packages/ui/src/lib/racing/engine/physics/` as TypeScript files (`pacejka.ts`, `engine-curve.ts`, `ackermann.ts`, `motion-ratio.ts`, `bump-stop.ts`, `caster-camber.ts`, `tire-load.ts`). Keep `tireD`, `pacejkaLat`, `pacejkaLong`, `engineTorqueAt`, `computeAckermannAngles`, `computeMotionRatio`, `computeBumpStopForce`, `computeCasterCamber`, and `computeToeSlipOffset` as pure functions with TypeScript types.
- [x] 1.4 Migrate `.design_sketch/racing-sim-physics.test.js` to `packages/ui/src/lib/racing/engine/physics/*.test.ts`. Convert imports to the new TS sources and confirm all assertions still pass under `bun test --filter racing`.
- [x] 1.5 Migrate `.design_sketch/track-geometry.test.js` to `packages/ui/src/lib/racing/engine/tracks/*.test.ts` alongside the migrated `ribbon-geometry.ts` and `catmull-rom.ts` helpers.
- [x] 1.6 Add `packages/domain/src/shared/racing/{vehicle-types,track-types,setup-types,surface-types,match-types}.ts` with the type definitions from the design doc. Add a barrel `index.ts` and a single-paragraph `README.md` (per the workspace rule). Re-export from `packages/domain/src/shared/index.ts`.
- [x] 1.7 Add `packages/domain/src/shared/racing/validation.ts` with `clampSetup(setup)`, `defaultSetup()`, and validators that surface invalid vehicle / track JSON early. Add `validation.test.ts` with at least the `clampSetup` cases the prototype implements.
- [x] 1.8 Add `packages/domain/src/application/racing/RacingTransport.ts` with the interface from the design doc and use cases under `domain/application/racing/use-cases/`. Add a `README.md`. Re-export from `packages/domain/src/application/index.ts`.
- [x] 1.9 Add `packages/domain/src/infrastructure/racing/builtins/` with one `*.json` per built-in vehicle (`rwd-front-mid`, `fwd-front`, `awd-rear-biased`) and per built-in track (`classic-twist`, `lakeside-gp`, `corkscrew-ridge`), authored from the prototype's in-file presets. Add a `loadBuiltinPresets()` helper and unit tests asserting each JSON file passes `validation`.
- [x] 1.10 Add an import-boundary test in `packages/ui/src/lib/racing/engine/import-boundaries.test.ts` (mirror the RTS one) asserting no import of `surrealdb`, `domain/infrastructure`, or `domain/application` from the engine, and a matching test in `packages/domain/.../racing/import-boundaries.test.ts` asserting no `three` or `jolt-physics` import from the domain.

### 2. Phase 2 — Engine core: simulation loop, physics, renderer, input, cameras

- [x] 2.1 Add `packages/ui/src/lib/racing/engine/jolt-loader.ts` that owns the `await initJolt()` promise, exposes `getJolt()` and `disposeJolt()`, and creates a static ground body + collision-layer table mirroring the prototype.
- [x] 2.2 Add `packages/ui/src/lib/racing/engine/fixed-step-loop.ts` (or reuse the platformer's pattern) configured for 240 Hz with `MAX_SUBSTEPS = 8`. Add a `fixed-step-loop.test.ts` covering the same accumulator semantics.
- [x] 2.3 Add `packages/ui/src/lib/racing/engine/physics/{camber,arb,anti-dive,drivetrain,brakes,aero,mz,driver-aids,tire-thermal}.ts` with the prototype's behaviour, including the already-merged tuning fixes: camber thrust uses `lateralSign`, ARB transfer gates on contact, off-throttle pumping drag is smoothed, engine curve sized to ~250 hp/ton, steering rate 2.5/s.
- [x] 2.4 Add `packages/ui/src/lib/racing/engine/RacingEngine.ts` that constructs the chassis (`Jolt.BodyCreationSettings` with explicit mass = 1240 kg and inertia diagonal `(1500, 1700, 450)`), runs the per-step pipeline (driver inputs → ARB pre-pass → per-wheel pass → drivetrain → brakes → aero → Mz → integration), and emits `tick`, `lapStarted`, `lapFinished`, `wheelEvent`, and `chassisEvent` through a small event emitter.
- [x] 2.5 Add `packages/ui/src/lib/racing/engine/three-renderer.ts` that constructs the Three.js scene (sun, hemi, fill lights, shadows), camera rig, debug-line group, and per-frame draws of the chassis hull + per-wheel meshes with suspension visual sag. Accept a `getAsset(name)` callback and use it for props.
- [x] 2.6 Add `packages/ui/src/lib/racing/engine/cameras.ts` with the four camera modes (`chase`, `hood`, `far`, `map`), horizon decoupling, and per-mode smoothing constants migrated from the prototype.
- [x] 2.7 Add `packages/ui/src/lib/racing/engine/input.ts` with keyboard input handling, smoothed steering (rate 2.5/s, self-center 3.5/s), throttle / brake / handbrake, gear shift hotkeys (`[` and `]`), and reset (`R`). Document the bindings in JSDoc on the public type.
- [x] 2.8 Add `packages/ui/src/lib/racing/engine/tracks/{catmull-rom,ribbon-geometry,surface-lookup,scenery-placement}.ts` with the prototype's track building logic, including surface zones, curb / rubber / marbles strips, and damp zones.
- [x] 2.9 Add `packages/ui/src/lib/racing/engine/audio-bus.ts` with a `NullAudioBus` and an `AudioBus` interface placeholder (matches the RTS pattern). No actual audio synthesis on day one.
- [x] 2.10 Add unit tests covering: camber-thrust mirror cancellation at zero roll; ARB transfer with both wheels grounded vs one airborne; anti-dive sign under braking and anti-squat sign under throttle; brake fade at 220°C and 500°C disc temperature; yaw-aero moment opposes sideslip; `Mz` decays past peak slip angle; slipping-clutch torque clamps to capacity; differential variants (welded sets equal omegas, open splits torque, clutchLSD couples by lock %).

### 3. Phase 3 — Runtime HUD package and Svelte components

- [x] 3.1 Add `packages/ui/src/lib/racing/runtime/RacingHud.svelte.ts` (HUD model) that snapshots the engine's per-frame state into Svelte 5 `$state` accessors (no destructuring; expose getter properties).
- [x] 3.2 Add `RacingHud.svelte` and the per-section components from the design doc (`SpeedCard`, `RpmCard`, `GearCard`, `LapCard`, `InputCard`, `WheelCard`, `DriftPanel`). Mirror the prototype's HTML/CSS structure and copy the CSS into the components.
- [x] 3.3 Add `DebugTrace.svelte` and `GgPlot.svelte` for the optional widgets. Wire them to the same HUD model with their own toggle flags.
- [x] 3.4 Update `packages/ui/src/lib/racing/runtime/index.ts` to export the HUD model and root component, and `packages/ui/src/lib/racing/index.ts` to expose them under the `Racing` namespace.
- [x] 3.5 Add a Storybook entry (or visual smoke story under `packages/ui`) for `RacingHud.svelte` driven by a stub engine snapshot, so the HUD is reviewable without the full route.

### 4. Phase 4 — Desktop app route and transport adapter

- [x] 4.1 Add `apps/desktop-app/src/lib/adapters/racing/RacingTransport.ts` that re-exports the domain interface and a `create-racing-transport.ts` that selects between `web-racing-transport.ts` (fetch) and `desktop-racing-transport.ts` (Electrobun RPC) at runtime.
- [x] 4.2 Add `apps/desktop-app/src/routes/api/racing/+server.ts` plus per-resource subroutes (`sessions`, `laps/[trackId]/[vehicleId]`, `setup/[userId]`). Wire them to Surreal-backed repositories under `packages/domain/src/infrastructure/racing/surreal/`. Apply the empty-table-returns-200 pattern used by chat / RTS.
- [x] 4.3 Add `packages/domain/src/infrastructure/racing/surreal/SurrealRacingRepository.ts` and tests following `SurrealTodoRepository.test.ts`. Use `createDbConnection({ host: 'mem://' })` per workspace rules. No hand-rolled in-memory fakes.
- [x] 4.4 Add `apps/desktop-app/src/routes/experiments/racing/racing-page.composition.ts` that wires `createRacingTransport()`, the audio bus, and `RacingEngine` into `createRacingPageModel()`, mirroring `rts-page.composition.ts`.
- [x] 4.5 Add `apps/desktop-app/src/routes/experiments/racing/racing-page.svelte.ts` exposing `bootstrap()`, `dispose()`, `setMuted(boolean)`, `setCameraMode(mode)`, `resetCar()`, `setVehicle(presetId)`, `setTrack(presetId)`, and a `hud` accessor that returns the `RacingHud` model.
- [x] 4.6 Add `apps/desktop-app/src/routes/experiments/racing/+page.svelte` with a single `<canvas>` host, the `<RacingHud>` overlay, and the keyboard bindings (`R`, `M`, `C`, `[`, `]`, `~`). Read `?track`, `?vehicle`, `?cam` from the page URL and pass to the page model.
- [x] 4.7 Copy the prototype's GLTF assets from `.design_sketch/assets/racing/extracted/` to `apps/desktop-app/static/racing/extracted/`, alongside any source `License.txt` / attribution. Update the renderer to load from `/racing/extracted/<name>.glb`.
- [x] 4.8 Add a one-line attribution credit in the racing route's footer (or a small "About" panel reachable from the HUD).
- [x] 4.9 Wire setup persistence: on bootstrap, read `localStorage` (`aml_racing_setup`), then call `RacingTransport.getSetup` and override the cache when the server returns a non-null value. On every setup edit, write to `localStorage` first and fire-and-forget through `RacingTransport.setSetup`.
- [x] 4.10 Wire lap persistence: when the engine emits `lapFinished`, the page model calls `RacingTransport.recordLap`. On bootstrap, call `RacingTransport.getBestLap` and seed the HUD's best-lap value.

### 5. Phase 5 — Verification

- [x] 5.1 Run `bun test` for `packages/ui/src/lib/racing/**` and `packages/domain/src/{shared,application,infrastructure}/racing/**` and confirm every test passes. Resolve any migrated-test regressions before continuing.
- [x] 5.2 Add an e2e at `apps/desktop-app/e2e/racing/racing.e2e.ts` that:
  - Mounts `/experiments/racing` and asserts the canvas + HUD render without 404s.
  - Asserts the HUD shows speed, gear, RPM, lap, and four wheel cards.
  - Presses `R` and asserts the chassis resets (HUD speed returns to 0 within one second).
  - Presses `M` and asserts the muted indicator toggles in the HUD.
  - Drives the chassis across the start/finish line (programmatically advance the engine via a test hook or simulate key inputs) and asserts a `recordLap` call fires through a mocked transport.
  - Presses `C` and asserts the camera mode toggle does not throw.
- [x] 5.3 Add a Playwright helper at `apps/desktop-app/e2e/helpers.ts` (or extend the existing one) with `patchEmptyRacingTableErrors(page)` so GET `/api/racing/**` returns `[]` on a fresh `mem://`.
- [x] 5.4 Add a script entry `bun run test:e2e:racing` in `apps/desktop-app/package.json` (mirror `test:e2e:rts`). Document it in `apps/desktop-app/AGENTS.md`'s verification section.
- [x] 5.5 Run `bun run check` from the workspace root, `bun run test:e2e` from `apps/desktop-app`, and `bun run build:ui` to confirm the build is clean. Resolve all type errors and lints before archiving.
- [x] 5.6 Manual smoke recipe (record outcomes in the PR description):
  1. `bun --cwd apps/desktop-app run dev` and open `http://localhost:5173/experiments/racing`.
  2. Confirm the HUD renders, the canvas mounts, and the sun lights the scene without console errors.
  3. Drive the car forward, accelerate to 100 km/h, brake hard, and confirm the per-wheel HUD shows non-zero `Fz`, `slip`, tire temp rising, brake temp rising; chassis dives and squats visibly.
  4. Force a slide with the handbrake; confirm the drift panel reports sideslip and yaw rate, and the HUD doesn't show a lateral pull at zero steering input (regression check on the camber-thrust fix).
  5. Switch to `?vehicle=fwd-front` and confirm the FWD car has different launch behaviour (front wheels spin first under throttle).
  6. Switch to `?vehicle=awd-rear-biased` and confirm the clutch-LSD diff produces noticeable rear coupling without welding both rear wheels.
  7. Switch through cameras with `C` and confirm `chase`, `hood`, `far`, and `map` all render correctly.
  8. Press `R` and confirm the car resets to spawn.
  9. Press `M` and confirm the HUD muted indicator toggles (no audio plays today; the indicator is the contract).
  10. Cross the start/finish line and confirm the lap timer rolls over, the new lap appears as `lastLap`, and the network tab shows a POST to `/api/racing/laps`.
  11. Reload the page and confirm the persisted best-lap returns from the API and shows in the HUD.
  12. Edit a setup tunable through the dev-tools console (`window.__racing.setSetup({ frontToeDeg: 0.5 })`), reload, and confirm the value persists from `localStorage`.

### 6. Phase 6 — Cleanup and follow-ups

- [x] 6.1 Add a one-paragraph `packages/ui/src/lib/racing/README.md` describing the engine layout, public namespace, and how to add a new vehicle or track preset.
- [x] 6.2 Add a one-paragraph `packages/domain/src/shared/racing/README.md` and `packages/domain/src/application/racing/README.md` per the workspace rule.
- [x] 6.3 Update root `README.md` and `AGENTS.md` if needed (likely not, since the existing rules already cover the new package directories).
- [x] 6.4 Open follow-up tickets for: in-route setup screen UI (sliders, validation, reset), audio synthesis (engine/tire/impacts/wind), AI opponents, controller / wheel input mapping, replays, more tracks and vehicles, and bundle-size investigation (lazy-load `three` / `jolt-physics`).
- [x] 6.5 Once Phase 5 passes and the route is live, remove the `.design_sketch/racing-sim-working-prototype.html`, `.design_sketch/racing-sim-physics.js`, `.design_sketch/racing-sim-physics.test.js`, and `.design_sketch/track-geometry.test.js` files (or move them to an `archive/` subfolder), and update any references in docs.
