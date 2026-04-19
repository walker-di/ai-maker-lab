# Shared RTS Types

Browser-safe shared domain types for the RTS experiment (`docs/experiment/001`).

These exports cover map definitions, factions, terrain/altitude/resources,
units/buildings/tech, match definitions and results, and the seeded RNG used by
both the map generator and the AI controllers.

## Boundaries

- Must stay browser-safe. No imports from Pixi, SurrealDB, SvelteKit, AI SDK,
  or any infrastructure modules.
- The UI package mirrors these shapes locally in
  `packages/ui/src/lib/rts/types.ts` per the chat / platformer pattern.
- Application use cases consume these types and the validators from
  `validation.ts`.

## Modules

- `iso.ts` – isometric coordinate primitives shared by validator, generator,
  and UI renderer.
- `terrain.ts` – terrain kinds and their static properties.
- `resources.ts` – resource kinds and `ResourceNode`.
- `units.ts` – `UnitKind`, `BuildingKind`, `TechKind`, and `STATS`.
- `factions.ts` – `Faction`.
- `map-types.ts` – `MapDefinition`.
- `match-types.ts` – `MatchDefinition`, `MatchResult`.
- `validation.ts` – `validateMapDefinition`.
- `service-types.ts` – `ResolvedRtsMap`, `ListMatchResultsFilter`,
  `MatchResultRecord` shape used at the service boundary.
- `rng.ts` – `SeededRng` (used by both AI and map generator).
- `generation/` – generation parameter vocabulary.
