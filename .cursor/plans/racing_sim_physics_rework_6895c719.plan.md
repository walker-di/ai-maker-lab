---
name: Racing Sim Physics Rework
overview: Rework the racing simulation physics toward a top-sim baseline (Assetto Corsa / AMS2 / rFactor 2 / Rennsport) by replacing the current ad-hoc tire model with a Pacejka 5.6-style brush-model with relaxation length in a proper SAE wheel frame, adding explicit lateral load transfer with sprung/unsprung split and aero downforce, redesigning the drivetrain with proper inertia chain and implicit clutch coupling, and tightening steering / low-speed behaviour.
todos:
  - id: phase-1-relaxation
    content: "Phase 1: SAE wheel frame, slip definitions, tire relaxation length helper, wire dynamic slip into wheel pass."
    status: pending
  - id: phase-2-pacejka-mf
    content: "Phase 2: Pacejka 5.6 MF with normalized combined slip, proper load sensitivity, drop the friction circle clamp."
    status: pending
  - id: phase-3-lateral-load
    content: "Phase 3: Explicit lateral load transfer with CG height and sprung/unsprung split, applied to per-wheel Fz before Pacejka."
    status: pending
  - id: phase-4-downforce
    content: "Phase 4: Aero downforce per axle, additive on Fz scaled by speed squared."
    status: pending
  - id: phase-5-drivetrain
    content: "Phase 5: Drivetrain inertia chain, Karnopp stick-slip clutch, implicit/sub-stepped engine-wheel coupling, Salisbury LSD."
    status: pending
  - id: phase-6-steering
    content: "Phase 6: Mz with pneumatic + mechanical trail and scrub, self-centering driven by Mz, low-speed wheel-rotation lock."
    status: pending
  - id: phase-7-tests
    content: "Phase 7: Unit tests for new helpers and integration tests for drift entry/maintain/catch, high-speed corner, launch."
    status: pending
isProject: false
---

# Racing Sim Physics Rework

## Why a phased rework

The current model already has Pacejka long/lat, ARB elastic transfer, anti-dive / anti-squat, camber thrust, Mz, combined-slip Gxa/Gyk and longitudinal load transfer. What it does **not** have, and what makes it feel different from AC / AMS2 / rFactor 2 / Rennsport, is the structural physics layer beneath the tire force calls: relaxation length, normalized combined slip in a proper SAE frame, explicit lateral load transfer with CG height, downforce, drivetrain inertia, implicit clutch coupling, and a low-speed model that does not cliff at the `slipEps = 1.5` floor.

The rework is large enough to need phases. Each phase is independently testable, leaves the build green, and unlocks the next.

## Target physics pipeline

```mermaid
flowchart TD
  Input[Driver input] --> Drivetrain[Drivetrain<br/>engine + flywheel + clutch + gearbox + diff]
  Drivetrain -->|"wheel torque"| WheelRot[Wheel rotational dynamics]
  WheelRot -->|"omega"| SAE[SAE wheel-local frame<br/>vx, vy at contact patch"]
  Suspension[Suspension + ARB + bump stops] --> LongLT[Longitudinal load transfer]
  LongLT --> LatLT[Lateral load transfer<br/>"m * a_y * h / track + sprung/unsprung"]
  LatLT --> Aero[Aero downforce + drag]
  Aero --> Fz[Per-wheel Fz]
  SAE -->|"kappa, alpha"| Relax[Relaxation length filter<br/>"first-order lag on kappa, alpha"]
  Relax --> MF[Pacejka 5.6 MF<br/>combined slip on normalized vector]
  Fz --> MF
  MF --> Forces[Fx, Fy at contact patch]
  Forces --> Chassis[Rigid-body integrator]
  Chassis --> Telemetry[Telemetry + HUD]
```

## Phase 1: SAE wheel frame, slip definitions, relaxation length

Files: [`packages/ui/src/lib/racing/engine/physics/wheel-kinematics.ts`](packages/ui/src/lib/racing/engine/physics/wheel-kinematics.ts), [`packages/ui/src/lib/racing/engine/RacingEngine.ts`](packages/ui/src/lib/racing/engine/RacingEngine.ts), new [`packages/ui/src/lib/racing/engine/physics/relaxation.ts`](packages/ui/src/lib/racing/engine/physics/relaxation.ts).

- Standardize coordinate frame at each contact patch on SAE: `+x` = rolling direction, `+y` = chassis-right of the wheel forward, `+z` = up.
- Replace `computeSlipAngleRad(vx, vy, minLongSpeed = 1.5)` with a relaxation-length implementation:

```ts
export interface RelaxationStepInput {
  slipTarget: number;
  slipDynamic: number;
  contactSpeed: number;
  relaxationLength: number;
  dt: number;
}
export function stepRelaxedSlip(input: RelaxationStepInput): number;
```

- Per-wheel state in `WheelState`: `slipRatioDynamic`, `slipAngleDynamic`. The dynamic values are what feed Pacejka. Defaults `sigmaX = 0.40 m`, `sigmaY = 0.55 m`.
- Removes the `slipEps = 1.5` cliff at low speed because the lag time constant `relaxationLength / |vx|` naturally extends as `|vx| -> 0`. Use a small floor on contact speed only inside the lag, not in slip definition.

## Phase 2: Pacejka 5.6 MF with proper combined slip and load sensitivity

Files: [`packages/ui/src/lib/racing/engine/physics/pacejka.ts`](packages/ui/src/lib/racing/engine/physics/pacejka.ts), [`packages/ui/src/lib/racing/engine/physics/tire-load.ts`](packages/ui/src/lib/racing/engine/physics/tire-load.ts), [`packages/ui/src/lib/racing/engine/RacingEngine.ts`](packages/ui/src/lib/racing/engine/RacingEngine.ts).

- Move B, C, D, E coefficients to per-axle constants on the vehicle preset (front and rear can differ). Default values matching a sport tire.
- Replace the `tireD` linear falloff with Pacejka's official load sensitivity:
  - `dfz = (Fz - Fz0) / Fz0`, `D = mu * Fz * (1 + p_dy1 * dfz + p_dy2 * dfz^2)`.
- Replace ad-hoc `Gxa = cos(arctan(K * a))` / `Gyk` with the SAE 1996 form using normalized slips:
  - `kappa_n = kappa / kappa_peak`, `alpha_n = tan(alpha) / alpha_peak`, `sigma = hypot(kappa_n, alpha_n)`.
  - Combined magnitude through one MF call against `sigma`, then projected:
    - `Fx = Fx_pure(kappa) * cos(arctan(B_xa * alpha_n * C_xa))`
    - `Fy = Fy_pure(alpha) * cos(arctan(B_yk * kappa_n * C_yk))`
- Drop the isotropic friction circle clamp in `runWheelPass`. Combined-slip MF saturates naturally; the clamp was a second penalty on top of Gxa/Gyk and over-killed `Fx` in transitions.

## Phase 3: Lateral load transfer with CG height and sprung/unsprung split

Files: new [`packages/ui/src/lib/racing/engine/physics/load-transfer.ts`](packages/ui/src/lib/racing/engine/physics/load-transfer.ts), [`packages/ui/src/lib/racing/types.ts`](packages/ui/src/lib/racing/types.ts), [`packages/ui/src/lib/racing/engine/RacingEngine.ts`](packages/ui/src/lib/racing/engine/RacingEngine.ts).

- Move `computeLongitudinalLoadTransfer` to the new `load-transfer.ts`.
- Add `computeLateralLoadTransfer({ accelLatMs2, sprungMassKg, unsprungMassKgFront, unsprungMassKgRear, sprungCgHeightM, unsprungCgHeightM, trackWidthM, frontRollStiffnessShare })` returning `{ frontDelta: number, rearDelta: number }` per axle.
- Use front roll stiffness share (function of `arbFront`, `arbRear`, springs) to split the sprung-mass lateral transfer between axles. This is the key "stiffer front bar = more understeer" lever the top sims expose.
- Apply the per-axle lateral transfer additively to per-wheel `Fz` BEFORE Pacejka. Keep the existing ARB elastic transfer for transient response inside the same axle (it represents the elastic compliance, lateral transfer is the rigid-body component).

## Phase 4: Aero downforce

Files: [`packages/ui/src/lib/racing/engine/physics/aero.ts`](packages/ui/src/lib/racing/engine/physics/aero.ts), [`packages/ui/src/lib/racing/types.ts`](packages/ui/src/lib/racing/types.ts), [`packages/ui/src/lib/racing/engine/RacingEngine.ts`](packages/ui/src/lib/racing/engine/RacingEngine.ts).

- Extend `VehiclePhysicsPreset` with `clAreaFrontM2`, `clAreaRearM2` (defaults near 0.0 to keep the existing road-car tunings unchanged).
- New helper `computeAeroDownforce({ forwardSpeed, clAreaFront, clAreaRear, airDensity })` returning `{ frontDownforceN, rearDownforceN }`. Add per-axle `Fz` before Pacejka.
- Wire so high-speed corners get the expected fz boost.

## Phase 5: Drivetrain rework with inertia chain and implicit clutch

Files: [`packages/ui/src/lib/racing/engine/physics/drivetrain.ts`](packages/ui/src/lib/racing/engine/physics/drivetrain.ts), [`packages/ui/src/lib/racing/engine/RacingEngine.ts`](packages/ui/src/lib/racing/engine/RacingEngine.ts).

- New `DrivetrainState`: `{ engineOmega, transmissionOmega, leftWheelOmega, rightWheelOmega, gearIndex }`.
- New inertias: `engineInertia`, `flywheelInertia`, `gearboxInertia`, `propshaftInertia`, `diffInertia`. Lump into `effectiveInertiaAtEngine` and `effectiveInertiaAtWheel` for the integrator.
- Replace `computeClutchTorque` slip-spring with a Karnopp-style stick-slip clutch:
  - When `|engineOmega - wheelEngineOmega| <= stickThreshold`, treat as locked: solve constrained dynamics so `engineOmega = wheelEngineOmega` and clutch torque equals the constraint force.
  - When slipping, kinetic friction at `clutchMaxTorque * sign(slip)`.
- Sub-step the drivetrain 4x within each physics step so the engine catches wheels in one outer step. This eliminates the multi-step lag where deep slides took dozens of frames to recover.
- Differential model: refine `clutchLSD` to a Salisbury / ramp model with separate power and coast ramps, lock torque = `preload + powerRamp * driveTorque + coastRamp * coastTorque`. Tunable via existing preset fields.

## Phase 6: Steering, self-aligning, low-speed

Files: [`packages/ui/src/lib/racing/engine/physics/mz.ts`](packages/ui/src/lib/racing/engine/physics/mz.ts), [`packages/ui/src/lib/racing/engine/input.ts`](packages/ui/src/lib/racing/engine/input.ts), [`packages/ui/src/lib/racing/engine/RacingEngine.ts`](packages/ui/src/lib/racing/engine/RacingEngine.ts).

### Phase 6 target

Bring the steering and standstill behaviour closer to a top-sim baseline without turning the keyboard input model into a force-feedback wheel model. The implementation should keep the current pure-helper style, keep signs explicit, and preserve the previous chassis-yaw meaning of `w.mz`: it is still a yaw torque added about `chassis.up`. What changes is the source of that moment and how a front-axle steering feedback signal is fed back into the input actuator.

Current gaps this phase fixes:

- `computeSelfAligningMoment` is only pneumatic trail against slip-driven `Fy`, with no mechanical trail from caster and no scrub-radius longitudinal contribution.
- `RacingInput` self-centres from `casterDeg` only, so steering return is disconnected from front tire load, grip, understeer, braking, and reversing.
- Low-speed force scaling and the old `slipEps = 1.5` slip floor hide standstill oscillation instead of constraining wheel rotation when contact-patch speed is near zero.
- Front `Mz` is used only as chassis yaw torque; there is no normalized steering-aligning signal for keyboard/gamepad steering feel.

### 6A. Upgrade `mz.ts` into an explicit trail model

Replace the single-trail helper with a result object so tests and telemetry can inspect each contributor:

```ts
export interface AligningMomentInput {
  slipAngleRad: number;
  fySlip: number;
  fx: number;
  casterDeg: number;
  pneumaticTrail0M?: number;
  pneumaticTrailDecayDeg?: number;
  casterTrailScaleMPerDeg?: number;
  mechanicalTrailMaxM?: number;
  scrubRadiusM?: number;
}

export interface AligningMomentResult {
  pneumaticTrailM: number;
  mechanicalTrailM: number;
  scrubRadiusM: number;
  pneumaticMz: number;
  mechanicalMz: number;
  scrubMz: number;
  mz: number;
}

export function computeAligningMoment(input: AligningMomentInput): AligningMomentResult;
```

Model:

- `pneumaticTrailM = pneumaticTrail0M * exp(-abs(alpha) / decayRad)`.
- `mechanicalTrailM = clamp(casterDeg * casterTrailScaleMPerDeg, 0, mechanicalTrailMaxM)`.
- `mz = (pneumaticTrailM + mechanicalTrailM) * fySlip + scrubRadiusM * fx`.
- Defaults should be road-car conservative: `pneumaticTrail0M = 0.042`, `pneumaticTrailDecayDeg = 15`, `casterTrailScaleMPerDeg = 0.006`, `mechanicalTrailMaxM = 0.065`, `scrubRadiusM = 0.015`.
- Keep a compatibility export only if it keeps the phase smaller, but tests should move to `computeAligningMoment` so the richer contract becomes the default.

Important sign rule:

- Preserve the existing chassis-yaw sign expectation: positive `fySlip` returns positive pneumatic/mechanical `Mz`, because the engine adds `w.mz` directly to chassis-up torque to shorten the front contact-patch lever arm. Add explicit tests for positive and negative `Fy`.
- Scrub sign must be validated with braking and drive force. Start with `scrubMz = scrubRadiusM * fx`, then verify in integration that braking with steering does not amplify yaw in the wrong direction. If signs are ambiguous, add a dedicated helper parameter for `lateralSign` instead of burying a wheel-index conditional in `RacingEngine`.

### 6B. Add preset-level geometry knobs

Extend `VehiclePhysicsPreset` in both UI and shared domain mirrors:

- `pneumaticTrail0M?: number`
- `pneumaticTrailDecayDeg?: number`
- `casterTrailScaleMPerDeg?: number`
- `mechanicalTrailMaxM?: number`
- `scrubRadiusM?: number`
- `steeringAlignTorqueMaxNm?: number`
- `steeringAlignCentreRateScale?: number`

Apply defaults inside `RacingEngine.applyVehiclePhysicsPreset()` or local steering geometry fields, not inside the wheel loop. Keep setup `casterDeg` as the user-facing setup value; the preset fields describe car geometry.

Initial defaults:

- Road car: small positive scrub, moderate pneumatic trail, caster-derived trail capped low.
- Drift/tuned car presets can later increase `mechanicalTrailMaxM` and reduce `steeringAlignCentreRateScale` if they need stronger self steer without snapping keyboard input.

### 6C. Produce a front-axle steering feedback signal

In `RacingEngine.runWheelPass()`:

- Compute `w.mz` after combined-slip `Fy`/`Fx` are known and before camber thrust is added, matching the current `fySlip` contract.
- For front wheels, collect `frontAlignMz = sum(w.mz)` and `frontAlignLoad = sum(w.fz)`.
- Convert that to a normalized feedback signal after the wheel loop:
  - `alignNorm = clamp(frontAlignMz / steeringAlignTorqueMaxNm, -1, 1)`.
  - Optionally gate by load/contact: no front contact means zero feedback.
  - Low-pass filter it on the engine side, e.g. `steeringAlignFeedback += (alignNorm - steeringAlignFeedback) * (1 - exp(-dt * 20))`.
- Expose the filtered value to `RacingInput` before `input.update()` on the next tick, or change `RacingInput.update()` to accept an optional `steeringAlignFeedback` argument and call it after basis/previous feedback are known.

Preferred small-step wiring:

```ts
this.input.setSteeringAlignFeedback(this.steeringAlignFeedback);
this.input.update(dt, this.speedKmh);
```

This avoids coupling `RacingInput` to wheels or Three.js and keeps the input class as a simple actuator model.

### 6D. Replace caster-only self-centering in `RacingInput`

Change input options from `casterDeg` to a physical feedback source:

- Add `alignFeedback?: () => number`, returning `[-1, 1]`.
- Keep `casterDeg?: () => number` only temporarily if needed for compatibility during this phase; remove it once `RacingEngine` is wired.
- When no driver steering key is held, self-centre by combining baseline return rate and tire feedback:
  - baseline keeps keyboard steering usable at zero load.
  - aligning feedback chooses direction and strength when the tires are generating `Mz`.
- When the driver is actively steering, do not let feedback fight the requested direction strongly enough to prevent countersteer. Limit feedback to a small assist/damping term under input and a stronger return term when released.

Target behaviour:

- Releasing steering in a loaded corner should return faster than in the pits.
- In understeer, steering should go lighter as pneumatic trail collapses.
- During a slide, countersteer input should still use the existing fast `counterRate`; self-aligning must not slow the catch.
- At very low speed, steering should not twitch from noisy `Mz`; gate feedback below roughly `0.4 m/s` or when front axle load is near zero.

### 6E. Low-speed wheel-rotation lock

After Phase 1 relaxation removes the slip-angle speed floor, add a low-speed wheel angular constraint in the wheel torque stage:

- Use contact-patch `vx` in the wheel frame, not total chassis speed.
- If `abs(vx) < lowSpeedWheelLockSpeedMps` and the wheel has contact:
  - With no meaningful drive/brake torque, set `w.omega = vx / w.radius` and skip free slip-ratio growth.
  - With brake held, allow `w.omega` to clamp toward zero, but prevent sign chatter around zero.
  - With drive torque, blend out of the lock as soon as requested tractive torque exceeds a small threshold so launches still build slip naturally.
- Suggested constants:
  - `lowSpeedWheelLockSpeedMps = 0.4`
  - `lowSpeedWheelLockBlendSpeedMps = 0.8`
  - `lowSpeedDriveUnlockTorqueNm = 35`
  - `lowSpeedBrakeLockTorqueNm = 50`

Implementation shape:

```ts
export interface LowSpeedWheelLockInput {
  vx: number;
  omega: number;
  radius: number;
  driveTorqueNm: number;
  brakeTorqueNm: number;
  lockSpeedMps?: number;
  blendSpeedMps?: number;
  driveUnlockTorqueNm?: number;
  brakeLockTorqueNm?: number;
}

export function applyLowSpeedWheelRotationLock(input: LowSpeedWheelLockInput): {
  omega: number;
  locked: boolean;
  blend: number;
};
```

Place this helper either in `wheel-kinematics.ts` or a new `low-speed-wheel.ts`; prefer a new file if the helper grows beyond the simple constraint. Wire it after brake/drive net torque is known and before `spinAngle` integration.

### 6F. Remove old low-speed masking

This phase should remove or sharply reduce the standstill masking that made the old model feel disconnected:

- Delete the `slipEps = 1.5` dependency once Phase 1 dynamic slip exists.
- Remove the broad `lowSpeedScale` force fade, or replace it with a narrow contact-patch velocity blend only for numerical stability.
- Keep rolling resistance disabled close to zero to avoid jitter, but make the threshold explicit and tested.

Do not do this before Phase 1, because without relaxation length and dynamic slip state the raw low-speed slip definitions will be noisy.

### 6G. Tests and acceptance checks

Unit tests:

- `computeAligningMoment` returns pneumatic, mechanical, scrub, and total moments with expected signs.
- Pneumatic trail decays with slip angle while mechanical trail remains available.
- Caster increases mechanical trail up to a cap.
- Scrub contribution changes with `Fx` and is zero when `scrubRadiusM = 0`.
- Low-speed wheel lock sets `omega = vx / radius` at tiny `vx` with no torque.
- Low-speed wheel lock unlocks under drive torque and clamps cleanly under brake torque.
- `RacingInput` centres faster with aligning feedback than with baseline only, but countersteer rate remains faster than active rate.

Integration tests:

- Releasing steering at 60-100 km/h after a steady corner reduces `abs(steerSmoothed)` faster when front tires are loaded than when the car is stationary.
- High-slip understeer produces lower front aligning feedback than a moderate-slip corner at similar load.
- Launch from standstill does not oscillate wheel omega sign, slip ratio, or chassis longitudinal acceleration.
- Braking to zero from low speed settles with wheel omega near zero and no repeated forward/backward jitter.

Manual play-test focus:

- Corner exit: wheel should naturally unwind without snapping to centre.
- Drift catch: countersteer remains quick and the car does not refuse driver input because of self-aligning feedback.
- Parking-lot crawl: no visible tire spin chatter or car rocking at standstill.
- Trail braking: scrub contribution should add believable steering weight/yaw nuance without turning normal braking into a spin trigger.

## Phase 7: Tests, telemetry, tuning

Files: [`packages/ui/src/lib/racing/engine/physics/contributors.test.ts`](packages/ui/src/lib/racing/engine/physics/contributors.test.ts), [`packages/ui/src/lib/racing/engine/RacingEngine.test.ts`](packages/ui/src/lib/racing/engine/RacingEngine.test.ts), new dedicated `relaxation.test.ts`, `load-transfer.test.ts`, `pacejka-mf.test.ts`.

- Unit tests for each new helper: relaxation lag time constant, lateral load transfer sign/magnitude, downforce vs speed squared, Pacejka MF combined slip projecting to pure-slip when α=0 or κ=0, drivetrain inertia conservation.
- Integration tests on `RacingEngine`:
  - Drift entry: rear `Fy` saturates BEFORE rear `Fx` collapses to zero.
  - Drift maintain: open throttle in slide produces `accelLongG > 0` and rear-loaded chassis (regression we already added stays green).
  - Catch / countersteer: lifting + countersteer brings sideslip back below 5° within 1 second from a 25° slide.
  - High-speed corner: 200 km/h corner generates measurable rear `Fz` increase from downforce.
  - Launch from standstill: smooth `accelLongG` rise without low-speed oscillation.

## Verification

- `bun test packages/ui/src/lib/racing/engine` after each phase, must stay green.
- `bun run test:e2e:racing` (or scoped Playwright runs) for chassis-level regression.
- Manual play-test against the four reference sims, comparing chase-camera feel for: corner entry, mid-drift throttle, countersteer recovery, launch, high-speed sweep.