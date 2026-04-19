# Shared Platformer Domain

Browser-safe platformer types and validation helpers consumed by both the runtime engine
(in `packages/ui/src/lib/platformer`) and the SurrealDB persistence layer
(in `packages/domain/src/infrastructure/database/platformer`).

## Boundary

- No imports from `pixi.js`, `surrealdb`, `@ai-sdk/*`, `@sveltejs/kit`, or any Node-only API.
- Pure TypeScript types and pure functions only. Safe to import from any browser bundle.
- The UI layer does not import this module directly (`packages/ui` cannot depend on
  `packages/domain`). It defines a structurally compatible mirror in
  `packages/ui/src/lib/platformer/types.ts`.
- The application and infrastructure layers may import this module freely.

## Contents

- `tile-types.ts` – `TileKind`, static metadata table.
- `entity-types.ts` – `EntityKind`, `EntitySpawn`, placeable filter.
- `map-types.ts` – `MapDefinition`, `MapMetadata`, `LevelDefinition`, `WorldDefinition`.
- `player-types.ts` – `PowerUpKind`, `PlayerProfile`.
- `service-types.ts` – `ResolvedMapEntry`, `RunResult` DTOs shared with the application.
- `validation.ts` – `validateMapDefinition` and friends.
- `index.ts` – stable public surface.
