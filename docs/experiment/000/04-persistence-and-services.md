# Title

Platformer Persistence, Application Services, And Transport Adapters Plan

## Goal

Define the persistence model, the application use cases, and the thin transport adapters that back both the runtime and the editor. Built-in worlds load from backend-owned JSON; user maps and player progress live in SurrealDB. The application layer merges the two into one resolved catalog the UI consumes through a single transport, mirroring the chat catalog pattern.

## Scope

- Add a new platformer subdomain in `packages/domain`.
- Keep browser-safe contracts in `packages/domain/src/shared/platformer` (already established in `01-engine-and-domain.md`).
- Keep use cases, ports, and the `MapCatalogService` in `packages/domain/src/application/platformer`.
- Keep SurrealDB repositories for `user_map` and `player_progress` in `packages/domain/src/infrastructure/database/platformer`.
- Keep backend-owned built-in world JSON in `packages/domain/src/infrastructure/platformer/builtins`.
- Keep HTTP routes and Electrobun RPC handlers thin in `apps/desktop-app`.
- Surface one merged `ResolvedMapEntry[]` to the controller layer.

Out of scope for this step:

- Editor UI and tools. That belongs in `03-map-editor.md`.
- Route composition and page models. That belongs in `05-route-integration.md`.
- Online sharing of user maps.

## Architecture

- `packages/domain/src/shared/platformer`
  - Browser-safe types only. Owns `MapDefinition`, `LevelDefinition`, `WorldDefinition`, `MapMetadata`, validation helpers, and the new shared service-facing DTOs:
    - `ResolvedMapEntry`
    - `RunResult`
- `packages/domain/src/application/platformer`
  - Owns ports, use cases, and the `MapCatalogService`.
  - Depends only on shared types and abstract ports.
- `packages/domain/src/infrastructure/database/platformer`
  - Owns Surreal repositories for `user_map` and `player_progress`. Owns record mappers and id normalization local to repository code, following the todo reference pattern.
- `packages/domain/src/infrastructure/platformer/builtins`
  - Owns raw JSON built-in world definitions and a loader that converts them into shared types.
- `apps/desktop-app/src/lib/adapters/platformer`
  - Owns transport interfaces and runtime adapters mirroring `src/lib/adapters/chat`.
- `apps/desktop-app/src/routes/api/platformer`
  - Owns thin REST handlers that delegate to application services.

## Implementation Plan

1. Add the new chat-style subdomain folders.
   - `packages/domain/src/application/platformer/`
     - `index.ts`
     - `ports.ts`
     - `MapCatalogService.ts`
     - `use-cases/`
       - `list-maps.ts`
       - `load-map.ts`
       - `save-user-map.ts`
       - `update-user-map.ts`
       - `delete-user-map.ts`
       - `duplicate-built-in-map.ts`
       - `validate-map.ts`
       - `record-run-result.ts`
       - `list-progress.ts`
   - `packages/domain/src/infrastructure/database/platformer/`
     - `index.ts`
     - `SurrealUserMapRepository.ts`
     - `SurrealPlayerProgressRepository.ts`
     - `mappers.ts`
   - `packages/domain/src/infrastructure/platformer/builtins/`
     - `index.ts`
     - `world-1.json`
     - `world-2.json`
     - `world-3.json`
     - `loader.ts`
   - Export the new platformer surfaces through `domain/shared`, `domain/application`, and `domain/infrastructure`.
2. Add shared service-facing DTOs in `packages/domain/src/shared/platformer/`.
   - `ResolvedMapEntry`:
     - `id: string`
     - `metadata: MapMetadata`
     - `definition: MapDefinition`
     - `source: 'builtin' | 'user'`
     - `builtInId?: string`
     - `inheritsFromBuiltInId?: string`
     - `isEditable: boolean`
   - `RunResult`:
     - `worldId: string`
     - `levelId: string`
     - `outcome: 'completed' | 'gameOver'`
     - `score: number`
     - `coins: number`
     - `timeMs: number`
     - `completedAt: string` ISO
3. Define agent-style persistence rules.
   - Built-in worlds are never stored in the DB.
   - The DB stores user maps and player progress only.
   - A "duplicated built-in" is stored as a full user map with no future linkage.
   - An "inherited built-in" stores `inheritsFromBuiltInId` and override fields only. Out-of-scope for sprint zero, but the schema reserves the field for forward compatibility.
4. Define repository and service ports in `packages/domain/src/application/platformer/ports.ts`.
   - `IBuiltInWorldSource`:
     - `listWorlds(): Promise<WorldDefinition[]>`
     - `findWorld(id): Promise<WorldDefinition | undefined>`
     - `findLevel(worldId, levelId): Promise<LevelDefinition | undefined>`
   - `IUserMapRepository`:
     - `list(): Promise<UserMapRecord[]>`
     - `findById(id): Promise<UserMapRecord | undefined>`
     - `create(input): Promise<UserMapRecord>`
     - `update(id, patch): Promise<UserMapRecord>`
     - `delete(id): Promise<void>`
   - `IPlayerProgressRepository`:
     - `list(): Promise<PlayerProgressRecord[]>`
     - `recordResult(result: RunResult): Promise<PlayerProgressRecord>`
   - `IMapValidator`:
     - `validate(map: MapDefinition): MapValidationResult`
5. Add `MapCatalogService` in the application layer.
   - Load built-in worlds via `IBuiltInWorldSource`.
   - Load user maps via `IUserMapRepository`.
   - Resolve each into `ResolvedMapEntry`:
     - built-in entries get `source: 'builtin'`, `isEditable: false`, `builtInId` set
     - user entries get `source: 'user'`, `isEditable: true`, `inheritsFromBuiltInId` populated when set
   - Order:
     - built-in worlds first in declared order, then their levels in declared order
     - user maps after, ordered by `metadata.updatedAt desc`
   - Provide a single `listResolved(): Promise<ResolvedMapEntry[]>` for the UI catalog.
   - Provide a single `loadResolved(id): Promise<ResolvedMapEntry | undefined>` for the runtime.
6. Add explicit application use cases.
   - `ListMaps` returns `ResolvedMapEntry[]`.
   - `LoadMap` returns a single `ResolvedMapEntry` for runtime.
   - `SaveUserMap` accepts `{ metadata, definition }`, validates, persists.
   - `UpdateUserMap` accepts `{ id, metadata?, definition? }`, validates, persists.
   - `DeleteUserMap` accepts `{ id }`.
   - `DuplicateBuiltInMap` accepts `{ builtInId, levelId, asAuthor }` and creates a user map snapshot of that level.
   - `ValidateMap` proxies the shared `validateMapDefinition`.
   - `RecordRunResult` persists a `RunResult` and returns the updated `PlayerProgressRecord`.
   - `ListProgress` returns `PlayerProgressRecord[]`.
7. Define record shapes in `packages/domain/src/infrastructure/database/platformer/`.
   - `UserMapRecord`:
     - `id: string`
     - `metadata: MapMetadata`
     - `definition: MapDefinition`
     - `inheritsFromBuiltInId?: string`
     - `createdAt: string`
     - `updatedAt: string`
   - `PlayerProgressRecord`:
     - `id: string`
     - `worldId: string`
     - `levelId: string`
     - `bestScore: number`
     - `bestTimeMs: number`
     - `completed: boolean`
     - `runs: number`
     - `updatedAt: string`
   - Record mappers normalize Surreal record ids to and from strings inside the repositories.
8. Implement the Surreal repositories.
   - `SurrealUserMapRepository`:
     - persists in `user_map` table
     - all timestamps stored as ISO strings
     - `update` patches `metadata` and `definition` independently
   - `SurrealPlayerProgressRepository`:
     - persists in `player_progress` table
     - `recordResult` upserts on `(worldId, levelId)` and updates `bestScore`, `bestTimeMs`, `completed`, `runs`, `updatedAt`
   - Reuse the existing database client conventions from `packages/domain/src/infrastructure/database`.
9. Implement the built-in world loader.
   - `BuiltInWorldSource` reads `world-*.json` from `packages/domain/src/infrastructure/platformer/builtins/`.
   - The loader validates each world with `validateMapDefinition` at load time and throws on invalid bundled data.
   - Bundled worlds are IP-safe per `02-game-runtime.md` (generic art, generic enemy names, original level layouts).
10. Add transport interfaces in `apps/desktop-app/src/lib/adapters/platformer/`.
    - `PlatformerTransport.ts`:
      - `listMaps(): Promise<ResolvedMapEntry[]>`
      - `loadMap(id): Promise<ResolvedMapEntry | undefined>`
      - `createUserMap(input): Promise<ResolvedMapEntry>`
      - `updateUserMap(id, patch): Promise<ResolvedMapEntry>`
      - `deleteUserMap(id): Promise<void>`
      - `duplicateBuiltInMap(input): Promise<ResolvedMapEntry>`
      - `recordRunResult(result): Promise<PlayerProgressRecord>`
      - `listProgress(): Promise<PlayerProgressRecord[]>`
    - `web-platformer-transport.ts`:
      - fetch adapter against `/api/platformer/**`
    - `desktop-platformer-transport.ts`:
      - Electrobun RPC adapter
    - `create-platformer-transport.ts`:
      - runtime mode resolver mirroring `create-chat-transport.ts`
11. Add REST routes in `apps/desktop-app/src/routes/api/platformer/`.
    - `GET /api/platformer/maps` calls `ListMaps`.
    - `POST /api/platformer/maps` calls `SaveUserMap`.
    - `GET /api/platformer/maps/[mapId]` calls `LoadMap`.
    - `PUT /api/platformer/maps/[mapId]` calls `UpdateUserMap`.
    - `DELETE /api/platformer/maps/[mapId]` calls `DeleteUserMap`.
    - `POST /api/platformer/maps/duplicate` calls `DuplicateBuiltInMap`.
    - `GET /api/platformer/worlds` calls `IBuiltInWorldSource.listWorlds`.
    - `GET /api/platformer/progress` calls `ListProgress`.
    - `POST /api/platformer/progress` calls `RecordRunResult`.
    - All handlers stay thin: parse body, delegate to use case, return JSON.
12. Extend the Electrobun RPC schema with the same operations so `dev:app` works without a server.
    - Match the same input and output shapes.
    - The desktop transport mirrors the web transport exactly so the page model stays transport-agnostic.

## Tests

- Shared and application tests use `bun:test` and stay framework-free.
- Application-layer tests for `MapCatalogService` use:
  - in-memory fakes for `IBuiltInWorldSource` (JSON-backed, allowed by the testing rule)
  - in-memory fakes for nothing else; `IUserMapRepository` and `IPlayerProgressRepository` are tested against the real Surreal repositories
  - Cover:
    - merging built-in worlds and user maps into one ordered list
    - duplicate creates a snapshot user map with no future linkage
    - resolved order: built-in first, user maps by `updatedAt desc`
    - editability flags for built-in vs. user entries
- Use-case tests follow the `TodoService` pattern in `packages/domain/src/application/todo/todo-service.test.ts`.
  - In-memory fakes for ports where the test focuses on application logic.
  - Cover:
    - `ListMaps` returns the merged catalog
    - `LoadMap` returns the right entry by id
    - `SaveUserMap` rejects invalid maps with surfaced validation errors
    - `DuplicateBuiltInMap` creates a user map with the correct `metadata.author` and snapshot definition
    - `RecordRunResult` upserts progress and updates `bestScore`, `bestTimeMs`, and `runs`
- Repository tests follow the real-instance pattern in [SurrealTodoRepository.test.ts](/Users/walker/Documents/Dev/AI Maker Lab/ai-maker-lab/packages/domain/src/infrastructure/database/SurrealTodoRepository.test.ts).
  - `createDbConnection({ host: 'mem://', ... })` per test, unique namespace and database per test.
  - Cover:
    - create, update, list, and delete user maps
    - persistence of `inheritsFromBuiltInId`
    - upsert behavior of `player_progress` on `(worldId, levelId)`
    - id normalization rules
- Transport adapter tests stay thin.
  - Verify HTTP and RPC handlers delegate to application services.
  - Verify the agent-list-style transport returns `ResolvedMapEntry[]` and never leaks raw Surreal record ids.

## Acceptance Criteria

- The plan keeps shared, application, infrastructure, and app-adapter responsibilities cleanly separated.
- The catalog is explicitly modeled as backend JSON built-in worlds plus DB-backed user maps merged by an application service.
- Map and progress repositories are tested against a real `mem://` SurrealDB instance.
- Application merge behavior is tested with in-memory fakes only at the JSON-backed boundary.
- Web and desktop handlers stay thin and return the unified `ResolvedMapEntry` shape.
- Validation errors from `SaveUserMap` and `UpdateUserMap` flow back to the client in a structured way.

## Dependencies

- `01-engine-and-domain.md` defines `MapDefinition`, `LevelDefinition`, `WorldDefinition`, `MapMetadata`, and `validateMapDefinition`.
- `02-game-runtime.md` defines the `RunResult` events that the runtime pushes back to `RecordRunResult`.
- `03-map-editor.md` defines the editor events that call `SaveUserMap`, `UpdateUserMap`, `DuplicateBuiltInMap`, and `LoadMap`.
- SurrealDB access reuses the existing database client conventions from `packages/domain/src/infrastructure/database`.
- Web transport aligns with the existing chat REST conventions in `apps/desktop-app/src/routes/api/chat`.

## Risks / Notes

- Letting the built-in JSON shape leak across the transport boundary would be a regression. Only `ResolvedMapEntry` should cross the controller boundary.
- The `inheritsFromBuiltInId` field is reserved for forward compatibility. The first cut treats `DuplicateBuiltInMap` as a snapshot only; do not implement live override merging in this experiment.
- Player progress upsert on `(worldId, levelId)` must be atomic. Use a single Surreal query rather than read-modify-write to avoid lost updates.
- Built-in JSON validation at load time prevents shipping a broken world bundle and is preferable to runtime crashes.

## Implementation status (repository)

- **Application surface:** `MapCatalogService` in `packages/domain/src/application/platformer/MapCatalogService.ts` exposes the catalog, map CRUD, duplicate, validation, and progress flows as **methods on one service** rather than separate `use-cases/*.ts` files. Method names intentionally mirror the old use-case names for a future file split.
- **Built-in worlds:** a single JSON bundle `packages/domain/src/infrastructure/file/platformer/built-in-worlds.json` loaded by `JsonBuiltInWorldRepository` (not `world-1.json` / `world-2.json` / `world-3.json`).
- **Persistence:** Surreal repositories for `user_map` and `player_progress` under `packages/domain/src/infrastructure/database/platformer/*` with `mem://` tests per workspace rules.
- **REST (actual paths):** `GET/POST /api/platformer/maps`, `GET/PUT/DELETE /api/platformer/maps/[id]`, `POST /api/platformer/maps/duplicate`, `GET /api/platformer/worlds`, `POST /api/platformer/runs` (record run), `GET /api/platformer/players/[id]` (load profile). The older `/api/platformer/progress` naming was **not** used; the spec sections above that still mention `/progress` are **legacy relative to the shipped code**.
- **Desktop transport:** `apps/desktop-app/src/lib/adapters/platformer/create-platformer-transport.ts` still returns the **web** transport when `mode === 'desktop'`; Electrobun RPC mirroring chat is **not** implemented yet.
