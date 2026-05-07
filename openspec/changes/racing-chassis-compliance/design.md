## Context

The racing sim currently models the chassis as a single rigid Jolt body with an inertia diagonal. Suspension forces (spring, damper, ARB, anti-dive) are applied directly to the chassis body. This produces a "too rigid" feel because real cars have:

1. **Chassis torsional stiffness** — the tub twists under lateral load, changing effective wheel camber
2. **Suspension bushing compliance** — rubber bushings at control-arm pickup points deflect under load, adding hysteresis and delayed response

Research from professional sims (rFactor 2, AMS2, AC) confirms the industry uses localized spring-damper compliance at pickup points rather than full FEM/modal analysis. This design adapts that pattern to our Jolt Physics + 240 Hz fixed-step architecture.

## Goals / Non-Goals

**Goals:**
- Add per-corner hub bodies connected to chassis via compliant Jolt constraints
- Refactor suspension force application to be hub-centric
- Model chassis torsional stiffness as a restoring torque on the chassis body
- Add compliance parameters to vehicle preset schema
- Compute effective wheel rate as series combination of carcass + bushing + spring
- Preserve all existing behavior when compliance is zero (default)
- Land with unit tests and integration stability tests

**Non-Goals:**
- No full FEM or modal chassis analysis (computationally prohibitive at 240 Hz)
- No deformable body simulation (Jolt does not support it)
- No real-time chassis fatigue or damage accumulation
- No changes to tire model, drivetrain, brakes, aero, or audio
- No multiplayer or AI opponent changes

## Decisions

### 1. Hub bodies connected via SixDOFConstraint with SpringSettings

Add four `JPH::Body` hub instances (one per corner). Connect each to the chassis via `JPH::SixDOFConstraint` with compliance on translational DOFs. Use `JPH::SpringSettings` with:
- Frequency: 10–15 Hz (safe below tire carcass resonance at 60–100 Hz)
- Damping ratio: 0.7–1.0 (critically damped to avoid explicit integrator instability)

When compliance parameters are zero/omitted, constrain all translational DOFs rigidly (`mLimits[axis].mMin = mMax = 0` with infinite stiffness).

**Alternatives considered:**
- *Custom spring force in the engine step instead of Jolt constraints.* Rejected because it bypasses Jolt's constraint solver, which handles pose integration and coupling between bodies more accurately.
- *SliderConstraint per corner (one DOF).* Rejected because bushings deflect in all three directions simultaneously; restricting to one DOF loses coupled lateral/vertical behavior.
- *Separate constraint per bushing axis.* Rejected because it explodes constraint count (12 constraints vs 4) and Jolt's solver handles multi-axis coupling better in one SixDOF.

### 2. Torsional stiffness as a torque spring on the chassis body

Compute chassis roll angle from chassis orientation quaternion. Apply restoring torque: `τ = -k_torsion * (roll_angle - roll_nominal)` around the chassis longitudinal axis. For yaw/horizontal twist, apply similar torque around the vertical axis.

Store `k_torsion` in `N·m/rad` internally (convert from `N·m/deg` preset input). Apply via `JPH::Body::AddTorque` each step.

**Alternatives considered:**
- *Apply torsional stiffness through constraints between hubs.* Rejected because it couples left-right behavior in a non-physical way; real chassis twist is a body property.
- *Model chassis as two bodies (front/rear halves) connected by a torsion spring.* Rejected because it complicates mass distribution and center-of-gravity calculations.

### 3. Hub-centric force application

Move all per-wheel force application from `addChassisForceAtPoint` to `addHubForceAtPoint`. This includes:
- Spring force (hub to ground via spring rate and motion ratio)
- Damper force (hub velocity relative to chassis)
- ARB load transfer (applied as force offset on each hub)
- Anti-dive/anti-squat (applied to front/rear hubs)
- Tire forces (Fx, Fy, Fz at contact patch offset from hub center)

The Jolt constraint then transmits hub forces to the chassis with the compliance delay.

**Alternatives considered:**
- *Keep forces on chassis, add compliance as a post-hoc offset.* Rejected because forces would not see hub motion; the compliance would be purely visual.

### 4. Effective wheel rate as series stiffness

For ride height and sag calculations:
```
1/k_eff = 1/k_carcass + 1/k_bushing + 1/k_spring
```

Store `k_carcass` as a constant (default 200,000 N/m). `k_bushing` comes from preset `hubLinearStiffnessNpm` (default 0 = rigid = infinite). When `k_bushing` is 0, `k_eff = k_spring` (no regression).

**Alternatives considered:**
- *Use only bushing compliance for ride height, ignore carcass.* Rejected because tire carcass is a significant compliance source (~20-30% of total vertical deflection).

### 5. Backward-compatible preset schema

Add optional `compliance` sub-object to `VehiclePreset`. All existing presets omit it and get rigid behavior. A new `gt3-rigid-tub` preset demonstrates nonzero values:
```
compliance: {
  hubLinearStiffnessNpm: 150000,      // ~150 N/mm
  hubLinearDampingNspms: 2.5,
  hubRotationalStiffnessNmDeg: 8,
  hubRotationalDampingNmSdeg: 0.4,
  chassisTorsionalStiffnessNmDeg: 22000
}
```

**Alternatives considered:**
- *Add compliance fields at top-level of preset.* Rejected because grouping under a sub-object keeps the schema organized as more parameters get added.

### 6. Domain types mirror Jolt units

Compliance parameters in domain types use SI base units (N/m, N·s/m, N·m/rad). The engine layer converts to Jolt-specific units when constructing constraints. No Jolt types leak into domain.

## Risks / Trade-offs

- **Solver stability.** Four additional bodies + constraints at 240 Hz is safe for Jolt, but the spring frequency must stay well below the Nyquist limit (120 Hz). Our 10–15 Hz target has 8–16× oversampling, which is conservative.
- **Performance cost.** +4 bodies, +4 constraints, +4 contact queries per step. Estimate <5% frame time increase on desktop targets.
- **Tuning complexity.** Bushing parameters interact with spring rates, damper rates, and ARB rates. The tuning guide must document that effective wheel rate changes when compliance is added.
- **Regression risk.** Moving force application from chassis to hub changes the effective moment arm for all forces. Integration tests with known telemetry (e.g., steady-state cornering at 1.0g) must pass before merging.
- **Jolt constraint drift.** SixDOFConstraints with spring settings can drift over long integration periods. Mitigation: hard limits on translational displacement (±5 mm) prevent hubs from separating visibly from chassis.
