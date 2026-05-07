## ADDED Requirements

### Requirement: Hub bodies and chassis compliance constraints exist in the physics world

The engine SHALL create four wheel-hub bodies separate from the chassis body and connect each hub to the chassis via compliant constraints that simulate suspension bushing and chassis torsional flexibility.

#### Scenario: Hub bodies are created per corner
- **WHEN** `RacingEngine` initializes the vehicle
- **THEN** four `JPH::Body` instances exist with mass ~15–25 kg each positioned at the static suspension pickup points (front-left, front-right, rear-left, rear-right)
- **AND** each hub body has collision disabled (`CollisionGroup::SetGroupFilter` or equivalent) so hubs do not collide with track geometry or each other
- **AND** each hub body's motion type is `Dynamic` so forces integrate normally

#### Scenario: Chassis-to-hub compliance constraints are configured
- **WHEN** the vehicle preset supplies compliance parameters
- **THEN** each hub is connected to the chassis via a `SixDOFConstraint` with spring settings on translational axes (X, Y, Z) and optionally rotational axes (twist, swing)
- **AND** the constraint's translational spring frequency is in the range **5–20 Hz** with damping ratio **0.6–1.0**
- **AND** when compliance parameters are omitted or zero, the hub is rigidly fixed to the chassis (legacy behavior preserved)

#### Scenario: Torsional chassis stiffness resists roll and yaw flex
- **WHEN** lateral load is applied to the chassis (e.g., cornering)
- **THEN** a restoring torque proportional to chassis roll angle and torsional stiffness parameter resists the twist
- **AND** the torsional stiffness default for a GT3-class preset is in the range **15,000–30,000 N·m/deg**
- **AND** the restoring torque is applied as an additional constraint or spring force on the chassis body

### Requirement: Suspension forces apply between hub and ground, not chassis and ground

The engine SHALL refactor the per-wheel spring/damper/ARB/anti-dive force application so vertical and longitudinal forces act on the hub body, and the compliance constraint transmits those forces (with delay and hysteresis) to the chassis.

#### Scenario: Spring and damper forces target the hub
- **WHEN** the suspension pipeline computes spring and damper forces for a wheel
- **THEN** those forces are applied at the hub body's position (not the chassis body position)
- **AND** the force direction accounts for the hub's current orientation (which may differ from chassis orientation due to compliance)

#### Scenario: Anti-roll bar load transfer targets the hubs
- **WHEN** ARB pre-pass computes load transfer between left and right wheels on an axle
- **THEN** the additional vertical force is applied at each hub body
- **AND** the ARB force does not bypass the compliance constraint

#### Scenario: Anti-dive and anti-squat forces target the hubs
- **WHEN** longitudinal forces trigger anti-dive (braking) or anti-squat (acceleration)
- **THEN** the additional vertical forces are applied at the front/rear hub bodies respectively
- **AND** the forces integrate through the compliance constraint to the chassis

#### Scenario: Tire forces apply at the hub
- **WHEN** Pacejka-computed Fx, Fy, Fz forces are resolved for a wheel
- **THEN** those forces are applied at the hub body's contact-patch position
- **AND** the resulting hub motion (vertical bounce, lateral deflection) feeds back into the next step's slip calculation

### Requirement: Vehicle preset schema includes compliance parameters

The domain SHALL expose compliance configuration fields so vehicle authors can tune bushing stiffness and chassis torsional stiffness per car class.

#### Scenario: Preset schema has compliance fields
- **WHEN** a developer reads the `VehiclePreset` type
- **THEN** it includes optional `compliance` fields:
  - `hubLinearStiffnessNpm` (default 0 = rigid)
  - `hubLinearDampingNspms` (default 0)
  - `hubRotationalStiffnessNmDeg` (default 0)
  - `hubRotationalDampingNmSdeg` (default 0)
  - `chassisTorsionalStiffnessNmDeg` (default `Infinity` = rigid)
- **AND** the existing three built-in presets (`rwd-front-mid`, `fwd-front`, `awd-rear-biased`) remain unchanged (zero compliance = rigid)
- **AND** a new `gt3-rigid-tub` preset demonstrates nonzero compliance values

#### Scenario: Validation covers compliance ranges
- **WHEN** `clampSetup` or preset validation runs
- **THEN** compliance stiffness values are clamped to safe ranges:
  - `hubLinearStiffnessNpm`: 0 to 500,000
  - `hubRotationalStiffnessNmDeg`: 0 to 10,000
  - `chassisTorsionalStiffnessNmDeg`: 0 to 100,000
- **AND** negative values are rejected or clamped to zero

### Requirement: Effective wheel rate accounts for bushing compliance in series

The engine SHALL compute the effective wheel rate seen at the tire contact patch as the series combination of tire carcass stiffness, bushing stiffness, and spring stiffness.

#### Scenario: Effective stiffness is serial
- **WHEN** bushing compliance is nonzero
- **THEN** the effective vertical stiffness at the contact patch is:
  `1/k_eff = 1/k_carcass + 1/k_bushing + 1/k_spring`
- **AND** the static ride height and sag calculations use `k_eff` instead of `k_spring` alone

#### Scenario: Compliance does not break existing wheel rate tests
- **WHEN** compliance is zero (default)
- **THEN** effective wheel rate equals spring rate (no regression)
- **AND** all existing suspension unit tests pass without modification

### Requirement: Telemetry reflects hub motion for HUD and debug

The HUD and debug widgets SHALL display hub-relative motion so compliance effects are visible to the driver.

#### Scenario: Wheel cards show hub deflection
- **WHEN** a hub deflects laterally or vertically from compliance
- **THEN** the corresponding wheel card shows a "bushing deflection" indicator (small offset from nominal position)
- **AND** the indicator is hidden when compliance is zero

#### Scenario: Debug trace shows compliance oscillation
- **WHEN** the debug trace (`~` toggle) is active
- **THEN** an optional channel plots hub vertical velocity or lateral deflection over time
- **AND** the channel is labeled with the bushing natural frequency eigenvalue

### Requirement: Clean architecture boundaries are preserved

The compliance implementation SHALL keep domain code free of Jolt Physics types, engine code free of Surreal/HTTP imports, and the route as a thin composition layer.

#### Scenario: Domain types define compliance schema
- **WHEN** a developer reads `packages/domain/src/shared/racing/vehicle-types.ts`
- **THEN** compliance fields are plain numbers (N/m, N·s/m) with no `JPH::` or `three` references
- **AND** Jolt constraint construction lives only in `packages/ui/src/lib/racing/engine/`

#### Scenario: Engine tests cover compliance in isolation
- **WHEN** `bun test` runs for `packages/ui/src/lib/racing/engine/physics/`
- **THEN** new unit tests assert:
  - Effective series stiffness calculation with and without compliance
  - Hub natural frequency is within 5–20 Hz for typical bushing parameters
  - Torsional restoring torque sign opposes roll angle
- **AND** no test imports `jolt-physics` directly (Jolt integration tests may import it in `engine/` tests)

### Requirement: Integration tests validate stability under impulse loads

The engine SHALL include integration-level tests that verify the compliance system remains stable under extreme inputs (curb strikes, high-speed cornering, rapid steering).

#### Scenario: Impulse load test
- **WHEN** a 10,000 N vertical impulse is applied to a single hub for one step
- **THEN** the hub deflects and returns to equilibrium without diverging oscillation
- **AND** the chassis roll angle settles to within 0.1° within 0.5 seconds
- **AND** the test passes at the production 240 Hz step rate

#### Scenario: Combined slip with compliance
- **WHEN** the vehicle is cornering at 1.0g lateral with 0.3g longitudinal combined slip
- **THEN** hub lateral deflection is in the range 1–5 mm for GT3 bushing parameters
- **AND** the compliance does not destabilize the Pacejka combined-slip model
