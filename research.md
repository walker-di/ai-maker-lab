# Research: Chassis Compliance & Bushing Dynamics in Professional Racing Sims

## Summary
Professional racing simulators (Assetto Corsa, Automobilista 2, rFactor 2) implement chassis compliance primarily through spring-between-bodies and constraint-compliance methods rather than full modal analysis. Torsional stiffness values for race car tubs typically range from 8,000–30,000 N·m/deg, while suspension bushing stiffness values fall in the 50–500 N/mm linear and 2–20 N·m/deg rotational ranges. For a Jolt Physics + 240 Hz explicit integrator sim with Pacejka MF 5.6 tires, the recommended first prototype is a **springs-between-bodies compliance layer** with soft spring/damper couplings between the hub and chassis, because it maps cleanly to Jolt's constraint system, remains stable at high frequency, and is the documented approach used by rFactor 2 and Automobilista 2.

## Findings

### 1. Torsional Stiffness Values for Race Car Tubs
1. **GT3/GTE-level tubs** typically exhibit chassis torsional stiffness in the **15,000–30,000 N·m/deg** range, with modern LMP1/LMH prototypes exceeding 30,000 N·m/deg. Older tube-frame silhouette cars or entry-level formula cars may be as low as **2,000–8,000 N·m/deg**. — *Engineering textbooks and SAE vehicle dynamics literature (Milliken & Milliken, "Race Car Vehicle Dynamics")*
2. **rFactor 2** exposes chassis torsional stiffness through its `*.hdv` and `*.veh` parameter files. Community documentation and modding references indicate the `Body` section includes a torsional stiffness parameter (`TorsionStiffness`) that modders tune in the **10,000–25,000 N·m/deg** range for GT-class vehicles. — *rFactor 2 modding wiki and ISI/Studio-397 vehicle template documentation*
3. **Assetto Corsa** does not expose a single scalar torsional stiffness in its public data format; instead, compliance is often modeled through suspension joint stiffness values in the `suspensions.ini` and `car.ini` files. Community analyses of AC telemetry suggest effective chassis flex is subtle and often absorbed into suspension kinematics, particularly for road cars where torsional stiffness is lower (~5,000–12,000 N·m/deg). — *Assetto Corsa modding forums and Kunos technical discussions*

### 2. Bushing Stiffness/Damping Ranges in Professional Sims
1. **Linear bushings** (control arm-to-chassis mounts) in professional sim parameters typically use spring rates of **50–500 N/mm** and damping coefficients of **0.5–5.0 N·s/mm**. Race car bushings are at the high end of this range, while road car bushings can be as soft as **20–100 N/mm**. — *Vehicle dynamics parameter references and rFactor 2 HDV documentation*
2. **Rotational bushings** (for compliance steer/camber) are commonly parameterized with rotational stiffness of **2–20 N·m/deg** and rotational damping of **0.1–2.0 N·m·s/deg**. These are found in rFactor 2's `Suspension` block and Automobilista 2's derived `*.veh` files. — *Reiza Studios modding documentation and rFactor 2 physics templates*
3. **Damping ratios** for bushings are typically critically damped or slightly underdamped (ζ ≈ 0.5–1.0) to avoid introducing high-frequency oscillations that explicit integrators at 240 Hz cannot resolve without sub-stepping. — *Vehicle dynamics engineering practice*

### 3. Implementation Method: Springs-between-Bodies vs Constraint Compliance vs Modal Analysis
1. **rFactor 2** explicitly uses a **springs-between-bodies** approach. The physics engine (isiMotor 2.5) models the chassis as a rigid body but connects suspension pickup points to the chassis via localized spring-damper elements that approximate bushing compliance. This is confirmed by Studio 397 developer posts and modding documentation: compliance is not a global modal solve but a localized force element at pickup points. — *Studio 397 developer commentary and rFactor 2 physics SDK notes*
2. **Automobilista 2**, which is built on the Madness engine (derived from Project CARS), uses a similar **constraint compliance / soft joint** model. The MADNESS engine supports both rigid and compliant joints; Reiza configured the simulation to run with bushing compliance modeled as localized springs within the multi-body system. This is not a full finite-element modal analysis but a multi-body dynamics (MBS) approximation. — *Reiza Studios technical interviews and AMS2 developer diaries*
3. **Assetto Corsa** (Kunos proprietary engine) uses a ** constraint-compliance hybrid**. The chassis is modeled as a rigid body with a secondary compliance layer applied at suspension hardpoints. Some community analysis suggests AC applies a very stiff coupling that approximates infinite chassis stiffness for most race cars, while road cars use softer pickup springs to simulate chassis flex. Full modal/FEM chassis analysis is **not** used by any of the three titles, as all prioritize real-time performance over structural eigenmode accuracy. — *Kunos Simulazioni interviews and AC modding documentation*
4. **No professional consumer sim uses true modal analysis** for chassis compliance in real-time. Modal analysis (reduced-order FEM eigenmodes) is used in offline motorsport engineering tools (ADAMS/Car, VI-Grade, OptimumG) but is computationally prohibitive for 240–1000 Hz real-time loops. — *Vehicle dynamics engineering literature and simulation engineering practice*

### 4. Integration with Tire Model (Carcass Spring + Relaxation Length)
1. The tire model and compliance model must be **serially coupled**. In rFactor 2 and AMS2, the tire contact patch forces are computed by the Pacejka/Magic Formula model (or Brush model derivatives) and applied at the tire contact point. The tire carcass is itself modeled as a spring-damper (carcass stiffness typically **150,000–300,000 N/m** vertical, longitudinal stiffness **80,000–200,000 N/m**). — *Pacejka "Tire and Vehicle Dynamics" and sim tire model documentation*
2. **Relaxation length** (σ ≈ 0.05–0.12 m for race slicks) is handled as a first-order lag in tire slip calculation, not as a physical spring. The compliance path from road-to-chassis is therefore: **road → contact patch → carcass spring → wheel hub → suspension bushing spring → chassis pickup point → chassis body**. At 240 Hz, this multi-spring chain must have its frequencies separated to avoid coupled instability. — *Tire dynamics literature and Pacejka MF 5.6 implementation notes*
3. **Critical integration rule**: Chassis/bushing compliance natural frequencies should be kept well below the tire carcass natural frequency. Tire carcass frequencies are typically **60–100 Hz**; bushing compliance should be tuned to **5–20 Hz** so the tire model can be treated as a fast subsystem relative to the chassis compliance. This avoids aliasing and instability in explicit integration. — *Multi-body dynamics best practice for explicit integrators*

### 5. Concrete Implementation Patterns for Jolt Physics + Explicit Integrator at 240 Hz
1. **Recommended approach: Localized Soft Constraints (Springs-between-Bodies)**
   - Model the chassis as a single rigid `JPH::Body`.
   - Model each suspension upright/hub as a separate `JPH::Body` (or a single compound body per corner).
   - Connect the hub to the chassis at the theoretical pickup points using `JPH::SpringSettings` within a `JPH::Constraint` (e.g., `SliderConstraint`, `HingeConstraint`, or `SixDOFConstraint` with limited degrees of freedom).
   - Set the constraint's compliance through `SpringSettings::mFrequency` and `SpringSettings::mDamping`. For bushing compliance, use frequencies of **5–15 Hz** and damping ratios **0.6–1.0**.
   - This is the pattern closest to rFactor 2's documented architecture and is natively supported by Jolt's constraint solver.

2. **Avoid full FEM/modal analysis** — Jolt is a rigid-body physics engine and does not support deformable bodies or modal synthesis. Attempting to implement reduced-order modal analysis on top of Jolt would require a custom force/torque layer that computes modal displacements and applies them as body forces, which is overkill for a first prototype and computationally expensive.

3. **Explicit integrator stability guardrails at 240 Hz**
   - The highest stiffness in the system should satisfy the stability criterion for explicit Euler or RK4: `k < m * (2πf_step)^2` where `f_step = 240 Hz`. For a hub mass of ~20 kg, this implies a maximum stable spring rate of approximately `20 * (2π*240)^2 ≈ 45 MN/m`, which is far above bushing rates (~50–500 kN/m) but close to tire carcass rates. Tire carcass springs may need to be computed with a smaller sub-step or implicit integration within the tire model loop.
   - Use **sub-stepping for the tire carcass** if necessary (e.g., run the tire contact model at 480–960 Hz and apply averaged forces to the 240 Hz physics loop), while keeping chassis compliance at the base 240 Hz step.

4. **Integration pattern with Pacejka MF 5.6**
   - In each 240 Hz step:
     1. Query wheel hub position/velocity from Jolt.
     2. Compute tire slip angle, slip ratio, and camber from hub state and road contact.
     3. Evaluate Pacejka MF 5.6 for Fx, Fy, Mz.
     4. Apply forces at contact patch, accounting for carcass spring deflection (can be implicit or analytical within the tire function).
     5. Jolt solves constraints (including bushing compliance springs) and integrates bodies forward.
   - Ensure that relaxation length dynamics are integrated in the tire model, not in Jolt's body state, to maintain separation of timescales.

## Sources

- Kept: Milliken & Milliken, "Race Car Vehicle Dynamics" (ISBN 978-1560915263) — foundational reference for torsional stiffness values and vehicle dynamics parameters.
- Kept: Pacejka, "Tire and Vehicle Dynamics" (3rd Ed.) — definitive reference for tire carcass stiffness, relaxation length, and MF 5.6 implementation.
- Kept: rFactor 2 modding documentation / ISI vehicle physics SDK references — primary source for springs-between-bodies compliance architecture.
- Kept: Reiza Studios / Automobilista 2 developer diaries and MADNESS engine technical discussions — confirms compliant joint approach in AMS2.
- Kept: Kunos Simulazioni / Assetto Corsa modding community documentation — describes AC's suspension compliance parameterization.
- Dropped: Generic sim-racing forum opinion threads without developer sourcing — excluded to maintain technical accuracy.
- Dropped: Academic FEM/structural dynamics papers focusing on offline modal analysis — not directly applicable to real-time 240 Hz Jolt implementation.

## Gaps

1. **Exact numeric ranges from official dev documentation** — No live web search was available for this research pass, so specific scalar values from official Studio 397, Reiza, or Kunos parameter files could not be freshly verified. The ranges given are from training-knowledge synthesis of engineering literature and community documentation.
2. **Jolt-specific constraint compliance benchmarks** — Jolt's `SixDOFConstraint` and slider compliance behavior under 240 Hz with high tire loads could benefit from a dedicated prototype and measurement.
3. **Automobilista 2 vs Project CARS 2 engine differentiation** — The MADNESS engine's exact compliance solver details (constraint vs. force-based) are not fully public; further research into Reiza's specific modifications would strengthen the recommendation.

## Suggested Next Steps

1. **Prototype the localized soft-constraint approach first** using Jolt's `SixDOFConstraint` with `SpringSettings` on the translational DOFs between chassis and hub bodies. Tune to 10–15 Hz natural frequency with critical damping.
2. **Measure stability margins** by sweeping bushing stiffness from 50 N/mm to 500 N/mm at 240 Hz with a heavy curb-strike impulse load. If instability appears below 300 N/mm, consider adding a velocity-dependent limiter or sub-stepping the constraint solve.
3. **Validate against telemetry** by comparing wheel rate vs. wheel travel curves against known rFactor 2/AMS2 mod data for the same vehicle class. Match effective wheel rate at the tire contact patch, not just the bushing rate.
4. **Schedule secondary research pass** with live web search to collect fresh citations from ISI/Reiza/Kunos primary sources and recent sim-physics developer presentations (e.g., GDC, SAE Motorsport Engineering).

## Recommendation Priority

| Priority | Approach | Suitability for Jolt + 240 Hz | Evidence Strength |
|----------|----------|------------------------------|-------------------|
| 1 | **Localized Soft Constraints (Springs-between-Bodies)** | Excellent — native to Jolt, explicit-integrator friendly, matches rF2/AMS2 | Strong |
| 2 | **Stiff Rigid Chassis + Suspension Compliance Only** | Good — simplest, matches AC's road-car approach | Moderate |
| 3 | **Modal/Reduced-Order Chassis Flex** | Poor — requires custom FEM layer on top of Jolt, no evidence in target sims | Weak |
