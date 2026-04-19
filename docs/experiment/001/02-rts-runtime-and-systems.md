# Title

RTS Runtime, Selection, Commands, Pathfinding, Combat, Economy, Tech, And Vision Plan

## Goal

Layer the classic-scope RTS systems on top of the engine defined in `01-engine-isometric-and-domain.md`. Deliver selection and command UX, altitude-aware A* pathfinding, ranged combat with altitude effects, two-resource economy with workers, building construction and unit production, a small tech tree, fog of war with three states, and a minimap. All gameplay rules live in engine-resident systems consuming shared domain types so the AI in `04-ai-opponent.md` can drive the same engine and tests can step the simulation deterministically.

## IP And Content Guardrail

- Never name, depict, or quote any well-known RTS franchise. Do not reference unit names, faction names, voice lines, or melodies from existing RTS titles in code, assets, comments, or commit messages.
- Use generic art (cubes, cylinders, simple silhouettes) and CC0 / royalty-free placeholder audio.
- Treat third-party asset packs as a hard prerequisite check. If a contributor cannot point to a permissive license file, reject the asset.
- Apply this rule equally to bundled built-in maps in `05-persistence-and-route-integration.md` and the visual juice in `03-visual-and-audio-juice.md`.

## Scope

- Selection model: single click, box select, double-click select-by-type, control-groups (`Ctrl+1..9` set, `1..9` recall, double-tap `1..9` recall and center).
- Command model: move, attack-move, attack, hold, patrol, gather, return-cargo, build, repair, train, research, cancel. Right-click contextual default per target.
- Pathfinding: A* on the iso grid with altitude-aware step cost; chunked path cache; local replan on collision; flow-field reserved as a forward-compatible optimization.
- Combat: range, damage, armor, attack period, projectile speed, attack arc, altitude bonuses, cliff occlusion.
- Economy: two resources, workers gather and return, supply cap with depots.
- Production: per-building queues with cancel/refund, foundation construction completed by workers.
- Tech tree: small set of researches at the HQ.
- Fog of war: per-faction vision grid with `unexplored | explored | visible` per cell, updated each fixed step.
- Minimap: terrain bake plus dynamic dots filtered by player vision; click-to-pan; drag-to-pan.
- Camera: edge-pan, keyboard-pan, zoom with bounds.

Out of scope for this step:

- Visual particles, screen-space filters, BGM, SFX. That belongs in `03-visual-and-audio-juice.md`.
- AI directors and difficulty. That belongs in `04-ai-opponent.md`.
- Persistence and route composition. That belongs in `05-persistence-and-route-integration.md`.

## Architecture

- `packages/ui/src/lib/rts/engine/systems`
  - Owns the runtime systems registered with the `EngineWorld` from `01-engine-isometric-and-domain.md`.
  - Each system depends only on engine primitives, engine components, and shared domain stats. No transport or DOM access.
- `packages/ui/src/lib/rts/engine/components`
  - Owns the runtime components (`Position`, `Velocity`, `IsoSprite`, `Faction`, `Selectable`, `Movable`, `Pathing`, `OrderQueue`, `Combat`, `Health`, `Cargo`, `Worker`, `Building`, `Production`, `Vision`, `Resource`, `Tech`).
- `packages/ui/src/lib/rts/engine/path`
  - Owns `IsoGrid`, `AStarPathfinder`, and `ChunkPathCache`.
- `packages/ui/src/lib/rts/engine/vision`
  - Owns the per-faction vision grid and the `VisionSystem`.
- `packages/ui/src/lib/rts/runtime/RtsHud.svelte`
  - Visual-only HUD. Bound through a `RtsHud.svelte.ts` model that subscribes to engine events.
- `packages/ui/src/lib/rts/runtime/Minimap.svelte`
  - Visual-only minimap. Bound through a `Minimap.svelte.ts` model that consumes the vision grid and entity positions emitted by the engine.
- `apps/desktop-app`
  - Wires engine, HUD, and minimap together at the page-model level only. No gameplay rules in the app.

## Implementation Plan

1. Define normalized RTS input.
   - `InputState`:
     - `pointer: { worldX: number; worldY: number; tile: TilePos | null; buttons: { left: boolean; right: boolean; middle: boolean } }`
     - `box: { active: boolean; startWorld: { x; y } | null; endWorld: { x; y } | null }`
     - `modifiers: { shift: boolean; ctrl: boolean; alt: boolean }`
     - `keys: { panLeft, panRight, panUp, panDown, attackMove, stop, hold, patrol, build, cancel }`
     - `commandHotkey: string | null` (for command-card hotkeys A/M/H/P/S/B/...)
     - `controlGroup: { kind: 'set' | 'recall' | 'recallCenter'; index: number } | null`
   - `InputSource` interface:
     - `pollFixed(): InputState`
     - `dispose(): void`
   - Provide `KeyboardMouseSource`. The page model owns event listeners and projects them into `InputState`.
2. Define core runtime components.
   - `Position { x: number; y: number; alt: number }` in world coords; `alt` mirrors the underlying tile altitude.
   - `Velocity { vx: number; vy: number }`
   - `IsoSprite { spriteId: string; depthBias: number; tint?: number }`
   - `Faction { id: string }`
   - `Selectable { radius: number }`
   - `Movable { speed: number; turnRate: number }`
   - `Pathing { path: TilePos[] | null; nextIndex: number; replanCooldownMs: number }`
   - `OrderQueue { orders: Order[] }`
   - `Combat { range: number; damage: number; period: number; cooldown: number; arc: 'direct' | 'parabolic'; projectileKind: 'bullet' | 'rocket' | 'tracer'; armorPierce?: number }`
   - `Health { hp: number; maxHp: number; armor: number }`
   - `Cargo { kind: ResourceKind | null; amount: number; capacity: number }`
   - `Worker { homeDepot?: Entity; assignedNode?: Entity }`
   - `Building { kind: BuildingKind; footprint: { cols: number; rows: number }; constructed: boolean; constructionPct: number }`
   - `Production { queue: ProductionItem[]; rallyTile?: TilePos }`
   - `Vision { range: number }`
   - `Resource { kind: ResourceKind; remaining: number; gatherersMax: number }`
   - `Tech { researchedBy: string; tech: TechKind; remainingMs: number }`
3. Define `Order` and the order semantics.
   - `Order` discriminated union:
     - `Move { to: TilePos }`
     - `AttackMove { to: TilePos }`
     - `Attack { target: Entity }`
     - `Hold`
     - `Patrol { to: TilePos }`
     - `Gather { node: Entity }`
     - `ReturnCargo`
     - `Build { kind: BuildingKind; tile: TilePos }`
     - `Repair { target: Entity }`
     - `Train { kind: UnitKind }`
     - `Research { tech: TechKind }`
   - Shift-queue: holding shift appends to `OrderQueue`. No shift replaces.
   - The `OrderSystem` owns transitions: walk to range, switch to attack, return to gather on death of target, etc.
4. Implement the selection system.
   - Build a per-frame quadtree of selectable entities filtered by `Faction.id === player`.
   - Single click: nearest selectable within `Selectable.radius`, considering iso footprint.
   - Box select:
     - rectangle in world coords from `box.startWorld` to `box.endWorld`
     - select all units owned by the player whose world position is inside the rectangle
     - if the rectangle is small (configurable threshold) treat as a click
   - Double-click: select all units of the same `IsoSprite.spriteId` (visible units only) inside the current viewport.
   - Control groups:
     - `Ctrl+N` sets group `N` to the current selection
     - `N` recalls
     - double-tap `N` recalls and pans the camera to the group's centroid
   - Selection events:
     - `unitSelected { ids: Entity[] }`
     - `selectionCleared`
5. Implement the command issuance system.
   - Right-click on terrain: `Move`, with `AttackMove` if `attackMove` modifier held; on enemy: `Attack`; on resource node: `Gather` (workers only); on owned damaged unit/building: `Repair` (workers only); on rally tile while building selected: set `Production.rallyTile`.
   - Command-card hotkeys:
     - `A` `AttackMove`
     - `M` `Move`
     - `S` `Stop` (clears `OrderQueue`)
     - `H` `Hold`
     - `P` `Patrol`
     - `B` opens build sub-menu (workers only)
     - `R` `Repair` cursor (workers only)
     - `T` opens train sub-menu (selected production building)
   - Build placement:
     - cursor renders a footprint preview on the tile under the pointer
     - placement is invalid on non-buildable terrain, on cliffs, on existing entities, or when the player lacks resources
     - confirming a build issues `Build { kind, tile }` to the selected worker; the worker walks to the tile and creates a foundation
6. Implement the iso pathfinding.
   - `IsoGrid` is built once per `loadMatch`:
     - per-cell flags: `walkable`, `buildable`, `swimmable`, `blocksVision`, `blocksProjectiles`
     - per-cell `altitude`
   - `AStarPathfinder.findPath(from: TilePos, to: TilePos, opts: PathOptions): TilePos[] | null`
     - 8-direction neighbors with diagonal cost `sqrt(2)`
     - step cost: `cost(a,b) = base + slopePenalty * |alt(b)-alt(a)|`
     - if `|alt(b)-alt(a)| > maxStep`, the edge is impassable for ground units
     - water is impassable for ground units, allowed for `swimmable`
     - early exit if `to` is unreachable; fall back to the nearest reachable tile and return that path
   - `ChunkPathCache`:
     - chunks of `16x16` cells with per-chunk connectivity summary
     - cache results keyed by `(fromChunk, toChunk)` and invalidate when buildings or destructibles change those chunks
   - Local replan:
     - `MovementSystem` checks the next path cell each step; on collision with a dynamic obstacle it requests a partial replan over the next `K` cells before falling back to a full replan
   - `FlowFieldPlanner` is reserved as a forward-compatible interface. It is not implemented in the first cut but the `Pathing` component and `MovementSystem` accept either a path or a flow direction so a future swap is non-breaking.
7. Implement movement and integration.
   - `MovementSystem` advances entities along their path or flow direction at `Movable.speed`.
   - Speed scales by altitude delta of the next step (going up is slower than going down).
   - `Position.alt` snaps to the destination tile's altitude when the entity completes a step. Visual interpolation between altitudes lives in the render layer, not the simulation.
8. Implement combat.
   - `CombatSystem` per fixed step:
     - decrement `Combat.cooldown`
     - acquire target if none and one is within `range` plus altitude bonus
     - if target out of range, request a `Move` to a tile within range
     - if cooldown reached and target in range, fire projectile and reset `cooldown = period`
   - Altitude rules:
     - default range bonus from higher altitude: `+1` tile per altitude level
     - default damage bonus: `+10%` per altitude level
     - default miss chance from lower-to-higher attack: `15%` (deterministic via seeded RNG)
   - Projectile occlusion:
     - direct (`bullet`, `tracer`) projectiles are blocked when the line from shooter to target crosses a tile with `blocksProjectiles` or with `altitude > shooterAlt + 1`
     - parabolic (`rocket`) projectiles ignore ground occlusion
   - Damage application uses `Health.armor` and `Combat.armorPierce`. On `Health.hp <= 0`, emit `unitKilled` or `buildingDestroyed` and remove the entity at end of step.
9. Implement the economy.
   - `Resource` entities sit on `mineral` or `gas` `ResourceNode` tiles.
   - `WorkerSystem`:
     - assigns idle workers to the closest resource node with capacity
     - state machine per worker: `idleHome -> moveToNode -> harvest -> moveToDepot -> deposit -> moveToNode`
     - `harvest` decrements `Resource.remaining` per cycle and increments `Cargo.amount` up to `Cargo.capacity`
     - `deposit` increments the faction `mineral` or `gas` total and clears `Cargo`
     - `Resource.remaining <= 0` removes the node
   - `Supply`:
     - each unit has a `supply` cost; each `depot` raises the faction's cap by a fixed amount
     - production attempts that would exceed the cap are blocked with a `popCap` event
10. Implement production and construction.
    - `ProductionSystem`:
      - each building with `Production` advances `queue[0].remainingMs`
      - on completion, spawn the produced unit at the building's exit tile and walk it to `rallyTile` if set
      - cancel returns full resource cost; mid-construction units do not exist yet so no partial refunds for units
    - `ConstructionSystem`:
      - a `Build` order spawns a foundation entity with `Building.constructed = false` and `Health.hp = 1`
      - any worker with `Repair` or `Build` order on the foundation increments `constructionPct` per step
      - at `100%`, set `constructed = true` and grant full `Health.hp`
      - canceling a foundation refunds the resource cost minus `constructionPct`
    - Building placement rules are validated at order-issue time (terrain, footprint, no overlap, faction owns the area, resources available).
11. Implement the tech tree.
    - `TechSystem` advances `Tech.remainingMs` for each in-flight research.
    - On completion, apply the per-tech effect to the owning faction:
      - `armorT1`/`armorT2`: `+1`/`+1` to all friendly `Health.armor`
      - `weaponT1`/`weaponT2`: `+10%`/`+10%` to all friendly `Combat.damage`
      - `sightRange`: `+1` to all friendly `Vision.range`
    - Researched at `hq`. The HQ's command card exposes `Research { tech }` orders.
12. Implement vision and fog of war.
    - `VisionSystem` per fixed step:
      - clear the `visible` mask for the player faction
      - for each owned entity with `Vision`, mark cells within `range` (taking altitude into account: lower altitude entities see less of higher cliffs; higher altitude entities see further)
      - any cell freshly marked `visible` becomes `explored` for the rest of the match
    - The vision grid is `Uint8Array(cols*rows)` per faction with three states: `0 = unexplored`, `1 = explored`, `2 = visible`.
    - The engine emits `visionChanged` with the dirty bounds so the fog renderer (in `03-visual-and-audio-juice.md`) only updates affected regions.
13. Implement the minimap model.
    - `MinimapModel` consumes:
      - the static terrain bake (computed once per `loadMatch` from `terrain` and `altitude`)
      - the player vision grid
      - entity positions and factions
    - Outputs:
      - a baked `RenderTexture`-like terrain image
      - per-frame `MinimapEntity[]` filtered by visibility (always show owned entities; show enemies only on `visible` cells)
    - Inputs from the user:
      - click maps to a world point and pans the camera
      - drag pans the camera continuously
      - shift-click issues a command at that world point to the current selection
14. Implement the camera.
    - `CameraSystem` reads `InputState.keys.pan*` and the mouse position for edge-pan when the cursor is within `edgePanThreshold` pixels of a viewport edge.
    - Zoom on mouse wheel anchored at the cursor world position.
    - Bounds are derived from `MapDefinition.size` and `tileSize`.
    - The camera does not affect simulation; it only changes the stage transform and the `worldToScreen` projection used by selection and the minimap.
15. Define determinism rules.
    - All random outcomes (miss chance, AI tie-breaks) draw from a single seeded RNG owned by the match (`MatchDefinition.rules.rngSeed`).
    - No `Math.random()` in any system.
    - Order issuance is timestamped by simulation step, not wall clock, so replays and tests stay reproducible.

## Tests

- Pure system tests using `bun:test` and `tickFixed(stepMs)` from the engine.
- Selection:
  - single click selects the nearest player entity within `Selectable.radius`
  - box select returns all enclosed player entities
  - double-click selects same-type units inside the viewport
  - control-groups set, recall, and recall-and-center
- Pathfinding:
  - flat ground: A* returns the shortest 8-direction path
  - slope: A* prefers the lower altitude-delta route when total cost is equal
  - cliff: A* refuses an edge with `|altDelta| > maxStep`
  - water: A* refuses a water cell for ground units
  - chunk cache invalidation:
    - placing a building inside a chunk invalidates that chunk's cache entries
- Combat:
  - cooldown ticks down per fixed step
  - in-range target triggers fire and resets cooldown
  - higher altitude shooter hits at extended range
  - lower altitude shooter against higher target uses the deterministic miss chance
  - direct projectile blocked by a tall cliff between shooter and target
  - parabolic rocket ignores ground occlusion
- Economy:
  - worker state machine completes a full `idleHome -> harvest -> deposit -> idleHome` cycle
  - resource depletion removes the node
  - supply cap blocks production with the `popCap` event
- Production and construction:
  - queue advances and produces at the right step
  - cancel returns full cost
  - foundation is completed by a worker over the configured duration
- Tech:
  - `armorT1` adds `+1` armor to all friendly units
  - `sightRange` extends `Vision.range` by `+1`
- Vision:
  - cells inside range become `visible`; previously visible cells become `explored` after leaving range
  - higher altitude entities see further than lower altitude entities of the same `Vision.range`
- Minimap model:
  - enemies are hidden on non-`visible` cells
  - click maps to the right world coordinates given a known camera transform
- Camera:
  - edge-pan triggers within `edgePanThreshold`
  - zoom anchors at the cursor world position
  - bounds clamp the camera position
- Determinism:
  - given the same `rngSeed`, two runs of the same orders produce identical end state

## Acceptance Criteria

- The runtime supports box select, click select, double-click select-by-type, and control-groups.
- Right-click contextual orders cover move, attack, gather, repair, and rally.
- A* respects altitude deltas and refuses cliffs above `maxStep`.
- Combat applies altitude bonuses and respects cliff occlusion for direct projectiles.
- Workers gather and deposit two resource types; supply cap is enforced.
- Buildings train units and complete tech research; foundations are constructed by workers.
- Fog of war exposes three states per cell and updates per fixed step.
- The minimap reflects vision and supports click and drag to pan.
- All RNG flows through a single seeded source for replay and test determinism.

## Dependencies

- `01-engine-isometric-and-domain.md` provides the engine surface, ECS-lite primitives, isometric projection, and shared domain types.
- `03-visual-and-audio-juice.md` consumes the events `unitDamaged`, `unitKilled`, `projectileImpact`, `visionChanged`, and renders particles/filters/sounds in response.
- `04-ai-opponent.md` consumes the same systems to issue orders for AI factions.
- `05-persistence-and-route-integration.md` provides the page model and HUD wiring.

## Risks / Notes

- "Game feel" lives in tunable constants. Document the tunables (`base`, `slopePenalty`, `maxStep`, `range`, `damage`, `period`, `armor`, `gatherCycleMs`, `buildSpeed`, `popCap`) in a single `stats.ts` file so balance changes do not require code edits.
- Pathfinding for large groups will get expensive without flow fields. Plan ahead for the swap by keeping `Pathing` accept either a path or a flow direction.
- Vision recomputation can be a hot path. Update only when an entity's tile changes or its `Vision.range` changes, and use the dirty-bounds emit pattern so the fog renderer is incremental.
- Selection box hit-testing in iso space must use projected world rectangles, not raw screen rectangles, or units near the screen edge will be missed at zoom levels other than `1`.
