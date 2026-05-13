## Implementation Tasks

### Phase 1: Domain + Preset Schema
- [ ] 1.1 Add `ComplianceConfig` interface to `packages/domain/src/shared/racing/vehicle-types.ts`
  - Fields: `hubLinearStiffnessNpm`, `hubLinearDampingNspms`, `hubRotationalStiffnessNmDeg`, `hubRotationalDampingNmSdeg`, `chassisTorsionalStiffnessNmDeg`
  - All optional with zero defaults (rigid fallback)
- [ ] 1.2 Add compliance clamping to `packages/domain/src/shared/racing/validation.ts`
  - `hubLinearStiffnessNpm`: clamp 0–500000
  - `hubRotationalStiffnessNmDeg`: clamp 0–10000
  - `chassisTorsionalStiffnessNmDeg`: clamp 0–100000
- [ ] 1.3 Add `gt3-rigid-tub` preset JSON to `packages/domain/src/infrastructure/racing/builtins/`
  - Copy `rwd-front-mid` as base, add nonzero compliance values
- [ ] 1.4 Add validation test: `gt3-rigid-tub` preset passes `clampSetup` and loads without errors

### Phase 2: Engine Physics — Hub Body Creation
- [ ] 2.1 Add `createHubBodies()` in `packages/ui/src/lib/racing/engine/jolt-loader.ts` or new file
  - Four bodies at pickup points derived from vehicle preset wheelbase/track
  - Mass 15–25 kg per hub
  - Collision disabled, motion type Dynamic
- [ ] 2.2 Add `createComplianceConstraints(chassisBody, hubBodies, preset)` helper
  - Creates `SixDOFConstraint` per hub with `SpringSettings`
  - Translational spring frequency = 10–15 Hz, damping ratio 0.7
  - Hard translational limit ±50 mm to prevent visual separation
  - When compliance fields are zero: rigid constraint (infinite stiffness, limits locked at zero)
- [ ] 2.3 Add `applyTorsionalRestoringTorque(chassisBody, preset, dt)` helper
  - Computes chassis roll from quaternion
  - Applies `τ = -k_torsion * roll_rad` around chassis longitudinal axis
  - Optional yaw-twist torque around vertical axis

### Phase 3: Engine Physics — Force Refactor
- [ ] 3.1 Refactor per-wheel spring force application to target hub body
  - Apply spring force at hub position, not chassis position
  - Force direction follows hub orientation
- [ ] 3.2 Refactor per-wheel damper force application to target hub body
  - Use hub velocity relative to chassis for damper velocity
- [ ] 3.3 Refactor ARB load transfer to target hubs
  - Apply additional vertical force at each hub on the axle
- [ ] 3.4 Refactor anti-dive/anti-squat to target hubs
  - Front hubs get anti-dive force under braking
  - Rear hubs get anti-squat force under acceleration
- [ ] 3.5 Refactor tire force application to target hub body
  - Pacejka Fx, Fy, Fz applied at contact patch offset from hub center
  - Update slip calculation to use hub velocity (not chassis velocity)
- [ ] 3.6 Add effective series stiffness calculation for ride height
  - `k_eff` = series combination of carcass + bushing + spring
  - Default carcass stiffness 200,000 N/m
  - Used in static sag and bump-stop calculations

### Phase 4: Engine Integration + Event Emitter
- [ ] 4.1 Update `RacingEngine.ts` constructor to create hub bodies and constraints
  - Call `createHubBodies` and `createComplianceConstraints` during init
  - Store hub body IDs and constraint references
- [ ] 4.2 Update `RacingEngine.ts` per-step pipeline to apply hub-centric forces
  - Replace all `addChassisForceAtPoint` with `addHubForceAtPoint`
  - Apply torsional restoring torque each step
- [ ] 4.3 Update `RacingEngine.ts` event emitter to include hub-relative data
  - `wheelEvent.hubDeflectionMm` added (optional, zero when rigid)
  - `chassisEvent.chassisRollDeg` added
- [ ] 4.4 Ensure `dispose()` cleans up hub bodies and constraints

### Phase 5: HUD / Telemetry Updates
- [ ] 5.1 Add `hubDeflection` and `chassisRoll` to `RacingHud.svelte.ts` model
  - Getter properties, zero when compliance is disabled
- [ ] 5.2 Add bushing deflection indicator to `WheelCard.svelte`
  - Small bar showing lateral/vertical deflection from nominal
  - Hidden when `hubDeflection === 0`
- [ ] 5.3 Add chassis roll readout to `DriftPanel.svelte` or new `CompliancePanel.svelte`
  - Optional widget, toggled with debug mode

### Phase 6: Tests
- [ ] 6.1 Add unit test: `effective-series-stiffness.test.ts`
  - Assert `k_eff = k_spring` when compliance is zero
  - Assert `1/k_eff = 1/k_carcass + 1/k_bushing + 1/k_spring` with nonzero values
- [ ] 6.2 Add unit test: `torsional-stiffness.test.ts`
  - Apply 1000 N·m torque to chassis → roll angle settles to `τ/k_torsion`
  - Verify restoring torque sign opposes roll direction
- [ ] 6.3 Add unit test: `hub-natural-frequency.test.ts`
  - With hub mass 20 kg and stiffness 150,000 N/m, assert natural frequency ≈ 13.8 Hz
  - With damping ratio 0.7, assert critical damping coefficient
- [ ] 6.4 Add integration test: `impulse-stability.test.ts`
  - Apply 10,000 N vertical impulse to single hub for one step
  - Assert hub deflects and returns to equilibrium without diverging
  - Assert chassis roll settles within 0.1° in 0.5 s
- [ ] 6.5 Add integration test: `combined-slip-compliance.test.ts`
  - Run 1.0g lateral + 0.3g longitudinal for 2 seconds
  - Assert hub lateral deflection is 1–5 mm for GT3 parameters
  - Assert no instability (energy growth < 0.1% per step)
- [ ] 6.6 Add import-boundary test: no `surrealdb` or `domain/infrastructure` imports from `engine/
- [ ] 6.7 Migrate existing `RacingEngine.test.ts` to include hub bodies in setup
  - Verify no test regressions when compliance is zero (default)

### Phase 7: E2E + Smoke
- [ ] 7.1 Add e2e assertion: HUD shows wheel cards without errors with compliance enabled
- [ ] 7.2 Add e2e assertion: pressing `R` resets hub bodies and constraints correctly
- [ ] 7.3 Run `bun test` for `packages/ui/src/lib/racing/**` and `packages/domain/src/**/racing/**`
- [ ] 7.4 Run `bun run check` from workspace root
- [ ] 7.5 Run `bun run build:ui` to verify bundle is clean

### Phase 8: Documentation
- [ ] 8.1 Add compliance tuning section to `packages/ui/src/lib/racing/README.md`
- [ ] 8.2 Add preset authoring guide covering compliance fields
- [ ] 8.3 Update `packages/domain/src/shared/racing/README.md` with compliance type docs
