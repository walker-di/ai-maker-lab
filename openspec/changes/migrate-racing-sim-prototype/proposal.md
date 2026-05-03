## Why

The design sketch at `.design_sketch/racing-sim-working-prototype.html` (~3,650 lines plus `.design_sketch/racing-sim-physics.js` helpers and matching unit tests) proves out a credible racing-sim slice: Three.js + Jolt rigid-body chassis, a custom Pacejka-based tire model with load sensitivity, anti-roll bars, camber thrust, anti-dive/anti-squat geometry, a slipping-clutch drivetrain with selectable differential (welded / open / clutch-LSD), tire and brake thermal models with fade, yaw-aware aero, three vehicle presets (RWD / FWD / AWD), three track presets with surface zones (asphalt / rubber / marbles / damp / curb / grass / gravel), a setup screen with persistence, an extensive telemetry HUD (speed, gear, RPM, lap, per-wheel cards, drift panel, G-G plot, debug trace), driver aids (ABS / TC / ESC), and a chase / hood / far / map camera rig. The prototype is currently the only place this work lives — `apps/desktop-app/` has no racing route at all.

This change lifts the proven prototype into the production app at `apps/desktop-app/src/routes/experiments/racing/` so the racing experiment can stand alongside `chat`, `platformer`, `rts`, `storyboard`, and `todo` as a demoable slice. The migration cannot just be a single-file copy: the production app uses workspace packages, clean architecture, app-local transport adapters, and domain types that intentionally have no Three.js / Jolt / HTTP imports. The work is to re-express the prototype's value through those existing boundaries while preserving the physics model bit-for-bit.

## What Changes

- Add `apps/desktop-app/src/routes/experiments/racing/` with `+page.svelte`, `racing-page.svelte.ts` (page model), and `racing-page.composition.ts` (composition root with adapters), mirroring the `rts` and `platformer` route shape.
- Add a workspace-shared engine in `packages/ui/src/lib/racing/engine/`: a fixed-step Jolt vehicle simulation (`RacingEngine.ts`), a Three.js renderer (`three-renderer.ts`), tire/aero/drivetrain math (`physics/`), the existing helpers from `.design_sketch/racing-sim-physics.js` promoted into the package, and a deterministic input layer.
- Add a runtime layer at `packages/ui/src/lib/racing/runtime/` for the HUD model and Svelte HUD components (speed/RPM/gear card, per-wheel cards with tire/brake temp meters, drift panel, lap timer, throttle/brake/steer pedals, optional G-G chart and debug trace), modelled after `RtsHud.svelte.ts`.
- Add domain shared types and validators in `packages/domain/src/shared/racing/`: `vehicle-types.ts` (vehicle preset, drivetrain, suspension, ARB, diff config, wheel layout, camber/anti-dive geometry), `track-types.ts` (centerline control points, surface zones, scenery hints), `surface-types.ts` (mu/roll/colour palette), `setup-types.ts` (toe / caster / Ackermann / motion ratio / bump-stops), and `match-types.ts` (session/lap/sector model). Export from a `racing/` barrel and re-export from `domain/shared`.
- Add domain application use cases in `packages/domain/src/application/racing/`: `start-session` (load track + vehicle presets, apply persisted setup) and `record-session-result` (persist best lap, sector splits, optional telemetry summary). Define a `RacingTransport` port matching the existing `RtsTransport` / `PlatformerTransport` style.
- Add domain infrastructure for built-in catalogs in `packages/domain/src/infrastructure/racing/builtins/`: ship the prototype's three track presets (`classic-twist`, `lakeside-gp`, `corkscrew-ridge`) and three vehicle presets (`rwd-front-mid`, `fwd-front`, `awd-rear-biased`) as authored JSON.
- Add an app-local transport adapter at `apps/desktop-app/src/lib/adapters/racing/` (web + desktop variants behind a `create-racing-transport.ts` factory) and an HTTP CRUD route at `apps/desktop-app/src/routes/api/racing/` for sessions and best laps. Persist to SurrealDB with a real `mem://`-backed test setup.
- Side-load the prototype's GLTF assets from `.design_sketch/assets/racing/extracted/` to `apps/desktop-app/static/racing/` so the renderer can load real props. Keep a `vector-only` fallback path for when assets fail to load.
- Persist the setup screen's tunables (toe, caster, Ackermann, motion ratio, bump-stops) through both `localStorage` (current behaviour) and the new `RacingTransport` so setup follows the user across sessions; keep `localStorage` as the offline-first source of truth.
- Add automated coverage: domain unit tests for vehicle/track/setup validators, engine unit tests for the existing physics helpers (Pacejka, Ackermann, bump-stop, motion ratio, caster camber, tire load) plus new tests for camber thrust, ARB transfer, anti-dive, Mz, yaw aero, and brake fade, plus a Playwright e2e covering session start, lap recording, and the renderer/HUD smoke path.
- Promote the in-prototype tuning fixes already merged (camber-thrust `lateralSign`, ~250 hp/ton engine curve, 2.5 rad/s steering rate, ARB contact gating, smoothed off-throttle pumping drag) into the migrated engine so the production slice ships with the corrected physics from day one.

## Capabilities

### New Capabilities

- `racing-sim`: end-to-end single-player racing experiment for `experiments/racing` covering vehicle simulation (chassis dynamics, suspension, tires, drivetrain, aero, brakes, driver aids), presentation (Three.js renderer with track/props/cameras), telemetry (HUD with speed/RPM/gear/laps/per-wheel/drift/G-G), authoring data (built-in vehicle and track presets, setup tunables), persistence (sessions, best laps, setup), and verification (domain/engine/e2e coverage).

### Modified Capabilities

<!-- None; no prior `racing-*` spec exists in `openspec/specs/`. -->

## Impact

- `apps/desktop-app/src/routes/experiments/racing/`: new route with page model, composition root, key bindings, and HUD slot wiring. Defaults track to `classic-twist` and vehicle preset to `rwd-front-mid`, both overridable via querystring (`?track=lakeside-gp&vehicle=fwd-front&cam=hood`).
- `apps/desktop-app/src/routes/api/racing/`: new CRUD endpoints for sessions, lap results, and per-user setup blobs. Returns `[]` for empty tables on fresh `mem://` (matches the chat/RTS pattern).
- `apps/desktop-app/src/lib/adapters/racing/`: new transport adapters (`RacingTransport.ts` interface, `web-racing-transport.ts`, `desktop-racing-transport.ts`, `create-racing-transport.ts`).
- `apps/desktop-app/static/racing/`: GLTF props copied from `.design_sketch/assets/racing/extracted/` (cone, barrier, light, billboard, etc.) plus a `License.txt` that credits the asset source.
- `packages/ui/src/lib/racing/engine/`: new engine package with `RacingEngine.ts`, `three-renderer.ts`, `jolt-physics.ts` (Jolt initialisation + ground + chassis), `physics/` (Pacejka, ARB, camber, anti-dive, drivetrain, aero, thermal models), `tracks/` (Catmull-Rom builder, ribbon mesh, surface lookup), `cameras.ts`, `input.ts`, `index.ts` barrel.
- `packages/ui/src/lib/racing/runtime/`: HUD model (`RacingHud.svelte.ts`) and Svelte components for the speed/RPM/gear card, lap card, input card, per-wheel cards, drift panel, and optional debug widgets.
- `packages/ui/src/lib/index.ts`: export the new `Racing` namespace alongside `Rts` and `Platformer`.
- `packages/domain/src/shared/racing/`: new types (`vehicle-types.ts`, `track-types.ts`, `surface-types.ts`, `setup-types.ts`, `match-types.ts`), validators (`validation.ts`), and barrel `index.ts`. Includes a `README.md` per workspace rule.
- `packages/domain/src/application/racing/`: `RacingTransport` port, `start-session`, `record-session-result` use cases, plus `index.ts`. Includes a `README.md`.
- `packages/domain/src/infrastructure/racing/builtins/`: `classic-twist.json`, `lakeside-gp.json`, `corkscrew-ridge.json` (tracks) and `rwd-front-mid.json`, `fwd-front.json`, `awd-rear-biased.json` (vehicles), plus a Surreal-backed best-lap repository implementation.
- `packages/domain/src/infrastructure/racing/surreal/`: a real SurrealDB best-lap repository following the `SurrealTodoRepository` pattern, used by both the API route and any persistent client transport.
- `packages/ui/src/lib/racing/engine/*.test.ts` and `packages/domain/src/{shared,application,infrastructure}/racing/**/*.test.ts`: new and migrated unit tests. The existing `.design_sketch/racing-sim-physics.test.js` and `.design_sketch/track-geometry.test.js` move into the package and gain coverage for the Tier 1/2 additions.
- `apps/desktop-app/e2e/racing/`: new Playwright spec exercising session start, a single timed flying lap with mocked transports, and the `M`/`R` HUD bindings (mute hint + reset car).
- Dependencies: `jolt-physics` and `three` (already used by the prototype) become first-party workspace dependencies. Both are pulled into `packages/ui` since the engine lives there. No other new packages are required.
- `.design_sketch/racing-sim-working-prototype.html` and the supporting helper / asset files stay in place during the migration so they remain referenceable; a follow-up archive task can delete or move them once the new route is at parity.
- Out of scope: multiplayer / hot-seat, AI opponents, replays, controller / wheel input mapping beyond keyboard, mobile / touch input, in-app track or vehicle authoring UI, championship modes, audio (engine / tire / impact synthesis stays a follow-up), marketing-flow integration.
