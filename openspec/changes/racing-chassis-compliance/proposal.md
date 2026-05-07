## Why

The racing sim's chassis currently behaves as a perfectly rigid body with an inertia diagonal. Assetto Corsa, Automobilista 2, and rFactor 2 all model chassis compliance (torsional stiffness) and suspension bushing dynamics to produce the "alive" feel that separates top-tier sims from rigid-body prototypes. Research on professional sim architectures confirms that localized spring-damper compliance at suspension pickup points is the industry-standard approach and maps cleanly to our Jolt Physics + 240 Hz fixed-step architecture.

## What Changes

Add a localized soft-constraint compliance layer between the chassis body and four wheel-hub bodies in Jolt Physics. This introduces:

- Per-corner hub bodies connected to the chassis via `SixDOFConstraint` with configurable `SpringSettings`
- Bushing compliance parameters (linear stiffness, rotational stiffness, damping) on vehicle presets
- Torsional chassis stiffness modeled as a torque spring on the chassis body's yaw/roll axes
- Refactored suspension force application so springs/dampers act between hub and ground rather than chassis and ground

## Capabilities

### New Capabilities
- Chassis torsional flex under lateral load that changes effective wheel camber dynamically
- Suspension bushing compliance that adds hysteresis and delayed response to steering inputs
- Hub-body separation so tire forces apply at the hub, Jolt resolves the compliance chain
- Authored compliance parameters per vehicle class (GT3, road car, open-wheeler)

### Modified Capabilities
- `RacingEngine.ts` hub/chassis body creation and constraint setup
- Suspension force application path (hub-centric instead of chassis-centric)
- Vehicle preset schema adds compliance fields without breaking existing presets

## Impact

- Existing vehicle presets continue to work via a zero-compliance fallback (rigid attachment)
- Physics behavior changes only when compliance parameters are authored nonzero
- No changes to tire model, drivetrain, brakes, aero, or HUD
- Performance cost: +4 Jolt bodies + 4 constraints, minimal at 240 Hz
