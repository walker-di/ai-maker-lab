# Title

Desktop App Route Integration, Page Models, And End-To-End Tests Plan

## Goal

Wire the engine, the editor, and the persistence layer into the desktop app's SvelteKit routes. Keep the app thin: per-route page models in `.svelte.ts` own composition, transport selection, and engine lifecycle. Visual `.svelte` files own layout only. Cover both runtime and editor flows with Playwright e2e tests using the existing `mem://` SurrealDB pattern.

## Scope

- Add a Platformer card to the experiments index on `apps/desktop-app/src/routes/+page.svelte`.
- Add the runtime route `apps/desktop-app/src/routes/experiments/platformer/` with `+page.svelte`, `platformer-page.svelte.ts`, and `platformer-page.composition.ts`.
- Add the editor route `apps/desktop-app/src/routes/experiments/platformer/editor/` with `+page.svelte`, `editor-page.svelte.ts`, and `editor-page.composition.ts`.
- Wire transports through `apps/desktop-app/src/lib/adapters/platformer/` from `04-persistence-and-services.md`.
- Add Playwright e2e tests under `apps/desktop-app/e2e/platformer/`.

Out of scope for this step:

- Engine internals. Those belong in `01-engine-and-domain.md` and `02-game-runtime.md`.
- Editor internals. Those belong in `03-map-editor.md`.
- Domain and persistence. Those belong in `04-persistence-and-services.md`.

## Architecture

- `apps/desktop-app/src/routes/+page.svelte`
  - Adds a Platformer experiment card alongside the existing Chat and Todo cards.
- `apps/desktop-app/src/routes/experiments/platformer/+page.svelte`
  - Layout-only. Title screen, world and level select, HUD overlay, Pixi canvas mount point.
- `apps/desktop-app/src/routes/experiments/platformer/platformer-page.svelte.ts`
  - Owns runtime state: catalog, selected world and level, engine instance, HUD model, run lifecycle.
  - Subscribes to engine events and forwards run results through the transport.
- `apps/desktop-app/src/routes/experiments/platformer/platformer-page.composition.ts`
  - Selects the transport via `create-platformer-transport.ts` and instantiates the page model.
- `apps/desktop-app/src/routes/experiments/platformer/editor/+page.svelte`
  - Layout-only editor shell. Mounts `<MapEditorCanvas>`, `<TilePalette>`, `<EntityPalette>`, `<MapToolbar>`, `<MapMetaForm>`, `<MapValidationPanel>`, `<PlaytestOverlay>`.
- `apps/desktop-app/src/routes/experiments/platformer/editor/editor-page.svelte.ts`
  - Owns editor state: catalog filter (built-in vs. user), current map, save and load actions.
  - Subscribes to editor events and calls the use cases through the transport.
- `apps/desktop-app/src/routes/experiments/platformer/editor/editor-page.composition.ts`
  - Same composition pattern as the runtime page.
- `+layout.ts` for these routes stays limited to global flags per `apps/desktop-app/AGENTS.md`.

## Implementation Plan

1. Add the experiment entry point.
   - Add a Platformer card on `apps/desktop-app/src/routes/+page.svelte` with two links: Play and Editor.
2. Create the runtime route shell.
   - `apps/desktop-app/src/routes/experiments/platformer/+page.svelte`
     - Title screen
     - World and level select
     - HUD overlay using `<PlatformerHud>` from `ui/source`
     - Pixi mount node passed to the engine
     - Pause overlay
   - Wrap content with `<Tooltip.Provider>` from `ui/source` per `apps/desktop-app/AGENTS.md`.
3. Implement the runtime page model in `platformer-page.svelte.ts`.
   - State:
     - `catalog: ResolvedMapEntry[]`
     - `selectedWorldId: string | null`
     - `selectedLevelId: string | null`
     - `engine: PlatformerEngine | null`
     - `hud: PlatformerHudModel`
     - `run: RunController`
     - `paused: boolean`
   - Lifecycle:
     - `bootstrap()` calls `transport.listMaps()` and seeds the catalog
     - `selectLevel(worldId, levelId)` loads the resolved entry, instantiates the engine, calls `loadMap`, and starts the run
     - engine event bindings: `score`, `coin`, `lifeLost`, `goalReached`, `powerUp`, `runFinished`
     - `runFinished` calls `transport.recordRunResult(result)` and returns to the title screen
     - `dispose()` stops and disposes the engine on route teardown
4. Compose the runtime page in `platformer-page.composition.ts`.
   - Build the transport via `create-platformer-transport.ts`.
   - Instantiate `PlatformerPageModel` with the transport.
   - Return the model for the `+page.svelte` to bind.
5. Create the editor route shell.
   - `apps/desktop-app/src/routes/experiments/platformer/editor/+page.svelte`
     - Two-column layout: tools and palettes on the left, canvas in the center, validation panel on the right.
     - Top toolbar with save, save as, load, new, duplicate built-in, playtest, exit playtest.
   - Wrap content with `<Tooltip.Provider>` from `ui/source`.
6. Implement the editor page model in `editor-page.svelte.ts`.
   - State:
     - `catalog: ResolvedMapEntry[]`
     - `currentEntryId: string | null`
     - `editor: MapEditorModel` (from `03-map-editor.md`)
     - `dirty: boolean`
     - `saving: boolean`
     - `playtestActive: boolean`
   - Bindings:
     - editor `requestSave` calls `transport.updateUserMap(currentEntryId, patch)`
     - editor `requestSaveAs` calls `transport.createUserMap(input)` and updates `currentEntryId`
     - editor `requestLoad(mapId)` calls `transport.loadMap(mapId)` and seeds the editor
     - editor `requestNew()` instantiates a fresh `MapDefinition` template
     - editor `requestDuplicateBuiltIn(builtInId)` calls `transport.duplicateBuiltInMap`
   - Guards:
     - leaving the route while `dirty` shows a confirm dialog
     - `playtestActive` blocks save and load
7. Compose the editor page in `editor-page.composition.ts` using the same pattern as the runtime page.
8. Reuse shared chat-style runtime patterns.
   - Mirror the `chat-page.svelte.ts` and `chat-page.composition.ts` separation.
   - Mirror `create-chat-transport.ts` for the runtime mode resolver.
9. Define a small bootstrap data flow.
   - On route mount:
     - composition builds the transport and the page model
     - the page model awaits `bootstrap()`
     - the `+page.svelte` shows a skeleton until `catalog` is populated
10. Cover the desktop bundle.
    - Confirm `electrobun.config.ts` includes the new route assets via the existing static copy step.
    - The runtime and editor routes must both work under `dev:web`, `dev:app`, and packaged desktop builds.

## Tests

- Page model tests in `apps/desktop-app/src/routes/experiments/platformer/`.
  - Use in-memory transport fakes that satisfy `PlatformerTransport`.
  - Cover:
    - `bootstrap()` populates the catalog
    - `selectLevel()` loads the engine and seeds the HUD
    - `runFinished` posts the result and returns to title
    - editor `requestSave` calls update with the right id
    - editor `requestSaveAs` swaps the current id
    - editor `requestNew` clears state and resets the editor model
    - leaving while `dirty` triggers the confirm path
- Component-level tests for the runtime route shell verify:
  - HUD reflects `PlatformerHudModel`
  - the Pixi mount node is sized
  - pause overlay shows when `paused` is true
- E2E tests in `apps/desktop-app/e2e/platformer/`.
  - Use the existing `patchEmptyTableErrors` helper from `apps/desktop-app/e2e/helpers.ts` per the chat e2e pattern.
  - `platformer.e2e.ts`:
    - load the experiments index, click Play
    - select world 1 level 1
    - simulate a few seconds of right + jump input via `page.keyboard`
    - assert the HUD score increments and `goalReached` resolves on a scripted short level
  - `editor.e2e.ts`:
    - load the experiments index, click Editor
    - paint a small ground line, place an entity, set spawn and goal
    - save the map and reload the route
    - re-open the saved map and verify tiles, entities, spawn, and goal
    - enter playtest, exit playtest with `ESC`, and confirm tool state restored
  - Gate any live-network tests behind environment flags following the chat test pattern.

## Acceptance Criteria

- Both routes render under `dev:web`, `dev:app`, and packaged desktop builds.
- Page models own all interaction logic; `.svelte` files stay layout-only.
- The runtime route loads a level, runs the engine, displays the HUD, and posts a `RunResult` on completion.
- The editor route loads, edits, saves, reloads, and playtests a user map without route reloads.
- E2E tests cover the runtime flow and the editor flow end-to-end against `mem://` SurrealDB.
- The Platformer card on the experiments index is reachable and labeled.

## Dependencies

- `01-engine-and-domain.md` provides `PlatformerEngine` and shared domain types.
- `02-game-runtime.md` provides the runtime systems and HUD model.
- `03-map-editor.md` provides the editor components and model.
- `04-persistence-and-services.md` provides the transport, REST routes, RPC schema, and use cases.
- `apps/desktop-app/AGENTS.md` constraints on `+layout.ts`, `Tooltip.Provider`, and per-route composition.

## Verification

- `bun run dev:web`
- `bun run dev:app`
- `bun run dev:app:hmr`
- `bun run check:desktop-app`
- `bun run build:desktop-app`
- `bun run test:e2e`
- `bun run test:e2e:platformer` (new script that filters Playwright to `e2e/platformer/`)

## Risks / Notes

- The Pixi `Application` must dispose on route teardown or the canvas leaks GPU resources between navigations.
- The page models must not import Pixi directly. Engine instantiation lives behind the `PlatformerEngine` surface from `ui/source`.
- The packaged desktop build serves static assets from `views://mainview`. Confirm `@pixi/sound` and `@pixi/tilemap` assets resolve under that scheme. If not, add a thin asset rewrite at the engine boundary, not at the route boundary.
- E2E timing for gameplay flakes if asserting on absolute frame counts. Assert on engine events surfaced through the page model, not on raw frame timings.

## Implementation status (repository)

- Experiments index card and platformer routes: `apps/desktop-app/src/routes/+page.svelte`, `apps/desktop-app/src/routes/experiments/platformer/*`, `apps/desktop-app/src/routes/experiments/platformer/editor/*` with `.svelte.ts` page models and `*.composition.ts` wiring per `apps/desktop-app/AGENTS.md`.
- Transports: `apps/desktop-app/src/lib/adapters/platformer/*` (`create-platformer-transport.ts`, `web-platformer-transport.ts`). Desktop still uses the web transport (see `04-persistence-and-services.md` implementation status).
- **E2E:** `apps/desktop-app/e2e/platformer/*`. Filtered script **`bun run test:e2e:platformer`** is defined in `apps/desktop-app/package.json` and runs only that folder.
- **Editor shell vs this doc:** `editor/+page.svelte` uses `MapEditorPalette` (combined) rather than separate `TilePalette` / `EntityPalette` components; validation UI and `PlaytestOverlay` are not yet split per `03-map-editor.md`.
