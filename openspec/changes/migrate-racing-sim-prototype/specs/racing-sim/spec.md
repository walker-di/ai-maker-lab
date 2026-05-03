## ADDED Requirements

### Requirement: Racing experiment mounts under `experiments/racing` with thin composition

The desktop app SHALL expose a racing experiment at `/experiments/racing` whose route file delegates to a page model and a composition root, matching the `experiments/rts` and `experiments/platformer` shape.

#### Scenario: Route file is a thin shell

- **WHEN** the developer opens `apps/desktop-app/src/routes/experiments/racing/+page.svelte`
- **THEN** it imports `createRacingPage` from `./racing-page.composition.ts` and binds keyboard events but contains no transport calls and no engine instantiation
- **AND** `apps/desktop-app/src/routes/experiments/racing/racing-page.svelte.ts` exposes the page model with `bootstrap()`, `dispose()`, `setMuted(boolean)`, `setCameraMode(mode)`, and `resetCar()` methods

#### Scenario: Composition wires transport and engine

- **WHEN** `createRacingPage()` runs
- **THEN** it instantiates `createRacingTransport()` from the app-local adapter, constructs the `RacingEngine` from `ui/source` (or `Racing.Engine`), and hands them both to `createRacingPageModel`
- **AND** it does not import `pixi.js`, `three`, or `jolt-physics` directly — those imports live inside the engine package

#### Scenario: Querystring overrides initial selection

- **WHEN** the user opens `/experiments/racing?track=lakeside-gp&vehicle=fwd-front&cam=hood`
- **THEN** the session loads `lakeside-gp`, the `fwd-front` vehicle preset, and the hood camera mode
- **AND** invalid values fall back to `classic-twist`, `rwd-front-mid`, and `chase` respectively without throwing

#### Scenario: Key bindings on the canvas

- **WHEN** focus is on the racing canvas (not on a text input)
- **THEN** `R` resets the car, `M` toggles mute, `C` cycles camera modes, `[` and `]` shift gears, and `~` toggles the debug trace
- **AND** none of the bindings fire while a text input has focus

### Requirement: Vehicle simulation runs at a fixed 240 Hz with realistic chassis dynamics

The racing engine SHALL run a fixed-timestep Jolt physics loop at 240 Hz with explicit chassis mass and inertia, decoupled from the renderer's frame rate.

#### Scenario: Fixed timestep with capped substeps

- **WHEN** the renderer ticks at any frame rate between 30 and 240 fps
- **THEN** the simulation advances in increments of `1/240 s` with at most 8 substeps per frame
- **AND** vehicle position interpolation between simulation steps remains visually smooth

#### Scenario: Chassis mass and inertia overrides

- **WHEN** the vehicle body is created
- **THEN** `mMass` is `1240 kg` and the inertia diagonal is approximately `(Ipitch=1500, Iyaw=1700, Iroll=450) kg·m²`
- **AND** `mAngularDamping` is no greater than `0.1` so chassis angular momentum is governed by tires + suspension, not artificial damping

#### Scenario: Ground collision present and stable

- **WHEN** the simulation starts
- **THEN** a static ground body covers the playable track surface and the chassis settles within 1 second of spawn
- **AND** raycasts from each wheel attach point hit the ground plane analytically without crossing other static geometry

### Requirement: Tire forces use load-sensitive Pacejka with combined slip and a thermal model

The tire model SHALL produce per-wheel longitudinal (`Fx`) and lateral (`Fy`) forces using a Pacejka-style Magic Formula with load-sensitive peak grip, a combined-slip lateral cut, a friction-circle clamp, and a thermal grip multiplier.

#### Scenario: Peak grip degrades with vertical load

- **WHEN** vertical load `Fz` doubles from a reference value
- **THEN** peak grip force grows by less than `2×` (`tireD(mu, fz)` follows `mu·fz·(1 − loadFalloff·(fz/fzRef − 1))`)
- **AND** the friction-circle clamp uses the same load-sensitive peak as Pacejka

#### Scenario: Lateral curve peaks between 5° and 9° slip angle

- **WHEN** slip angle is swept from 0° to 15° at constant load
- **THEN** `|Fy|` peaks at a slip angle in the range `(5°, 9°)`
- **AND** `Fy(0)` is `0` to numerical precision and `Fy(α)` is odd in `α`

#### Scenario: Longitudinal curve peaks between 7% and 22% slip ratio

- **WHEN** slip ratio is swept from 0 to 0.2 at constant load
- **THEN** `|Fx|` peaks at a slip ratio in the range `(0.07, 0.22)`
- **AND** `Fx(0)` is `0` to numerical precision and `Fx(s)` is odd in `s`

#### Scenario: Combined slip reduces lateral grip

- **WHEN** longitudinal slip ratio is high (e.g., wheelspin under throttle)
- **THEN** the lateral cut `Gyk = 1 / (1 + 4.5·|slipRatio|)` reduces `Fy` proportionally on every wheel
- **AND** the friction-circle clamp `|F| ≤ Fmax` is enforced after both `Fx` and `Fy` are computed

#### Scenario: Tire temperature modulates grip

- **WHEN** a tire absorbs sliding work `|Fx·slipVx| + |Fy·vy|`
- **THEN** its core temperature rises and its grip multiplier follows the cold/optimal/hot curve (penalty below ~50°C and above ~110°C, peak around 90°C)
- **AND** convective cooling rate scales with airflow speed

#### Scenario: Camber thrust mirrors correctly between left and right wheels

- **WHEN** static camber is `−2.5°` on both front wheels and roll is `0`
- **THEN** the camber-thrust contribution to `Fy` cancels between the two wheels and produces no net lateral pull on the chassis
- **AND** under positive body roll, the outside (more compressed) wheel gains more negative effective camber and contributes more inboard lateral force than the inside wheel

### Requirement: Suspension models springs, dampers, anti-roll bars, bump-stops, and anti-dive/squat geometry

The suspension SHALL use per-axle linear spring and asymmetric damper rates with a motion ratio, an anti-roll bar that gates on contact, a progressive bump-stop, and per-wheel anti-dive (front) / anti-squat (rear) percentages.

#### Scenario: Per-axle spring and damper rates

- **WHEN** the chassis dives under braking
- **THEN** front springs compress according to `kFront` and front dampers apply different bump and rebound rates (`cBumpFront` ≠ `cReboundFront`)
- **AND** the same is true on the rear axle with its own constants (`kRear`, `cBumpRear`, `cReboundRear`)

#### Scenario: Motion ratio scales rates quadratically

- **WHEN** the motion ratio is `0.7` instead of `1.0`
- **THEN** the effective wheel-rate spring and damper coefficients scale by `0.7² = 0.49`
- **AND** the prototype's `computeMotionRatio` helper returns the same value

#### Scenario: Anti-roll bar transfers load between axle wheels

- **WHEN** one wheel of an axle compresses more than the other
- **THEN** the more-compressed (outside) wheel receives additional vertical load and the less-compressed (inside) wheel loses an equal amount, scaled by `arbFront` or `arbRear` and the axle's motion-ratio squared

#### Scenario: Anti-roll bar gates on contact

- **WHEN** one wheel of an axle is airborne
- **THEN** that axle's ARB transfer is zero for the duration of the airborne state
- **AND** the on-ground wheel only sees its own spring + damper force, not a phantom transfer from the airborne sibling

#### Scenario: Bump-stop force is progressive past threshold

- **WHEN** suspension compression exceeds the bump-stop gap
- **THEN** an additional progressive force activates and grows monotonically with further compression
- **AND** the prototype's `computeBumpStopForce` helper produces the same values

#### Scenario: Anti-dive and anti-squat reduce pitch geometrically

- **WHEN** the front wheels brake (`Fx < 0`)
- **THEN** a fraction `antiDivePct` of `|Fx|` is added as a vertical force at the front contact, reducing chassis dive without altering the spring force
- **WHEN** the rear wheels accelerate (`Fx > 0`)
- **THEN** a fraction `antiSquatPct` of `Fx` is added as a vertical force at the rear contact, reducing chassis squat

### Requirement: Drivetrain combines an engine curve, slipping clutch, and selectable differential

The drivetrain SHALL drive the wheels through an engine torque curve, a gearbox, a slipping clutch model, and a selectable rear (or all-wheel) differential type.

#### Scenario: Engine torque curve interpolates linearly

- **WHEN** the engine RPM is sampled inside the curve range
- **THEN** the returned torque interpolates linearly between adjacent control points
- **AND** torque is clamped to `0` outside the curve's RPM domain

#### Scenario: Engine power is sized to ~250 hp/ton

- **WHEN** peak engine torque and the corresponding RPM are evaluated
- **THEN** peak power is in the range `220–245 kW` for a `1240 kg` chassis (i.e. ≤ 250 hp/ton)
- **AND** rear-tire longitudinal force never exceeds `tireD(mu, Fz_rear)` under steady acceleration on dry asphalt

#### Scenario: Gearbox includes reverse, neutral, and at least six forward ratios

- **WHEN** the player shifts up or down
- **THEN** the gear sequence cycles through `R`, `N`, and at least six forward ratios (`1`–`6`)
- **AND** `N` produces no drive torque regardless of throttle

#### Scenario: Slipping clutch transmits clamped torque

- **WHEN** the engine angular velocity differs from the wheel-side equivalent (`engineOmega ≠ wheelOmega · ratio`)
- **THEN** clutch torque is `clamp(stiffness · slip, ±capacity)` with capacity matching the prototype's `clutchMaxTorque`
- **AND** engine RPM cannot fall below idle (`ENGINE_IDLE`) or exceed redline (`ENGINE_REDLINE · 1.05`)

#### Scenario: Differential variety changes axle behaviour

- **WHEN** `diff.type` is `welded`
- **THEN** the two driven wheels of the axle share the same angular velocity each step
- **WHEN** `diff.type` is `open`
- **THEN** the two driven wheels split torque equally and may spin at different rates
- **WHEN** `diff.type` is `clutchLSD`
- **THEN** the two driven wheels couple proportionally to `powerLockPct` (drive) or `coastLockPct` (coast) with a `preloadNm` floor and a `capacityNm` ceiling

### Requirement: Brake system models bias, ABS, and thermal fade

The brake system SHALL apply per-wheel braking torque with adjustable front/rear bias, an ABS hold-and-release behaviour when locking is detected, and a thermal fade curve that reduces peak torque past a temperature threshold.

#### Scenario: Brake torque follows bias

- **WHEN** the player applies the brake pedal at full
- **THEN** front wheels receive `brakeBiasFront` of the maximum brake torque and rears receive `1 − brakeBiasFront`
- **AND** brake bias defaults to a front-biased value matching the prototype (~`0.565`)

#### Scenario: ABS releases on lock detection

- **WHEN** ABS is enabled and a wheel's slip ratio drops below `−absThreshold` while braking at speed
- **THEN** that wheel's brake torque is scaled by `absReleaseScale` for `absReleaseTime` seconds
- **AND** the HUD reflects ABS activity for that wheel

#### Scenario: Brake disc temperature drives fade

- **WHEN** sustained braking heats a disc above `BRAKE_FADE_T0` (~220°C)
- **THEN** maximum brake torque on that wheel falls linearly toward `0.5×` at `BRAKE_FADE_T1` (~500°C)
- **AND** convective cooling reduces the disc temperature when speed is high or the brake is released

### Requirement: Aero applies yaw-aware drag, downforce, and a self-aligning chassis moment

The aero model SHALL apply drag, downforce on the front and rear axles, and a yaw-restoring moment that responds to chassis sideslip; per-tire pneumatic-trail moments SHALL be summed and applied as a chassis yaw torque.

#### Scenario: Drag scales with `cdA` and speed squared

- **WHEN** the chassis moves through air at velocity `v`
- **THEN** drag force magnitude is `0.5 · ρ · cdEff · v²` opposing the velocity vector
- **AND** `cdEff = cdA · (1 + 1.2 · sin²β)` so drag rises with sideslip

#### Scenario: Downforce loads front and rear axles

- **WHEN** chassis longitudinal speed exceeds zero
- **THEN** front-axle downforce is `0.5 · ρ · clFrontA · v²` and rear-axle downforce is `0.5 · ρ · clRearA · v²`, both pointing along `−up`
- **AND** these forces are applied at the front and rear axle reference points respectively

#### Scenario: Yaw-restoring aero moment opposes sideslip

- **WHEN** sideslip angle `β` is non-zero and chassis speed exceeds the low-speed gate
- **THEN** a moment of magnitude `0.5 · ρ · Cy_yaw · Aref · Lref · sin(2β) · v²` is applied around the chassis vertical axis in the direction that reduces `|β|`

#### Scenario: Self-aligning moment from pneumatic trail

- **WHEN** a tire generates `Fy` from slip
- **THEN** that wheel contributes `Mz = −trail · Fy_slip` with `trail` decaying linearly from `~0.040 m` at zero slip to `0` at the peak slip angle
- **AND** the sum of per-wheel `Mz` is applied as a chassis yaw torque (camber-thrust contributions to `Fy` are excluded from `Mz`)

### Requirement: Driver aids combine ABS, traction control, and electronic stability control

The driver aids SHALL be individually toggleable and combine ABS (per-wheel brake release), TC (throttle cut on driven-wheel slip), and ESC (selective brake torque on yaw-error or sideslip).

#### Scenario: TC cuts throttle on driven-wheel slip

- **WHEN** TC is enabled and any driven wheel exceeds the configured slip-ratio threshold under throttle
- **THEN** effective throttle is multiplied by `(1 − tcCut)` until driven slip falls back below the threshold
- **AND** the HUD highlights TC activity

#### Scenario: ESC corrects oversteer with selective braking

- **WHEN** ESC is enabled, sideslip exceeds the oversteer threshold, and yaw rate exceeds the desired steering-derived rate by more than `escOversteerThreshold`
- **THEN** a brake pulse is applied to the outside front wheel proportional to the error, capped by `escMaxBrakeTorque`
- **AND** the HUD highlights ESC activity and which wheel is being braked

#### Scenario: ESC corrects understeer with selective braking

- **WHEN** ESC is enabled, the player commands a turn, and yaw rate is less than the desired rate by more than `escUndersteerThreshold`
- **THEN** a brake pulse is applied to the inside rear wheel proportional to the error, capped at `0.8 × escMaxBrakeTorque`

#### Scenario: Each aid is independently toggleable

- **WHEN** the player toggles ABS, TC, or ESC individually
- **THEN** only the corresponding intervention stops happening
- **AND** the HUD reflects the on/off state of each aid

### Requirement: Catalogs ship vehicles, tracks, and surfaces

The infrastructure layer SHALL ship at least three vehicle presets, three track presets, and a fixed surface palette as authored data files consumed by the engine and renderer through domain types.

#### Scenario: Three vehicle drivetrain layouts

- **WHEN** the player opens the vehicle picker
- **THEN** at least the `rwd-front-mid`, `fwd-front`, and `awd-rear-biased` presets are available
- **AND** each preset declares wheelbase, track, front-mass percentage, gear ratios, final drive, max steering angle, axle-drive shares, and differential type

#### Scenario: Three track presets with surface zones

- **WHEN** the player opens the track picker
- **THEN** at least `classic-twist`, `lakeside-gp`, and `corkscrew-ridge` are available
- **AND** each track ships Catmull-Rom centerline control points, half-width, curb width, sample count, surface zones (gravel + damp at minimum), and scenery cadence hints

#### Scenario: Surface palette supplies friction data

- **WHEN** a wheel queries the surface at a contact point
- **THEN** it receives one of the named surfaces (`RUBBER`, `ASPHALT`, `MARBLES`, `DAMP`, `CURB`, `GRASS`, `GRAVEL`) with its `mu`, `roll`, and visual `color`
- **AND** the tire force model uses `mu` for the friction circle and Pacejka peak

#### Scenario: Catalogs persist as authored JSON

- **WHEN** a developer adds or edits a preset
- **THEN** the data lives under `packages/domain/src/infrastructure/racing/builtins/`, validates against the domain types, and loads through `RacingTransport` without code changes elsewhere

### Requirement: Setup tunables persist locally and through the transport

The setup screen SHALL expose at least toe (front and rear), caster, Ackermann percentage, motion ratios (front and rear), bump-stop gap, and bump-stop rate; values SHALL persist across reloads via `localStorage` and synchronise through `RacingTransport`.

#### Scenario: Setup edits apply immediately

- **WHEN** the user adjusts a setup field while the car is parked
- **THEN** the corresponding physics parameter on the live car updates within the next simulation tick
- **AND** the HUD reflects the new geometry where applicable (e.g. visible toe on the wheel meshes)

#### Scenario: Setup persists across reloads

- **WHEN** the user reloads the route after editing a setup value
- **THEN** the edited value is reapplied automatically before the first simulation tick
- **AND** if `RacingTransport` returns a server-side setup, it overrides the `localStorage` cache and updates it

#### Scenario: Setup is clamped to safe ranges

- **WHEN** the user enters an out-of-range value (e.g. negative motion ratio, toe beyond `±5°`)
- **THEN** the value is clamped to a safe range before being applied
- **AND** the HUD shows the clamped value, not the raw input

### Requirement: Telemetry HUD surfaces vehicle state and inputs

The HUD SHALL render a top bar (speed, gear, RPM, lap timing), an input card (throttle, brake, steering, handbrake), per-wheel cards (load, slip, tire temp, brake temp, surface, airborne flag, bump-stop pct), a drift panel (sideslip, yaw rate, drift flag, rear lock), and an optional debug trace and G-G plot.

#### Scenario: Speed, RPM, and gear update every frame

- **WHEN** the simulation is running
- **THEN** the HUD speed value matches `|velocity|` to one km/h, the RPM bar matches the engine's current RPM relative to redline, and the gear card matches the current gear letter

#### Scenario: Per-wheel cards include tire and brake temperature meters

- **WHEN** a wheel is in contact with the ground
- **THEN** its card shows `Fz`, slip ratio, slip angle, surface label, tire core temperature, and brake disc temperature, each as a colour-graded bar
- **WHEN** the wheel is airborne
- **THEN** the card visually marks the wheel as airborne and zeroes the load/slip readings

#### Scenario: Drift panel reflects chassis-frame measurements

- **WHEN** sideslip exceeds the drift threshold in the prototype's logic
- **THEN** the drift panel surfaces sideslip degrees, yaw rate, a drift on/off flag, and (above ~5 km/h) a rear-lock percentage
- **AND** the panel does not display rear-lock for stationary or low-speed vehicles where the metric is meaningless

#### Scenario: Optional debug widgets toggleable

- **WHEN** the user toggles the debug trace or G-G plot
- **THEN** the corresponding widget appears or disappears immediately
- **AND** their state is independent of the rest of the HUD

### Requirement: Camera rig and lap timing

The renderer SHALL provide chase, hood, far, and map cameras that follow the chassis with horizon-decoupled smoothing, and the engine SHALL detect lap completion through the start/finish line and report the running time, last lap, and best lap.

#### Scenario: Camera follows yaw but stays world-vertical

- **WHEN** the chassis rolls or pitches under suspension load
- **THEN** the camera tracks the chassis yaw and position but its up vector remains aligned with the world up
- **AND** the chase camera trails behind the chassis with smoothing and no jitter

#### Scenario: Camera mode cycles through four modes

- **WHEN** the player presses `C` (or the route mounts with `?cam=hood|far|map`)
- **THEN** the camera transitions between `chase`, `hood`, `far`, and `map`
- **AND** the HUD reflects the active mode

#### Scenario: Lap timing detects start/finish crossing

- **WHEN** the chassis crosses the start/finish line in the legal direction
- **THEN** the running lap time finalises, becomes `lastLap`, and a new lap starts at zero
- **AND** if it improves on the running session best, `bestLap` updates and is persisted through `RacingTransport`

#### Scenario: Reset returns the car to the spawn point

- **WHEN** the player presses `R`
- **THEN** the chassis position, orientation, velocities, wheel angular velocities, engine RPM, and tire/brake temperatures reset to spawn defaults
- **AND** the running lap timer resets without affecting `bestLap`

### Requirement: Renderer side-loads assets with a vector fallback

The renderer SHALL load track props (cones, barriers, lights, billboards, etc.) from `apps/desktop-app/static/racing/` via GLTF and SHALL keep rendering with vector / primitive fallbacks until assets resolve or if any asset fails permanently.

#### Scenario: Assets load from `/racing/`

- **WHEN** the racing route mounts
- **THEN** the renderer requests its GLTF assets from `/racing/extracted/<name>.glb`
- **AND** the route renders within one second whether or not those assets have resolved yet

#### Scenario: Asset failure does not crash the match

- **WHEN** any asset fails to load
- **THEN** the engine logs the failure once, swaps in a primitive (Three.js box / cylinder) for the missing prop, and continues rendering
- **AND** does not retry the missing asset on every frame

#### Scenario: License attribution ships with the build

- **WHEN** the desktop app builds
- **THEN** `apps/desktop-app/static/racing/License.txt` is present and credits the asset source
- **AND** the racing route's footer surfaces a one-line credit

### Requirement: Sessions and best laps persist through `RacingTransport`

The racing experiment SHALL persist sessions, lap results, and per-user setup blobs through a `RacingTransport` interface implemented by both web (HTTP) and desktop (RPC) adapters, with a SurrealDB-backed server implementation.

#### Scenario: Transport defines stable methods

- **WHEN** a developer reads `RacingTransport`
- **THEN** it exposes at least `startSession(input)`, `recordLap(lap)`, `getBestLap(trackId, vehicleId)`, `getSetup(userId)`, and `setSetup(userId, setup)`
- **AND** all return types are domain-shape interfaces with no Three.js or Jolt references

#### Scenario: Desktop and web adapters share the contract

- **WHEN** the route mounts in `dev:web` or `dev:app`
- **THEN** `createRacingTransport()` returns the appropriate adapter (`web-racing-transport` over `fetch`, `desktop-racing-transport` over Electrobun RPC)
- **AND** both adapters share the same `RacingTransport` interface

#### Scenario: Server uses SurrealDB with `mem://` for tests

- **WHEN** the API route runs in tests
- **THEN** it connects to a SurrealDB `mem://` instance with a per-test unique namespace/database
- **AND** the server uses real Surreal repositories, not hand-rolled in-memory fakes, per the workspace testing rules

#### Scenario: Empty tables return safe defaults

- **WHEN** the table for sessions or best laps does not yet exist on a fresh `mem://`
- **THEN** the GET endpoints return `200` with an empty array and the page renders without warnings
- **AND** Playwright e2e tests can call the endpoints directly without first seeding data

### Requirement: Clean architecture boundaries are preserved

The racing change SHALL preserve the workspace's clean architecture: domain code stays free of Three.js / Jolt / HTTP imports, UI engine code stays free of SurrealDB / domain-application / HTTP imports, and the route stays a thin composition layer.

#### Scenario: Domain remains UI-free

- **WHEN** new domain types and use cases are added in `packages/domain/src/{shared,application,infrastructure}/racing/`
- **THEN** they SHALL NOT import `three`, `jolt-physics`, browser globals, or HTTP transports
- **AND** an automated import-boundary test asserts that `packages/domain` does not bundle `three` or `jolt-physics`

#### Scenario: Engine remains domain-persistence-free

- **WHEN** new engine modules are added in `packages/ui/src/lib/racing/engine/`
- **THEN** they SHALL NOT import `surrealdb`, `domain/infrastructure`, or `domain/application`
- **AND** they communicate with the domain only through the engine's constructor inputs (preset bundles, transport, audio bus) and event emitters

#### Scenario: Route stays thin

- **WHEN** new HUD or overlay logic is added
- **THEN** `+page.svelte` continues to delegate to `racing-page.svelte.ts` and `racing-page.composition.ts`
- **AND** `+page.svelte` performs no business logic, no transport calls, and no engine instantiation directly

#### Scenario: Browser-safe domain barrel

- **WHEN** the app imports racing types
- **THEN** it imports from `domain/shared` (browser-safe), not from the package root
- **AND** server / API code imports use cases from `domain/application` and Surreal repositories from `domain/infrastructure`

### Requirement: Automated coverage spans domain, engine, and end-to-end

The racing change SHALL include domain unit tests, engine unit tests, and a Playwright e2e covering the new route.

#### Scenario: Domain unit tests cover validators and catalogs

- **WHEN** the domain test suite runs
- **THEN** it asserts vehicle/track/setup validators, surface palette completeness, and the three built-in vehicle and track catalogs round-trip through the domain types
- **AND** uses real SurrealDB `mem://` connections for any repository-backed tests, per the workspace testing rules

#### Scenario: Engine unit tests cover the physics math

- **WHEN** the UI engine test suite runs
- **THEN** it covers `tireD` load sensitivity, Pacejka lateral / longitudinal peaks, combined-slip, camber-thrust mirror cancellation, ARB transfer with both wheels grounded vs one airborne, anti-dive / anti-squat sign, slipping-clutch torque limits, differential variants (welded / open / clutchLSD), brake fade past `BRAKE_FADE_T0`, yaw-aero moment direction, and `Mz` decay past peak slip
- **AND** the existing helpers from `.design_sketch/racing-sim-physics.test.js` and `.design_sketch/track-geometry.test.js` are migrated and still pass

#### Scenario: E2E covers the slice end-to-end

- **WHEN** the racing Playwright e2e runs
- **THEN** it asserts that `/experiments/racing` mounts without 404s, that the HUD shows speed/RPM/gear and the four wheel cards, that pressing `R` resets the car, that pressing `M` toggles the muted indicator, that crossing the start/finish line records a lap result through the mocked transport, and that switching cameras with `C` does not throw
- **AND** mocks the audio and network boundaries instead of calling live providers
