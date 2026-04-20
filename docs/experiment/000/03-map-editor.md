# Title

Map Editor UI, Tools, Validation, And Playtest Plan

## Goal

Design and implement an in-app map editor that lets users paint tiles, place entities, configure metadata, validate the result, and playtest the in-memory `MapDefinition` using the same `PlatformerEngine` defined in `01-engine-and-domain.md` and the same gameplay rules defined in `02-game-runtime.md`. The editor must follow clean-architecture frontend boundaries: visual logic in `.svelte.ts` models, layout-only `.svelte` files, and reusable UI in `packages/ui`.

## IP And Content Guardrail

- The editor inherits the IP guardrail from `02-game-runtime.md`. Tile and entity palette icons must use the IP-safe asset bundle.
- Editor user input fields (title, author) must not embed copyrighted text by default.

## Scope

- Reusable editor UI in `packages/ui/src/lib/platformer/editor/`.
- A separate `MapEditorEngine` for the editing surface that draws the tile grid, hover preview, brush preview, and selection.
- Tooling: brush, fill, rectangle, eraser, pan, zoom, undo, redo, grid toggle, layer toggle.
- Tile palette and entity palette driven by `TileKind` and `EntityKind` from `packages/domain/src/shared/platformer/`.
- Map metadata form: title, author, size, scroll mode, music, background.
- Validation panel surfacing `validateMapDefinition` results inline.
- Playtest overlay that mounts the runtime engine on the in-memory `MapDefinition` and returns to edit mode on `ESC`.
- Save and load through the application use cases defined in `04-persistence-and-services.md`. The editor never calls transports directly.

Out of scope for this step:

- SurrealDB persistence, REST, RPC. That belongs in `04-persistence-and-services.md`.
- Route composition and adapter selection. That belongs in `05-route-integration.md`.
- Multi-user collaborative editing.

## Architecture

- `packages/ui/src/lib/platformer/editor`
  - Owns reusable editor components, the editor model (`map-editor.svelte.ts`), the `MapEditorEngine`, and tool implementations.
  - Visual `.svelte` files are layout-only and bind to the editor model.
  - Interaction logic, undo history, validation triggering, and playtest swap live in `map-editor.svelte.ts`.
- `packages/ui/src/lib/platformer/engine` (from `01-engine-and-domain.md`)
  - Reused for playtest. The editor calls `PlatformerEngine.loadMap(currentMap)` and `start()`.
- `apps/desktop-app/src/routes/experiments/platformer/editor`
  - Owns the route shell, `editor-page.svelte.ts`, and `editor-page.composition.ts`. The page model wires the application use cases for load and save.
- The editor must not import `packages/domain` directly. It uses local UI types from `packages/ui/src/lib/platformer/types.ts`.

## Implementation Plan

1. Create the editor module folder.
   - `packages/ui/src/lib/platformer/editor/`
     - `index.ts`
     - `map-editor.svelte.ts`
     - `MapEditorCanvas.svelte`
     - `MapEditorCanvas.svelte.ts`
     - `TilePalette.svelte`
     - `EntityPalette.svelte`
     - `MapToolbar.svelte`
     - `MapMetaForm.svelte`
     - `MapValidationPanel.svelte`
     - `PlaytestOverlay.svelte`
     - `tools/`
       - `brush.ts`
       - `fill.ts`
       - `rectangle.ts`
       - `eraser.ts`
       - `pan.ts`
       - `entity-place.ts`
   - Re-export the public surface from `packages/ui/src/lib/index.ts`.
2. Define the editor model in `map-editor.svelte.ts`.
   - Owns:
     - `map: MapDefinition`
     - `selectedTool: EditorToolKind`
     - `selectedTile: TileKind`
     - `selectedEntity?: EntityKind`
     - `cursor: { col: number; row: number } | null`
     - `selection?: Rect`
     - `viewport: { offsetX: number; offsetY: number; zoom: number }`
     - `history: MapDefinition[]`
     - `historyIndex: number`
     - `validation: MapValidationResult`
     - `playtest: { active: boolean; lastEditedAt: number }`
   - Exposes:
     - `applyOperation(op: EditorOperation): void`
     - `undo(): void`
     - `redo(): void`
     - `setTool(kind: EditorToolKind): void`
     - `setSelectedTile(kind: TileKind): void`
     - `setSelectedEntity(kind: EntityKind | undefined): void`
     - `setMetadata(meta: Partial<MapMetadata>): void`
     - `revalidate(): void`
     - `enterPlaytest(): void`
     - `exitPlaytest(): void`
3. Define `EditorOperation` and tool implementations.
   - `EditorOperation`:
     - `paintTile { col, row, kind }`
     - `paintRect { rect, kind }`
     - `fillTile { col, row, kind }`
     - `eraseTile { col, row }`
     - `placeEntity { col, row, kind, params? }`
     - `removeEntity { id }`
     - `setSpawn { col, row }`
     - `setGoal { col, row, kind }`
     - `resizeMap { cols, rows }`
     - `updateMetadata { meta }`
   - Each operation is a pure transform: `(map: MapDefinition, op: EditorOperation) => MapDefinition`.
   - Tools translate user input into `EditorOperation` values and call `applyOperation`.
4. Implement undo and redo via immutable snapshots.
   - On every accepted operation, push a structurally-cloned `MapDefinition` onto `history` and advance `historyIndex`.
   - `undo` decrements `historyIndex` and resets `map`.
   - `redo` re-applies the next snapshot.
   - Cap `history.length` at a configurable bound, default `100`.
   - Coalesce consecutive `paintTile` operations to the same `(col, row)` within a brush stroke into a single history entry.
5. Implement `MapEditorEngine` in `packages/ui/src/lib/platformer/editor/MapEditorEngine.ts`.
   - Owns its own Pixi `Application`.
   - Renders:
     - background
     - tile layer using `@pixi/tilemap` rebuilt incrementally on operation
     - entity layer with sprite-per-`EntitySpawn`
     - hover preview
     - selection overlay
     - grid overlay (toggle)
   - Methods:
     - `mount(canvas): Promise<void>`
     - `setMap(map: MapDefinition): void`
     - `setHover(cell: { col, row } | null): void`
     - `setSelection(rect: Rect | null): void`
     - `setViewport(viewport): void`
     - `dispose(): void`
   - Pointer events on the canvas resolve to grid cells using `viewport` and `tileSize` and call into the active tool.
6. Implement the tool surface.
   - `EditorTool`:
     - `onPointerDown(model, cell, modifiers): void`
     - `onPointerMove(model, cell, modifiers): void`
     - `onPointerUp(model, cell, modifiers): void`
     - `cursorPreview(map, cell, modifiers): TilePreview | EntityPreview | null`
   - Tools:
     - `BrushTool`: paint single tile per cell move
     - `RectangleTool`: drag preview, commit on release
     - `FillTool`: 4-connected flood fill, bounded
     - `EraserTool`: paint `empty` tile
     - `PanTool`: shift viewport
     - `EntityPlaceTool`: place selected entity, with `params` editor opened in a side dialog
7. Implement palette components.
   - `TilePalette.svelte`:
     - render swatches for each `TileKind` with the editor's atlas thumbnail
     - selection state bound through model
   - `EntityPalette.svelte`:
     - render icons for each `EntityKind` placeable in user maps (the `player` kind is excluded; spawn point uses a dedicated tool)
   - Both use `shadcn-svelte` primitives from `ui/source` for selection and grouping.
8. Implement `MapToolbar.svelte`.
   - Buttons:
     - tool selector (brush, fill, rectangle, eraser, entity, spawn, goal, pan)
     - undo, redo
     - grid toggle
     - layer toggle (tiles, entities)
     - zoom in, zoom out, fit
     - playtest, exit playtest
   - Uses the shared `Tooltip.Provider` from `ui/source` per `apps/desktop-app/AGENTS.md`.
9. Implement `MapMetaForm.svelte`.
   - Inputs:
     - title (text)
     - author (text)
     - size cols (number)
     - size rows (number)
     - scrollMode (`horizontal` | `free`)
     - music (select from bundle ids)
     - background (select from bundle ids)
   - Resizing uses the `resizeMap` operation. New cells default to `empty`. Existing cells outside the new size are dropped after a confirm dialog.
10. Implement `MapValidationPanel.svelte`.
    - Shows `validation.errors` and `validation.warnings` from the editor model.
    - Each issue with `cell` is clickable and centers the viewport on that cell.
    - Validation runs on every committed operation through `revalidate()`.
11. Implement playtest mode.
    - `PlaytestOverlay.svelte` mounts on top of the editor canvas when `playtest.active` is true.
    - On enter:
      - serialize the current map via `JSON.parse(JSON.stringify(map))` to avoid editor-state leakage
      - construct a `PlatformerEngine` with `mode: 'play'`
      - call `loadMap(serialized)` and `start()`
    - On exit:
      - `dispose()` the engine
      - return focus to the editor canvas at the previous viewport and selection
    - `ESC` exits playtest. The editor model rejects `enterPlaytest` if `validation.errors` is non-empty.
12. Define keybindings.
    - `B` brush, `F` fill, `R` rectangle, `E` eraser, `P` pan, `N` entity, `S` spawn, `G` goal
    - `Cmd/Ctrl+Z` undo, `Cmd/Ctrl+Shift+Z` redo
    - `Space` hold for pan
    - `1-9` quick-select tile palette slot
    - `Enter` toggle playtest
13. Wire save and load through the page model.
    - The editor exposes events:
      - `requestSave(map)`
      - `requestSaveAs(map)`
      - `requestLoad(mapId)`
      - `requestNew()`
      - `requestDuplicateBuiltIn(builtInId)`
    - The page model in `05-route-integration.md` listens for these events and calls the use cases from `04-persistence-and-services.md`.
14. Honor clean-architecture frontend rules.
    - `.svelte` files contain layout, accessibility, bindings, and snippets.
    - `.svelte.ts` files own state, history, validation, and tool dispatch.
    - No transport, no SurrealDB, no AI SDK in editor files.

## Tests

- Pure tests in `packages/ui/src/lib/platformer/editor/`.
  - `EditorOperation` transforms:
    - `paintTile` writes the right cell
    - `fillTile` flood fills connected `empty` regions only
    - `paintRect` writes only inside the rect
    - `placeEntity` rejects out-of-bounds cells
    - `setSpawn` and `setGoal` reject out-of-bounds cells
    - `resizeMap` truncates and pads with `empty`
  - Undo and redo:
    - history advances per operation
    - undo restores the previous snapshot
    - redo re-applies the next snapshot
    - history caps at the configured bound
    - brush stroke coalescing collapses consecutive paints in one cell
- Component-level tests with `@testing-library/svelte` for `TilePalette`, `EntityPalette`, and `MapToolbar`:
  - selection updates the model
  - keyboard shortcuts route through the model
- Validation flow tests:
  - editing a cell that creates an invalid spawn surfaces an error in `MapValidationPanel`
  - clicking an issue centers the viewport
- Playtest tests:
  - `enterPlaytest` is rejected when errors exist
  - `exitPlaytest` restores viewport, selection, and tool

## Acceptance Criteria

- The editor exposes brush, fill, rectangle, eraser, pan, entity, spawn, and goal tools.
- Undo and redo work for all operations and coalesce brush strokes.
- Tile and entity palettes are driven by shared platformer kinds.
- Validation runs on every operation and highlights issues in the panel and the canvas.
- Playtest mounts the runtime engine on the in-memory map and returns to edit mode on `ESC`.
- The editor never imports `packages/domain` and never calls transports directly.

## Dependencies

- `01-engine-and-domain.md` provides `PlatformerEngine`, `MapDefinition`, `TileGrid`, and the asset bundle.
- `02-game-runtime.md` provides the playtest behavior the editor invokes.
- `04-persistence-and-services.md` provides the use cases that back the editor save and load events.
- `packages/ui` shadcn primitives via `ui/source` for the toolbar, palettes, dialogs, and tooltips.

## Risks / Notes

- A naive "rebuild the whole tilemap on every paint" path will stutter on large maps. Prefer incremental updates to the `@pixi/tilemap` layer per affected cell.
- Undo coalescing must reset between strokes so two distinct strokes do not merge.
- Playtest must serialize the map before running. Live references would let gameplay mutate editor state.
- Resizing maps is a destructive operation. Always confirm before truncating.

## Implementation status (repository)

- Editor model and pure transforms: `packages/ui/src/lib/platformer/editor/map-editor.svelte.ts`, `operations.ts`, `MapEditorCanvas.svelte`, `MapEditorToolbar.svelte`, `MapMetadataForm.svelte`.
- **Palette:** shipped as a single tabbed component `MapEditorPalette.svelte` (tile + entity tabs), not separate `TilePalette` / `EntityPalette` files yet.
- **Missing vs this doc:** dedicated `MapValidationPanel.svelte`, `PlaytestOverlay.svelte`, and `editor/tools/*.ts` tool-dispatch layer (logic currently folded into the model + `operations.ts`).
- Route shell: `apps/desktop-app/src/routes/experiments/platformer/editor/+page.svelte` mounts the combined palette and catalog sidebar described in `05-route-integration.md`.
