# `shared/voxsim`

Browser-safe shared domain types for the voxel simulation experiment (`docs/experiment/003`).

## Boundary

- **Browser-safe**. This subdomain must not import `three`, `jolt-physics`, `@tensorflow/*`, `cytoscape`, SurrealDB, SvelteKit, or any AI SDK module. Anything declared here must be importable from both the renderer (`packages/ui`) and Surreal mappers (`packages/domain/src/infrastructure/database/voxsim/`) without pulling a runtime dependency.
- **Pure data, no behaviour beyond validation.** Engine systems, physics adapters, brains, and trainers live in their respective dedicated subdomains. Constructing `Vec3`s, `Chunk`s, or `ArenaDefinition`s here must never require IO.
- **Source of truth for cross-plan contracts.** `02-jolt-physics-boundary.md` consumes `Chunk`, `03-morphology-joints-and-dna.md` consumes `Vec3` / `Quat` / `Transform`, `04`–`07` consume the agent and arena DTOs.

## Cross-plan responsibility split

| Concern | Owner |
| --- | --- |
| Voxel vocabulary, chunk shape, arena shape | this file (plan 01) |
| Per-chunk colliders, joint constraints, motors | `shared/voxsim/physics` (plan 02) |
| Body morphology, sensors, actuators, body DNA | `shared/voxsim/morphology` (plan 03) |
| Brain DNA, NEAT genomes, checkpoint refs | `shared/voxsim/brain` (plan 04) |
| Training DNA, NEAT trainer config, progress events | `shared/voxsim/training` (plan 05) |
| Inspector DTOs, replay format | `shared/voxsim/inspector` (plan 06) |
| Service-facing DTOs, list filters, summaries | `shared/voxsim/service-types.ts` (plan 07) |

## UI mirror

`packages/ui` cannot import `packages/domain` (see `packages/ui/AGENTS.md`). The voxsim engine in `packages/ui/src/lib/voxsim/types.ts` mirrors the structural shape of these types as local UI types. Domain types satisfy the UI types structurally at the app composition boundary. **If you change a field here, mirror it in the UI types in the same change.**
