## ADDED Requirements

### Requirement: Skirmish renders Kenney sprite tiles altitude-aware

The skirmish renderer SHALL paint terrain tiles using the Kenney Tower Defense atlas, picking the sprite based on altitude so flat tiles, raised tiles, and tall plateau tiles all align cleanly without gaps.

#### Scenario: Flat ground uses 132×99 sprites

- **WHEN** a tile has altitude `0` and terrain `grass`, `dirt`, `rock`, or `cliff`
- **THEN** the renderer draws a flat 132×99 Kenney landscape sprite
- **AND** the diamond center of the sprite anchors at the tile's iso screen position so adjacent tiles tile seamlessly

#### Scenario: Raised tiles use 132×99 grass-with-side sprites

- **WHEN** a tile has altitude `1`
- **THEN** the renderer draws a `landscape_25` style raised grass sprite that bakes the brown cliff side into the tile
- **AND** no separate cliff-face geometry is rendered between same-altitude neighbours

#### Scenario: Tall plateau tiles use 132×115 sprites

- **WHEN** a tile has altitude `2` or higher
- **THEN** the renderer draws a `landscape_22` style 132×115 raised grass sprite with the deeper cliff side
- **AND** the y-anchor compensates for the taller sprite by offsetting the diamond center using `33 / sprite.height` rather than a fixed ratio so no dark seam appears between adjacent plateau tiles

#### Scenario: Water tiles avoid the pack's grass-with-pond sprite

- **WHEN** a tile has terrain `water` or `shallow`
- **THEN** the renderer draws a custom blue/teal isometric diamond polygon with two small wave strokes
- **AND** does not use a sprite from the landscape atlas because the pack contains no full-water tile

### Requirement: Skirmish renders distinct silhouettes for each building type

The skirmish renderer SHALL render each building type with a Kenney tower sprite at a fixed pixel width chosen so HQ, refinery, depot, turret, and the enemy camp are immediately distinguishable by silhouette and footprint.

#### Scenario: HQ dominates the player base

- **WHEN** a player HQ is rendered in sprite mode
- **THEN** it uses `towers_grey/tower_15` (castle keep) at `116 px` width
- **AND** is at least `2×` the rendered width of the turret

#### Scenario: Refinery silhouette differs from depot silhouette

- **WHEN** a refinery and a depot are rendered in the same view
- **THEN** the refinery uses `towers_grey/tower_00` (green-roof spire) at `78 px` width
- **AND** the depot uses `towers_brown/tower_15` (brown crate stack) at `60 px` width
- **AND** both silhouettes are visually distinct (taller-vs-wider, grey-vs-brown)

#### Scenario: Turret reads as compact defense

- **WHEN** a turret is rendered in sprite mode
- **THEN** it uses `towers_grey/tower_07` at `38 px` width
- **AND** its render width does not depend on the building's collision radius

#### Scenario: Enemy camp dominates the enemy area

- **WHEN** the enemy camp is rendered in sprite mode
- **THEN** it uses `towers_red/tower_15` at `134 px` width
- **AND** retains its red pulse glow underneath the sprite

#### Scenario: Construction overlay preserved

- **WHEN** a building is under construction
- **THEN** the renderer dims the sprite, draws a circular progress arc, and shows a percentage overlay
- **AND** progress matches the existing engine `building.progress` value

#### Scenario: Hit flashes preserved

- **WHEN** a building takes damage
- **THEN** the renderer briefly tints the sprite white using a transient alpha-source-atop pass
- **AND** the tint fades back to the base sprite within the engine's hit-flash window

### Requirement: Skirmish loads sprite assets via side-load

The skirmish renderer SHALL load Kenney sprite atlases as separate PNG files from the SvelteKit static folder, with no inlined base64 atlas, and SHALL fall through to vector rendering until the assets resolve.

#### Scenario: Atlases load from /rts/towerDefense/

- **WHEN** the skirmish route mounts in sprite mode
- **THEN** the engine fetches `landscape_sheet.png`, `towers_grey_sheet.png`, `towers_red_sheet.png`, and `towers_brown_sheet.png` from `/rts/towerDefense/Spritesheet/`
- **AND** continues rendering in vector mode while the assets are still loading

#### Scenario: Asset failure does not crash the match

- **WHEN** any atlas fails to load
- **THEN** the engine logs the failure once and stays in vector mode for the remainder of the match
- **AND** does not retry the missing asset on every frame

#### Scenario: Sprite mode is toggleable

- **WHEN** the user presses `T` while focus is on the canvas
- **THEN** the renderer toggles between sprite mode and vector mode
- **AND** all overlays (selection rings, fog of war, projectiles, particles) continue to render correctly in either mode

### Requirement: Skirmish provides an audio feedback bus

The skirmish runtime SHALL include a WebAudio-backed audio bus that synthesizes input feedback tones, replacing the default null bus while keeping the null bus available for tests.

#### Scenario: Audio bus initializes lazily

- **WHEN** the user takes their first interaction (key press, click, or pointer down) inside the canvas host
- **THEN** the audio bus resumes its `AudioContext`
- **AND** does not produce sound before the first user gesture, in keeping with browser autoplay policies

#### Scenario: Mute toggle works

- **WHEN** the user presses `M` while focus is on the canvas
- **THEN** the audio bus toggles a master mute
- **AND** the HUD reflects the muted state

#### Scenario: Common gameplay events emit tones

- **WHEN** the engine emits any of `select`, `move`, `attack`, `build-place`, `build-complete`, `unit-die`, `rocket-hit`, `wave-alarm`, `victory`, or `defeat`
- **THEN** the audio bus plays a distinct synthesized tone for each event
- **AND** automated tests can assert tone names without actually emitting sound by injecting the null bus

### Requirement: Skirmish provides input feedback overlays

The skirmish runtime SHALL render a feedback layer with order acknowledgement ripples, custom cursor states, selection ring pop animations, hit-stop on heavy events, directional camera shake, and a combat-heat tracker that modulates particle density.

#### Scenario: Order acknowledgement ripples appear instantly

- **WHEN** the player issues a `move`, `attack`, `attack-move`, `patrol`, `repair`, or `build-place` order
- **THEN** a tile-shaped ripple expands and fades at the target tile within the same frame
- **AND** the ripple colour matches the order kind (green move, red attack, orange attack-move, cyan patrol, lime repair, gold build-place)

#### Scenario: Cursor reflects context

- **WHEN** the player hovers over an enemy, a damaged friendly building, an empty grass tile while armed for placement, or has an order armed
- **THEN** the canvas cursor swaps to the matching custom icon (crosshair, wrench, check, X, armed-attack, armed-patrol, or armed-repair)
- **AND** the OS cursor stays hidden over the canvas while a custom cursor is active

#### Scenario: Selection ring pops on selection change

- **WHEN** a unit transitions from unselected to selected
- **THEN** a brief overshoot-ease ring grows around it
- **AND** the ring decays to the steady selection ring within the engine's selection-pop window

#### Scenario: Hit-stop and shake on heavy events

- **WHEN** a rocket impacts, a building is destroyed, the player wins, or the player loses
- **THEN** the simulation pauses for a short hit-stop window
- **AND** the camera shakes with a directional bias toward the impact

#### Scenario: Combat heat modulates ambient effects

- **WHEN** combat damage is dealt
- **THEN** combat heat rises and decays over time
- **AND** the renderer increases particle density and adds a soft edge vignette while heat is high

### Requirement: Skirmish supports scout and rocket units

The skirmish gameplay SHALL include `scout` and `rocket` unit types with stats and behaviours distinct from the existing `worker` and `soldier`.

#### Scenario: Scout has high speed and sight

- **WHEN** a scout is created
- **THEN** its `speed` exceeds soldier speed
- **AND** its `sight` exceeds soldier sight
- **AND** its `damage` is lower than soldier damage

#### Scenario: Rocket fires parabolic projectiles

- **WHEN** a rocket fires at a target
- **THEN** the projectile follows a parabolic arc that ignores cliff line-of-sight blocking
- **AND** the projectile deals splash damage on impact according to the engine's existing damage application path

#### Scenario: Scout and rocket are trainable

- **WHEN** the player has enough resources and supply
- **THEN** the HQ command card exposes Train Scout (`C`) and Train Rocket (`V`) buttons
- **AND** training consumes both mineral and gas where required by the unit's stats

### Requirement: Skirmish supports gas resource and refinery building

The skirmish gameplay SHALL include a `gas` resource gathered through a `refinery` building placed adjacent to a gas node.

#### Scenario: Gas display in HUD

- **WHEN** a match starts
- **THEN** the HUD displays mineral and gas counts independently
- **AND** the resource panel updates whenever either value changes

#### Scenario: Refinery enables gas harvesting

- **WHEN** a player builds a refinery adjacent to a gas node
- **THEN** workers can harvest gas from that node
- **AND** harvested gas is added to the player's gas total via the existing income channel

#### Scenario: Gas without refinery is unharvestable

- **WHEN** a worker is ordered to harvest from a gas node with no completed refinery in range
- **THEN** the order resolves to an idle state with a UI hint
- **AND** no gas is added to the player's gas total

### Requirement: Skirmish supports patrol and repair orders

The skirmish gameplay SHALL include `patrol` (loop between two waypoints) and `repair` (worker restores building HP) orders end-to-end across domain, engine, and HUD.

#### Scenario: Patrol loops between two points

- **WHEN** the player issues `patrol` with a target tile
- **THEN** the unit moves between its current tile and the target tile in a loop
- **AND** engages enemies in range during the patrol

#### Scenario: Repair restores building HP

- **WHEN** a worker is given a repair order on a damaged friendly building
- **THEN** the worker moves into adjacency and ticks HP back onto the building until it is full or the order is cancelled
- **AND** repair particles play near the worker while repairing

#### Scenario: HUD exposes the new orders

- **WHEN** units are selected
- **THEN** the command card exposes Patrol (`P`) and Repair (`T`) buttons matching the order's enablement rules
- **AND** disabled buttons indicate why (e.g., no worker selected for repair)

### Requirement: Skirmish enforces fog of war per faction

The skirmish runtime SHALL maintain a per-faction vision grid with `unexplored`, `explored`, and `visible` states, drive vision from unit/building sight ranges, and render the player's fog as a soft mask over the world.

#### Scenario: Vision contributes to visibility

- **WHEN** a player unit or building exists on the map
- **THEN** every tile within its sight range becomes `visible` for the player faction
- **AND** the contribution accounts for altitude (high-ground sees over cliffs)

#### Scenario: Explored tiles persist after vision is lost

- **WHEN** a tile transitions from `visible` to no-longer-visible
- **THEN** it becomes `explored` and stays revealed in dim form
- **AND** the renderer continues to draw static map content (terrain, decor, neutral resources) but hides moving entities

#### Scenario: Fog hides enemy units in unexplored areas

- **WHEN** a tile is `unexplored`
- **THEN** the renderer paints it dark
- **AND** the player cannot click, target, or perceive enemy entities on that tile

### Requirement: Skirmish applies altitude combat bonuses

The skirmish combat resolution SHALL apply altitude bonuses and penalties so high-ground positions provide measurable advantages.

#### Scenario: High-ground attacker gains range and damage

- **WHEN** an attacker on a higher altitude tile fires at a lower-altitude target
- **THEN** the effective range and damage are higher than the attacker's base values

#### Scenario: Lower attacker can miss against higher target

- **WHEN** an attacker on a lower altitude tile fires at a higher-altitude target
- **THEN** the engine applies a miss chance to the shot
- **AND** missed shots emit a visible miss particle near the target

#### Scenario: Cliffs block line of sight and projectiles

- **WHEN** a straight line between attacker and target passes through a `cliff` tile
- **THEN** standard projectiles fail to reach the target
- **AND** rocket projectiles still arc over because of their parabolic path

### Requirement: Skirmish enemy camp runs a production economy

The skirmish enemy AI SHALL replace pure wave spawning with a production economy that queues units at the enemy camp on a timer and launches squads down ramps toward the player.

#### Scenario: Enemy camp queues units on a timer

- **WHEN** the match is running
- **THEN** the enemy camp produces units on a regular interval according to the AI difficulty
- **AND** the queue is visible to the player only when the camp tile is in fog state `visible`

#### Scenario: Squads launch when ready

- **WHEN** the enemy production queue completes a squad
- **THEN** the squad starts moving along a ramp path toward the player base
- **AND** the HUD shows a "squad launched" toast once vision is established

#### Scenario: Match still ends on camp destruction

- **WHEN** the player destroys the enemy camp
- **THEN** the match emits `matchEnded` with `winner = player`
- **AND** the existing `record-match-result` use case persists the outcome

### Requirement: Skirmish HUD surfaces new gameplay

The skirmish HUD SHALL surface the new units, resources, orders, and audio toggle without destabilising the existing lobby or HUD layout.

#### Scenario: Resource panel shows mineral and gas

- **WHEN** a match is active
- **THEN** the resource panel displays mineral and gas counts side-by-side
- **AND** the supply count and income rate stay visible

#### Scenario: Command card adds new buttons

- **WHEN** a unit or building is selected
- **THEN** the command card exposes Train Scout (`C`), Train Rocket (`V`), Build Refinery (`F`), Patrol (`P`), and Repair (`T`) where applicable
- **AND** disabled buttons explain why through tooltip or muted styling

#### Scenario: Mute and renderer toggle are global

- **WHEN** the player presses `M`
- **THEN** audio mute toggles regardless of selection
- **WHEN** the player presses `T`
- **AND** focus is on the canvas (not on a text input)
- **THEN** the renderer toggles between sprite mode and vector mode

### Requirement: Skirmish preserves clean architecture boundaries

The skirmish change SHALL preserve the workspace's clean architecture: domain code stays free of Pixi or HTTP imports, UI engine code stays free of SurrealDB or HTTP imports, and the route stays a thin composition layer.

#### Scenario: Domain remains UI-free

- **WHEN** new domain types/use cases are added in `packages/domain/src/{shared,application}/rts/`
- **THEN** they SHALL NOT import `pixi.js`, `@pixi/*`, browser globals, or HTTP transports
- **AND** automated tests assert `packages/domain` does not bundle `pixi.js`

#### Scenario: Engine remains domain-persistence-free

- **WHEN** new engine systems are added in `packages/ui/src/lib/rts/engine/`
- **THEN** they SHALL NOT import `surrealdb`, `domain/infrastructure`, or `domain/application`
- **AND** they communicate with the domain only through the existing `RtsEngine` constructor inputs and event emitter

#### Scenario: Route stays thin

- **WHEN** new HUD and overlay logic is added
- **THEN** `+page.svelte` continues to delegate to `rts-page.svelte.ts` and `rts-page.composition.ts`
- **AND** does not perform business logic, transport calls, or engine instantiation directly

### Requirement: Skirmish has automated coverage for new behaviour

The skirmish change SHALL include domain unit tests, engine unit tests, and a Playwright e2e covering the new presentation, feel, and gameplay surfaces.

#### Scenario: Domain unit tests cover new stats and validators

- **WHEN** the domain test suite runs
- **THEN** it asserts scout/rocket stats, gas validation, refinery placement validation, and patrol/repair order validation
- **AND** uses real SurrealDB `mem://` connections for any repository-backed tests according to the workspace testing rules

#### Scenario: Engine unit tests cover fog, projectile arc, and audio bus

- **WHEN** the UI engine test suite runs
- **THEN** it covers fog-of-war reveal/persist transitions, parabolic projectile cliff occlusion, and the audio bus mute contract
- **AND** uses the null audio bus for any deterministic engine test

#### Scenario: E2E covers the slice end-to-end

- **WHEN** the rts Playwright e2e runs
- **THEN** it asserts that a sprite-mode match loads without 404s, that fog reveals when a scout walks, that the resource panel shows gas, and that destroying the enemy camp triggers a `record-match-result` write
- **AND** mocks AI/audio/transport boundaries instead of calling live providers
